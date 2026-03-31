const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    state: String,
    country: String,
  },
  { timestamps: true }
);

const theaterSchema = new mongoose.Schema(
  {
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true, index: true },
    name: { type: String, required: true },
    address: String,
  },
  { timestamps: true }
);

theaterSchema.index({ cityId: 1, name: 1 }, { unique: true });

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, index: true },
    durationMin: Number,
    language: String,
    genre: String,
    rating: String,
  },
  { timestamps: true }
);

const showtimeSchema = new mongoose.Schema(
  {
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true, index: true },
    theaterId: { type: mongoose.Schema.Types.ObjectId, ref: "Theater", required: true, index: true },
    screenName: { type: String, required: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    basePrice: { type: Number, required: true },
    cityName: { type: String, required: true, index: true },
    seatLayout: [
      {
        seatId: { type: String, required: true },
        row: String,
        number: Number,
        type: { type: String, default: "REGULAR" },
      },
    ],
  },
  { timestamps: true }
);

showtimeSchema.index({ cityName: 1, startTime: 1 });
showtimeSchema.index({ movieId: 1, theaterId: 1, startTime: 1 });

const City = mongoose.model("City", citySchema);
const Theater = mongoose.model("Theater", theaterSchema);
const Movie = mongoose.model("Movie", movieSchema);
const Showtime = mongoose.model("Showtime", showtimeSchema);

module.exports = {
  City,
  Theater,
  Movie,
  Showtime,
};
