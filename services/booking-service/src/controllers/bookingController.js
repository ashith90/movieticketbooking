const { v4: uuidv4 } = require("uuid");
const Booking = require("../models/Booking");
const SeatInventory = require("../models/SeatInventory");
const OutboxEvent = require("../models/OutboxEvent");
const redis = require("../config/redis");

const LOCK_TTL_SECONDS = Number(process.env.SEAT_LOCK_TTL_SECONDS || 300);
const ACTION_IDEMPOTENCY_TTL_SECONDS = Number(process.env.ACTION_IDEMPOTENCY_TTL_SECONDS || 86400);

function redisSeatKey(showtimeId, seatId) {
  return `seatlock:${showtimeId}:${seatId}`;
}

async function publishBookingEvent(booking, eventType) {
  await OutboxEvent.create({
    aggregateType: "BOOKING",
    aggregateId: booking.bookingId,
    eventType,
    topic: process.env.BOOKING_EVENTS_TOPIC || "booking.events",
    payload: {
      bookingId: booking.bookingId,
      userId: booking.userId,
      showtimeId: booking.showtimeId,
      seats: booking.seats,
      amount: booking.amount,
      status: booking.status,
    },
  });
}

async function markBookingConfirmed(booking) {
  if (booking.status === "CONFIRMED") {
    return booking;
  }

  if (booking.status === "CANCELLED" || booking.status === "CANCEL_REQUESTED") {
    return booking;
  }

  await SeatInventory.updateMany(
    {
      showtimeId: booking.showtimeId,
      seatId: { $in: booking.seats },
      lockedBy: booking.userId,
    },
    { $set: { state: "BOOKED" }, $unset: { lockUntil: "", lockedBy: "" } }
  );

  booking.status = "CONFIRMED";
  await booking.save();
  await publishBookingEvent(booking, "BOOKING_CONFIRMED");
  return booking;
}

async function markBookingCancelled(booking) {
  if (booking.status === "CANCELLED") {
    return booking;
  }

  await SeatInventory.updateMany(
    {
      showtimeId: booking.showtimeId,
      seatId: { $in: booking.seats },
      state: { $in: ["LOCKED", "BOOKED"] },
    },
    { $set: { state: "AVAILABLE" }, $unset: { lockUntil: "", lockedBy: "" } }
  );

  for (const seatId of booking.seats) {
    await redis.del(redisSeatKey(booking.showtimeId, seatId));
  }

  booking.status = "CANCELLED";
  await booking.save();
  await publishBookingEvent(booking, "BOOKING_CANCELLED");
  return booking;
}

async function requestBookingCancellation(booking) {
  if (booking.status === "CANCELLED" || booking.status === "CANCEL_REQUESTED") {
    return booking;
  }

  booking.status = "CANCEL_REQUESTED";
  await booking.save();
  await publishBookingEvent(booking, "BOOKING_CANCEL_REQUESTED");
  return booking;
}

async function lockSeats(req, res, next) {
  try {
    const { showtimeId, seatIds } = req.body;

    if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
      return res.status(400).json({ message: "showtimeId and seatIds[] are required" });
    }

    const userId = req.user.userId;
    const uniqueSeatIds = [...new Set(seatIds.map((seatId) => String(seatId)))];
    const acquiredLocks = [];

    for (const seatId of uniqueSeatIds) {
      const lockKey = redisSeatKey(showtimeId, seatId);
      const locked = await redis.set(lockKey, userId, "EX", LOCK_TTL_SECONDS, "NX");

      if (!locked) {
        for (const acquiredSeatId of acquiredLocks) {
          await redis.del(redisSeatKey(showtimeId, acquiredSeatId));
          await SeatInventory.findOneAndUpdate(
            { showtimeId, seatId: acquiredSeatId, lockedBy: userId, state: "LOCKED" },
            { $set: { state: "AVAILABLE" }, $unset: { lockUntil: "", lockedBy: "" } }
          );
        }
        return res.status(409).json({ message: `Seat ${seatId} is currently locked` });
      }

      const lockUntil = new Date(Date.now() + LOCK_TTL_SECONDS * 1000);
      const updated = await SeatInventory.findOneAndUpdate(
        {
          showtimeId,
          seatId,
          $or: [
            { state: "AVAILABLE" },
            { state: "LOCKED", lockUntil: { $lt: new Date() } },
          ],
        },
        { $set: { state: "LOCKED", lockedBy: userId, lockUntil } },
        { new: true, upsert: true }
      );

      if (!updated) {
        await redis.del(lockKey);
        for (const acquiredSeatId of acquiredLocks) {
          await redis.del(redisSeatKey(showtimeId, acquiredSeatId));
          await SeatInventory.findOneAndUpdate(
            { showtimeId, seatId: acquiredSeatId, lockedBy: userId, state: "LOCKED" },
            { $set: { state: "AVAILABLE" }, $unset: { lockUntil: "", lockedBy: "" } }
          );
        }
        return res.status(409).json({ message: `Seat ${seatId} is not available` });
      }

      acquiredLocks.push(seatId);
    }

    return res.status(200).json({
      message: "Seats locked",
      lockExpiresInSeconds: LOCK_TTL_SECONDS,
    });
  } catch (error) {
    return next(error);
  }
}

