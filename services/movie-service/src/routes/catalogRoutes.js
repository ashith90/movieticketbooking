const express = require("express");
const {
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
} = require("../controllers/catalogController");
const { requireAuth, requireAdmin } = require("../middlewares/auth");

const router = express.Router();

router.get("/cities", getCities);
router.get("/movies", getMovies);
router.get("/theaters", getTheaters);
router.get("/showtimes", getShowtimes);
router.get("/showtimes/:showtimeId/seats", getSeatLayout);
router.post("/movies", requireAuth, requireAdmin, createMovie);
router.put("/movies/:movieId", requireAuth, requireAdmin, updateMovie);
router.delete("/movies/:movieId", requireAuth, requireAdmin, deleteMovie);
router.post("/showtimes", requireAuth, requireAdmin, createShowtime);
router.put("/showtimes/:showtimeId", requireAuth, requireAdmin, updateShowtime);
router.delete("/showtimes/:showtimeId", requireAuth, requireAdmin, deleteShowtime);

module.exports = router;
