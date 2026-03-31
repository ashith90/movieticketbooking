const express = require("express");
const NotificationLog = require("../models/NotificationLog");

const router = express.Router();

router.get("/logs", async (_req, res, next) => {
  try {
    const logs = await NotificationLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
