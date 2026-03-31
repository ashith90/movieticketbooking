require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const { City, Theater, Movie, Showtime } = require("../src/models/Catalog");

function buildSeatLayout() {
  const rows = ["A", "B", "C", "D", "E"];
  const seatsPerRow = 10;
  const layout = [];

  for (const row of rows) {
    for (let i = 1; i <= seatsPerRow; i += 1) {
      layout.push({
        seatId: `${row}${i}`,
        row,
        number: i,
        type: row === "A" ? "PREMIUM" : "REGULAR",
      });
    }
  }

  return layout;
}

async function upsertBy(model, filter, data) {
  return model.findOneAndUpdate(filter, { $set: data }, { new: true, upsert: true });
}

function atLocalTime(baseDay, hour, minute = 0) {
  const date = new Date(baseDay);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "movie_db";

  await mongoose.connect(mongoUri, { dbName });

  const bengaluru = await upsertBy(
    City,
    { name: "Bengaluru" },
    { name: "Bengaluru", state: "Karnataka", country: "India" }
  );
  const mumbai = await upsertBy(
    City,
    { name: "Mumbai" },
    { name: "Mumbai", state: "Maharashtra", country: "India" }
  );

  const theater1 = await upsertBy(
    Theater,
    { cityId: bengaluru._id, name: "PVR Orion" },
    {
      cityId: bengaluru._id,
      name: "PVR Orion",
      address: "Dr Rajkumar Road, Rajajinagar",
    }
  );

  const theater2 = await upsertBy(
    Theater,
    { cityId: mumbai._id, name: "INOX Nariman Point" },
    {
      cityId: mumbai._id,
      name: "INOX Nariman Point",
      address: "Nariman Point, Marine Drive",
    }
  );

  const movie1 = await upsertBy(
    Movie,
    { title: "Skyline Heist" },
    {
      title: "Skyline Heist",
      durationMin: 142,
      language: "English",
      genre: "Action",
      rating: "UA",
    }
  );

  const movie2 = await upsertBy(
    Movie,
    { title: "Monsoon Letters" },
    {
      title: "Monsoon Letters",
      durationMin: 126,
      language: "Hindi",
      genre: "Drama",
      rating: "U",
    }
  );

  const movie3 = await upsertBy(
    Movie,
    { title: "Quantum Masala" },
    {
      title: "Quantum Masala",
      durationMin: 132,
      language: "English",
      genre: "Sci-Fi",
      rating: "UA",
    }
  );

  const movie4 = await upsertBy(
    Movie,
    { title: "Laugh Track Love" },
    {
      title: "Laugh Track Love",
      durationMin: 118,
      language: "Hindi",
      genre: "Comedy",
      rating: "U",
    }
  );

  const today = startOfToday();
  const seatLayout = buildSeatLayout();

  const dayOfWeek = today.getDay();
  const daysUntilSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;

  const showtimePlan = [
    // Today and tonight
    { movie: movie1, theater: theater1, cityName: "Bengaluru", dayOffset: 0, hour: 11, minute: 15, price: 240, screen: "Screen 1" },
    { movie: movie2, theater: theater2, cityName: "Mumbai", dayOffset: 0, hour: 14, minute: 40, price: 220, screen: "Screen 2" },
    { movie: movie3, theater: theater1, cityName: "Bengaluru", dayOffset: 0, hour: 19, minute: 10, price: 280, screen: "Screen 3" },
    { movie: movie4, theater: theater2, cityName: "Mumbai", dayOffset: 0, hour: 21, minute: 25, price: 210, screen: "Screen 1" },

    // Tomorrow
    { movie: movie1, theater: theater2, cityName: "Mumbai", dayOffset: 1, hour: 10, minute: 50, price: 230, screen: "Screen 2" },
    { movie: movie4, theater: theater1, cityName: "Bengaluru", dayOffset: 1, hour: 20, minute: 5, price: 250, screen: "Screen 1" },

    // Weekend (Saturday and Sunday)
    { movie: movie3, theater: theater2, cityName: "Mumbai", dayOffset: daysUntilSaturday, hour: 12, minute: 0, price: 260, screen: "Screen 1" },
    { movie: movie2, theater: theater1, cityName: "Bengaluru", dayOffset: daysUntilSaturday, hour: 18, minute: 45, price: 240, screen: "Screen 2" },
    { movie: movie1, theater: theater1, cityName: "Bengaluru", dayOffset: daysUntilSaturday + 1, hour: 11, minute: 30, price: 230, screen: "Screen 3" },
    { movie: movie4, theater: theater2, cityName: "Mumbai", dayOffset: daysUntilSaturday + 1, hour: 20, minute: 0, price: 245, screen: "Screen 2" },

    // Upcoming (within 2-6 days)
    { movie: movie2, theater: theater1, cityName: "Bengaluru", dayOffset: 3, hour: 16, minute: 20, price: 215, screen: "Screen 1" },
    { movie: movie3, theater: theater2, cityName: "Mumbai", dayOffset: 5, hour: 17, minute: 10, price: 275, screen: "Screen 3" },

    // Latest/Later (7+ days)
    { movie: movie1, theater: theater1, cityName: "Bengaluru", dayOffset: 10, hour: 19, minute: 0, price: 265, screen: "Screen 2" },
    { movie: movie3, theater: theater2, cityName: "Mumbai", dayOffset: 15, hour: 21, minute: 15, price: 295, screen: "Screen 1" },
  ];

  const showtimes = [];
  for (const plan of showtimePlan) {
    const baseDay = new Date(today);
    baseDay.setDate(baseDay.getDate() + plan.dayOffset);

    const startTime = atLocalTime(baseDay, plan.hour, plan.minute);
    const endTime = new Date(startTime.getTime() + Number(plan.movie.durationMin || 120) * 60 * 1000);

    const seededShowtime = await upsertBy(
      Showtime,
      { movieId: plan.movie._id, theaterId: plan.theater._id, startTime },
      {
        movieId: plan.movie._id,
        theaterId: plan.theater._id,
        screenName: plan.screen,
        startTime,
        endTime,
        basePrice: plan.price,
        cityName: plan.cityName,
        seatLayout,
      }
    );

    showtimes.push(seededShowtime);
  }

  console.log("Catalog seed complete");
  console.log("Use these showtime IDs for booking inventory seed:");
  showtimes.forEach((item) => {
    console.log(item._id.toString());
  });

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Catalog seed failed", error);
  await mongoose.disconnect();
  process.exit(1);
});
