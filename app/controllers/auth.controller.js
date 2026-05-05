const UserService = require("../services/user.service");
const MongoDB = require("../utils/mongodb.util");
const ApiError = require("../api-error");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const config = require("../config");
const { OAuth2Client } = require("google-auth-library");
const { ObjectId } = require("mongodb");

const client = new OAuth2Client(config.google.clientId);

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiration,
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiration,
  });
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
};

exports.register = async (req, res, next) => {
  try {
    const userService = new UserService(MongoDB.client);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return next(new ApiError(400, "Vui lòng cung cấp đủ thông tin."));
    }

    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      return next(new ApiError(400, "Email đã được sử dụng."));
    }

    const user = await userService.create({
      name,
      email,
      password,
      authType: "local",
    });

    res.status(201).send({
      message: "Đăng ký thành công. Vui lòng đăng nhập.",
    });
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi đăng ký."));
  }
};

exports.login = async (req, res, next) => {
  try {
    const userService = new UserService(MongoDB.client);
    const { email, password } = req.body;

    const user = await userService.findByEmail(email);

    if (!user) {
      return next(new ApiError(401, "Email hoặc mật khẩu không đúng."));
    }

    if (user.authType !== "local") {
      return next(new ApiError(401, "Tài khoản này đăng nhập bằng Google."));
    }

    if (isLocked(user)) {
      const retryAfter = Math.ceil((user.lockUntil - Date.now()) / 1000);

      return res.status(423).send({
        message: `Tài khoản bị khóa. Thử lại sau ${retryAfter}s`,
        retryAfter,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;

      let update = {
        failedLoginAttempts: attempts,
      };

      if (attempts >= 5) {
        update.lockUntil = Date.now() + 5 * 60 * 1000;
        update.failedLoginAttempts = 0;
      }

      await userService.User.updateOne({ _id: user._id }, { $set: update });

      return next(new ApiError(401, "Email hoặc mật khẩu không đúng."));
    }

    await userService.User.updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      },
    );

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await userService.User.updateOne(
      { _id: user._id },
      { $set: { refreshToken } },
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.send({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi đăng nhập."));
  }
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { tokenId } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: config.google.clientId,
    });
    const payload = ticket.getPayload();
    const { email, name } = payload;

    const userService = new UserService(MongoDB.client);
    let user = await userService.findByEmail(email);

    if (user && user.authType !== "google") {
      return next(
        new ApiError(409, "Email này đã được đăng ký bằng mật khẩu."),
      );
    }

    if (!user) {
      user = await userService.create({ name, email, authType: "google" });
    }

    if (isLocked(user)) {
      const retryAfter = Math.ceil((user.lockUntil - Date.now()) / 1000);

      return res.status(423).send({
        message: `Tài khoản bị khóa. Thử lại sau ${retryAfter}s`,
        retryAfter,
      });
    }

    await userService.User.updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginAttempts: 0,
          lockUntil: null,
        },
      },
    );

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    await userService.User.updateOne(
      { _id: user._id },
      { $set: { refreshToken } },
    );

    setAuthCookies(res, accessToken, refreshToken);

    res.send({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    return next(new ApiError(401, "Xác thực Google thất bại."));
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const oldToken = req.cookies.refreshToken;

    if (!oldToken) {
      return next(new ApiError(401, "Không có refresh token"));
    }

    const decoded = jwt.verify(oldToken, config.jwt.refreshSecret);

    const userService = new UserService(MongoDB.client);
    const user = await userService.findById(decoded.id);

    if (!user) {
      return next(new ApiError(401, "User không tồn tại"));
    }

    if (user.refreshToken !== oldToken) {
      await userService.User.updateOne(
        { _id: user._id },
        { $set: { refreshToken: null } },
      );

      return next(new ApiError(403, "Token bị reuse → đăng nhập lại"));
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    await userService.User.updateOne(
      { _id: user._id },
      { $set: { refreshToken: newRefreshToken } },
    );

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.send({ message: "Refresh thành công" });
  } catch (err) {
    return next(new ApiError(403, "Refresh token không hợp lệ"));
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const userService = new UserService(MongoDB.client);
    const user = await userService.findById(req.userId);

    if (!user) {
      return next(new ApiError(404, "Không tìm thấy người dùng."));
    }

    res.send({
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi lấy thông tin người dùng."));
  }
};

exports.logout = async (req, res) => {
  try {
    const userService = new UserService(MongoDB.client);
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      const result = await userService.User.updateOne(
        { _id: new ObjectId(decoded.id) },
        { $set: { refreshToken: null } },
      );
    }
  } catch (err) {}

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  res.send({ message: "Đăng xuất thành công" });
};

const isLocked = (user) => {
  return user.lockUntil && user.lockUntil > Date.now();
};
