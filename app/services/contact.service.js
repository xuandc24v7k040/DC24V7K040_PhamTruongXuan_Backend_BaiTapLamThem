const { ObjectId } = require("mongodb");

class ContactService {
  constructor(client) {
    this.Contact = client.db().collection("contacts");
  }

  extractConactData(payload) {
    const contact = {
      name: payload.name,
      email: payload.email,
      address: payload.address,
      phone: payload.phone,
      favorite: payload.favorite,
      hobbies: payload.hobbies,
      ownerId: payload.ownerId,
      gender: payload.gender,
      job: payload.job,
      birthDate: payload.birthDate,
      note: payload.note,
    };

    // Remove undefined fields
    Object.keys(contact).forEach(
      (key) => contact[key] === undefined && delete contact[key],
    );

    return contact;
  }

  async create(payload) {
    const contact = this.extractConactData(payload);
    const result = await this.Contact.findOneAndUpdate(
      contact,
      { $set: { favorite: contact.favorite === true } },
      { returnDocument: "after", upsert: true },
    );
    return result;
  }

  async find(filter) {
    const cursor = await this.Contact.find(filter);
    return await cursor.toArray();
  }

  async findByName(name, ownerId) {
    return await this.find({
      name: { $regex: new RegExp(name), $options: "i" },
      // name: { $regex: name, $options: "i" },
      ownerId: ownerId,
    });
  }

  async findById(id, ownerId) {
    return await this.Contact.findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
      ownerId: ownerId,
    });
  }

  async update(id, ownerId, payload) {
    const filter = {
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
      ownerId: ownerId,
    };
    const update = this.extractConactData(payload);

    const result = await this.Contact.findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: "after" },
    );

    return result;
  }

  async delete(id, ownerId) {
    const result = await this.Contact.findOneAndDelete({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
      ownerId: ownerId,
    });
    return result;
  }

  async findFavorite({ ownerId }) {
    return await this.find({ favorite: true, ownerId });
  }

  async deleteAll(ownerId) {
    const result = await this.Contact.deleteMany({ ownerId });
    return result.deletedCount;
  }
}

module.exports = ContactService;
