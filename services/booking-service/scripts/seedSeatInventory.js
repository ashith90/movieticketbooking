require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const SeatInventory = require("../src/models/SeatInventory");

function buildSeatIds() {
  const rows = ["A", "B", "C", "D", "E"];
  const seatsPerRow = 10;
  const seatIds = [];

  for (const row of rows) {
    for (let i = 1; i <= seatsPerRow; i += 1) {
      seatIds.push(`${row}${i}`);
    }
  }

  return seatIds;
}

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "booking_db";
  const showtimeId = process.env.SHOWTIME_ID || "demo-showtime-1";

  await mongoose.connect(mongoUri, { dbName });

  const seatIds = buildSeatIds();

  const operations = seatIds.map((seatId) => ({
    updateOne: {
      filter: { showtimeId, seatId },
      update: {
        $setOnInsert: {
          showtimeId,
          seatId,
          state: "AVAILABLE",
        },
      },
      upsert: true,
    },
  }));

  await SeatInventory.bulkWrite(operations, { ordered: false });

  console.log(`Seat inventory seeded for showtime ${showtimeId}`);
  console.log(`Total seats ensured: ${seatIds.length}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Seat inventory seed failed", error);
  await mongoose.disconnect();
  process.exit(1);
});
