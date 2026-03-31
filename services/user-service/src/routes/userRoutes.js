const express = require("express");
const { getMe, updateMe } = require("../controllers/userController");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);

module.exports = router;
