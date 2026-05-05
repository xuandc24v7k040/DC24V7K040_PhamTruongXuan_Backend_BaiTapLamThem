const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const csrf = require("csurf");

const ApiError = require("./app/api-error");
const contactsRouter = require("./app/routes/contact.route");
const authRouter = require("./app/routes/auth.route");
const { verifyToken } = require("./app/middlewares/auth.middleware");
const csrfProtection = require("./app/middlewares/csrf.middleware");

const app = express();

app.use(cors({ origin: "http://localhost:3001", credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.use("/api/auth", authRouter);
app.use("/api/contacts", verifyToken, contactsRouter);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to contact book application." });
});

// handle 404 response
app.use((req, res, next) => {
  return next(new ApiError(404, "Resource not found"));
});

// Middleware xử lý lỗi tập trung
app.use((error, req, res, next) => {
  return res.status(error.statusCode || 500).json({
    message: error.message || "Internal Server Error",
  });
});

module.exports = app;
