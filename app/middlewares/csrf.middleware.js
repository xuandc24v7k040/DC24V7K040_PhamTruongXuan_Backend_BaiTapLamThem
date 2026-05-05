const csrf = require("csurf");

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  },
});

module.exports = csrfProtection;
