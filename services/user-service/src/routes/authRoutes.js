const express = require("express");
const { signup, login, refresh, logout } = require("../controllers/authController");
const { validate } = require("../middlewares/validate");
const { signupSchema, loginSchema } = require("../schemas/authSchemas");

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

module.exports = router;
