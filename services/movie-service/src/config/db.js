const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "movie_db",
  });
  console.log("Movie service connected to MongoDB");
}

module.exports = connectDB;
