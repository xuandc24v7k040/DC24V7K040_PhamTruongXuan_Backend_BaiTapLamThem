const jwt = require("jsonwebtoken");
const config = require("../config");
const ApiError = require("../api-error");

exports.verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(
      new ApiError(403, "Không tìm thấy token xác thực hoặc đã hết hạn."),
    );
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.userId = decoded.id;

    next();
  } catch (error) {
    return next(new ApiError(401, "Token không hợp lệ hoặc đã hết hạn."));
  }
};
