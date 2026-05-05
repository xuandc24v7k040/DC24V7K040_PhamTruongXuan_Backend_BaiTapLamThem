const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,

  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    const resetTime = req.rateLimit.resetTime;

    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

    return res.status(429).json({
      status: "error",
      message: "Bạn đăng nhập quá nhiều lần",
      retryAfter: retryAfter > 0 ? retryAfter : 60,
    });
  },
});

module.exports = {
  loginLimiter,
};
