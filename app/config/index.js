const config = {
  app: {
    port: process.env.PORT || 3000,
  },
  db: {
    uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/contactbook",
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || "5s",
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || "7d",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
  },
};

module.exports = config;
