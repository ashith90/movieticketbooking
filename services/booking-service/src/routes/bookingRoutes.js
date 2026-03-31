const express = require("express");
const {
  lockSeats,
  createBooking,
  confirmBooking,
  cancelBooking,
  getMyBookings,
} = require("../controllers/bookingController");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/locks", requireAuth, lockSeats);
router.post("/", requireAuth, createBooking);
router.post("/:bookingId/confirm", requireAuth, confirmBooking);
router.post("/:bookingId/cancel", requireAuth, cancelBooking);
router.get("/me", requireAuth, getMyBookings);

module.exports = router;
