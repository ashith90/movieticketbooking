const { City, Theater, Movie, Showtime } = require("../models/Catalog");
const redis = require("../config/redis");

const CACHE_PREFIX = "catalogcache:";
const CACHE_TTL_SECONDS = Number(process.env.CATALOG_CACHE_TTL_SECONDS || 60);

function cacheKey(scope, query = {}) {
  return `${CACHE_PREFIX}${scope}:${JSON.stringify(query || {})}`;
}

async function getCachedJson(key) {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function setCachedJson(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Continue without cache if Redis is unavailable.
  }
}

async function clearCatalogCache() {
  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${CACHE_PREFIX}*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Continue even if cache clear fails.
  }
}

async function getCities(_req, res, next) {
  try {
    const key = cacheKey("cities", {});
    const cached = await getCachedJson(key);
    if (cached) return res.json(cached);

    const cities = await City.find().sort({ name: 1 });
    await setCachedJson(key, cities);
    return res.json(cities);
  } catch (error) {
    return next(error);
  }
}

async function getMovies(req, res, next) {
  try {
    const key = cacheKey("movies", req.query);
    const cached = await getCachedJson(key);
    if (cached) return res.json(cached);

    const query = {};
    if (req.query.title) {
      query.title = new RegExp(req.query.title, "i");
    }
    if (req.query.language) {
      query.language = req.query.language;
    }
    const movies = await Movie.find(query).sort({ title: 1 });
    await setCachedJson(key, movies);
    return res.json(movies);
  } catch (error) {
    return next(error);
  }
}

async function getTheaters(req, res, next) {
  try {
    const key = cacheKey("theaters", req.query);
    const cached = await getCachedJson(key);
    if (cached) return res.json(cached);

    const query = {};
    if (req.query.cityId) {
      query.cityId = req.query.cityId;
    }
    const theaters = await Theater.find(query).sort({ name: 1 });
    await setCachedJson(key, theaters);
    return res.json(theaters);
  } catch (error) {
    return next(error);
  }
}

async function getShowtimes(req, res, next) {
  try {
    const key = cacheKey("showtimes", req.query);
    const cached = await getCachedJson(key);
    if (cached) return res.json(cached);

    const query = {};
    if (req.query.cityName) query.cityName = req.query.cityName;
    if (req.query.movieId) query.movieId = req.query.movieId;
    if (req.query.theaterId) query.theaterId = req.query.theaterId;

    if (req.query.from || req.query.to) {
      query.startTime = {};
      if (req.query.from) query.startTime.$gte = new Date(req.query.from);
      if (req.query.to) query.startTime.$lte = new Date(req.query.to);
    }

    const showtimes = await Showtime.find(query)
      .sort({ startTime: 1 })
      .populate("movieId")
      .populate("theaterId");

    await setCachedJson(key, showtimes);
    return res.json(showtimes);
  } catch (error) {
    return next(error);
  }
}

async function getSeatLayout(req, res, next) {
  try {
    const showtime = await Showtime.findById(req.params.showtimeId).select("seatLayout");
    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found" });
    }
    return res.json({ showtimeId: req.params.showtimeId, seatLayout: showtime.seatLayout });
  } catch (error) {
    return next(error);
  }
}

async function createMovie(req, res, next) {
  try {
    const { title, durationMin, language, genre, rating } = req.body;

    if (!title) {
      return res.status(400).json({ message: "title is required" });
    }

    const movie = await Movie.create({
      title: String(title).trim(),
      durationMin,
      language,
      genre,
      rating,
    });

    await clearCatalogCache();

    return res.status(201).json(movie);
  } catch (error) {
    return next(error);
  }
}

async function updateMovie(req, res, next) {
  try {
    const updates = {
      title: req.body.title,
      durationMin: req.body.durationMin,
      language: req.body.language,
      genre: req.body.genre,
      rating: req.body.rating,
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) {
        delete updates[key];
      }
    });

    if (updates.title) {
      updates.title = String(updates.title).trim();
    }

    const movie = await Movie.findByIdAndUpdate(req.params.movieId, updates, {
      new: true,
      runValidators: true,
    });

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    await clearCatalogCache();

    return res.json(movie);
  } catch (error) {
    return next(error);
  }
}

async function deleteMovie(req, res, next) {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.movieId);
    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    await clearCatalogCache();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

function buildDefaultSeatLayout() {
  const rows = ["A", "B", "C", "D", "E"];
  const seats = [];
  for (const row of rows) {
    for (let number = 1; number <= 10; number += 1) {
      seats.push({
        seatId: `${row}${number}`,
        row,
        number,
        type: "REGULAR",
      });
    }
  }
  return seats;
}

async function resolveCityName(theaterId, explicitCityName) {
  if (explicitCityName) return String(explicitCityName).trim();

  const theater = await Theater.findById(theaterId).populate("cityId", "name");
  if (!theater) {
    throw new Error("Theater not found");
  }

  return theater.cityId?.name || "Unknown City";
}

async function createShowtime(req, res, next) {
  try {
    const {
      movieId,
      theaterId,
      screenName,
      startTime,
      endTime,
      basePrice,
      cityName,
      seatLayout,
    } = req.body;

    if (!movieId || !theaterId || !screenName || !startTime || !endTime || !basePrice) {
      return res.status(400).json({
        message: "movieId, theaterId, screenName, startTime, endTime and basePrice are required",
      });
    }

    const computedCityName = await resolveCityName(theaterId, cityName);

    const showtime = await Showtime.create({
      movieId,
      theaterId,
      screenName: String(screenName).trim(),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      basePrice: Number(basePrice),
      cityName: computedCityName,
      seatLayout: Array.isArray(seatLayout) && seatLayout.length ? seatLayout : buildDefaultSeatLayout(),
    });

    await clearCatalogCache();

    return res.status(201).json(showtime);
  } catch (error) {
    if (error.message === "Theater not found") {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
}

async function updateShowtime(req, res, next) {
  try {
    const updates = {
      movieId: req.body.movieId,
      theaterId: req.body.theaterId,
      screenName: req.body.screenName,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      basePrice: req.body.basePrice,
      cityName: req.body.cityName,
      seatLayout: req.body.seatLayout,
    };

    Object.keys(updates).forEach((key) => {
      if (updates[key] === undefined) delete updates[key];
    });

    if (updates.screenName) updates.screenName = String(updates.screenName).trim();
    if (updates.startTime) updates.startTime = new Date(updates.startTime);
    if (updates.endTime) updates.endTime = new Date(updates.endTime);
    if (updates.basePrice !== undefined) updates.basePrice = Number(updates.basePrice);

    if (updates.theaterId && !updates.cityName) {
      updates.cityName = await resolveCityName(updates.theaterId, null);
    }

    const showtime = await Showtime.findByIdAndUpdate(req.params.showtimeId, updates, {
      new: true,
      runValidators: true,
    });

    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    await clearCatalogCache();

    return res.json(showtime);
  } catch (error) {
    if (error.message === "Theater not found") {
      return res.status(404).json({ message: error.message });
    }
    return next(error);
  }
}

async function deleteShowtime(req, res, next) {
  try {
    const showtime = await Showtime.findByIdAndDelete(req.params.showtimeId);
    if (!showtime) {
      return res.status(404).json({ message: "Showtime not found" });
    }

    await clearCatalogCache();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCities,
  getMovies,
  getTheaters,
  getShowtimes,
  getSeatLayout,
  createMovie,
  updateMovie,
  deleteMovie,
  createShowtime,
  updateShowtime,
  deleteShowtime,
};
