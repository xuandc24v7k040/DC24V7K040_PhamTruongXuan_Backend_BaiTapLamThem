const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

class UserService {
  constructor(client) {
    this.User = client.db().collection("users");
  }

  async findByEmail(email) {
    return await this.User.findOne({ email: email });
  }

  async create(payload) {
    const user = {
      name: payload.name,
      email: payload.email,
      password: payload.password
        ? await bcrypt.hash(payload.password, 10)
        : null,
      authType: payload.authType || "local",
      refreshToken: null,
      failedLoginAttempts: 0,
      lockUntil: null,
    };
    const result = await this.User.insertOne(user);
    return { _id: result.insertedId, ...user };
  }

  async findById(id) {
    return await this.User.findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
  }
}

module.exports = UserService;
