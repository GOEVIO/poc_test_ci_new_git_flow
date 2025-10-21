const mongoose = require("mongoose");
require("dotenv-safe").load();

const { Schema } = mongoose;

const firebasePublicUserTokenModel = new Schema(
  {
    id: { type: String, index: true },
    deviceId: { type: String },
    token: { type: String },
    activeSubscriptions: { type: Array, default: [] },
    clientName: { type: String, default: "EVIO" },
  },
  { timestamps: true }
);

firebasePublicUserTokenModel.index({ deviceId: 1, token: 1 });

var firebasePublicUserTokens = (module.exports = mongoose.model("firebasePublicUserTokens", firebasePublicUserTokenModel));

module.exports.createFirebaseTokenUser = function (newFirebasePublicUserToken, callback) {
  newFirebasePublicUserToken.save(callback);
};

module.exports.updateFirebaseTokenUser = function (query, values, callback) {
  firebasePublicUserTokens.findOneAndUpdate(query, values, callback);
};

module.exports.removeFirebaseTokenUser = function (query, callback) {
  firebasePublicUserTokens.findOneAndRemove(query, callback);
};