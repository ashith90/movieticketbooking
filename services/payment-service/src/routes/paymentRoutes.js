const express = require("express");
const { createIntent, webhook, getPayment } = require("../controllers/paymentController");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/intents", requireAuth, createIntent);
router.post("/webhook", webhook);
router.get("/:paymentId", requireAuth, getPayment);

module.exports = router;
