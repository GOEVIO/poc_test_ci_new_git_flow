const mongoose = require("mongoose");
require("dotenv-safe").load();

const { Schema } = mongoose;

const tokenModel = new Schema(
  {
    token: { type: String },
    clientType: { type: String },
    active: { type: Boolean, default: true },
    deviceId: { type: String },
    activeSubscriptions: { type: Array, default: [] },
    clientName: { type: String, default: "EVIO" },
  },
  { timestamps: true }
);

const firebaseUserTokensModel = new Schema(
  {
    id: { type: String, index: true },
    userId: { type: String },
    tokenList: [{ type: tokenModel }]
  },
  { timestamps: true }
);

firebaseUserTokensModel.index({ userId: 1 });

var firebaseUserTokens = (module.exports = mongoose.model("firebaseUserTokens", firebaseUserTokensModel));

module.exports.createFirebaseTokenUser = function (newFirebaseUserTokens, callback) {
  newFirebaseUserTokens.save(callback);
};

module.exports.updateFirebaseTokenUser = function (query, values, callback) {
  firebaseUserTokens.findOneAndUpdate(query, values, callback);
};