function getActionIdempotencyKey(req) {
  const headerKey = req.headers["x-idempotency-key"];
  const bodyKey = req.body?.idempotencyKey;
  return String(headerKey || bodyKey || "").trim();
}

async function beginIdempotentAction(action, bookingId, key) {
  const redisKey = `idempo:${action}:${bookingId}:${key}`;
  const locked = await redis.set(redisKey, "1", "EX", ACTION_IDEMPOTENCY_TTL_SECONDS, "NX");
  return Boolean(locked);
}

async function createBooking(req, res, next) {
  try {
    const { showtimeId, seats, amount, idempotencyKey } = req.body;
    if (!showtimeId || !Array.isArray(seats) || seats.length === 0 || !amount || !idempotencyKey) {
      return res.status(400).json({
        message: "showtimeId, seats[], amount and idempotencyKey are required",
      });
    }

    const existing = await Booking.findOne({ idempotencyKey });
    if (existing) {
      return res.status(200).json(existing);
    }

    const userId = req.user.userId;

    for (const seatId of seats) {
      const seat = await SeatInventory.findOne({ showtimeId, seatId });
      if (!seat || seat.state !== "LOCKED" || seat.lockedBy !== userId || seat.lockUntil < new Date()) {
        return res.status(409).json({ message: `Seat ${seatId} is not locked by user` });
      }
    }

    const booking = await Booking.create({
      bookingId: uuidv4(),
      userId,
      showtimeId,
      seats,
      amount,
      idempotencyKey,
      status: "PENDING_PAYMENT",
    });

    return res.status(201).json(booking);
  } catch (error) {
    return next(error);
  }
}

async function confirmBooking(req, res, next) {
  try {
    const { bookingId } = req.params;
    const idempotencyKey = getActionIdempotencyKey(req);
    const firstAttempt = idempotencyKey
      ? await beginIdempotentAction("confirm", bookingId, idempotencyKey)
      : true;
    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!firstAttempt) {
      return res.json(booking);
    }

    if (booking.status !== "PENDING_PAYMENT" && booking.status !== "CONFIRMED") {
      return res.status(409).json({ message: `Cannot confirm booking from status ${booking.status}` });
    }

    await markBookingConfirmed(booking);
    return res.json(booking);
  } catch (error) {
    return next(error);
  }
}

async function processPaymentEvent(event) {
  const payload = event.payload || {};
  const bookingId = payload.bookingId;

  if (!bookingId) return;

  const booking = await Booking.findOne({ bookingId });
  if (!booking) return;

  if (event.eventType === "PAYMENT_SUCCEEDED") {
    await markBookingConfirmed(booking);
    return;
  }

  if (event.eventType === "PAYMENT_FAILED") {
    await markBookingCancelled(booking);
    return;
  }

  if (event.eventType === "PAYMENT_REFUNDED") {
    await markBookingCancelled(booking);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const { bookingId } = req.params;
    const idempotencyKey = getActionIdempotencyKey(req);
    const firstAttempt = idempotencyKey
      ? await beginIdempotentAction("cancel", bookingId, idempotencyKey)
      : true;
    const booking = await Booking.findOne({ bookingId, userId: req.user.userId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!firstAttempt) {
      return res.json(booking);
    }

    if (booking.status === "PENDING_PAYMENT") {
      await markBookingCancelled(booking);
      return res.json(booking);
    }

    if (!["CONFIRMED", "CANCEL_REQUESTED", "CANCELLED"].includes(booking.status)) {
      return res.status(409).json({ message: `Cannot cancel booking from status ${booking.status}` });
    }

    await requestBookingCancellation(booking);
    return res.json({
      message: "Cancellation requested. Refund is being processed.",
      booking,
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    return res.json(bookings);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  lockSeats,
  createBooking,
  confirmBooking,
  cancelBooking,
  getMyBookings,
  processPaymentEvent,
};
