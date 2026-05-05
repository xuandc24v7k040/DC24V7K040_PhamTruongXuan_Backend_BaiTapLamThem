const express = require("express");
const auth = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");
const { loginLimiter } = require("../middlewares/rateLimiter");
const csrf = require("csurf");
const csrfProtection = require("../middlewares/csrf.middleware");

const router = express.Router();

router.post("/register", csrfProtection, auth.register);
router.post("/login", csrfProtection, loginLimiter, auth.login);
router.post("/google", loginLimiter, auth.googleLogin);
router.post("/refresh", auth.refreshToken);
router.post("/logout", csrfProtection, auth.logout);
router.get("/me", verifyToken, auth.getMe);

module.exports = router;
