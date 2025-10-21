const mongoose = require("mongoose");
require("dotenv-safe").load();

const { Schema } = mongoose;

const firebaseNotificationModel = new Schema(
  {
    id: { type: String, index: true },
    notificationType: { type: String },
    isToSend: {
      type: Boolean,
      default: true,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    message: { type: Object },
    sendTo: { type: Object },
    clientName: { type: String, default: "EVIO" },
  },
  { timestamps: true }
);

firebaseNotificationModel.index({ isToSend: 1, sent: 1 });

var firebaseNotification = (module.exports = mongoose.model("FirebaseNotification", firebaseNotificationModel));

module.exports.createNotification = function (newNotification, callback) {
  newNotification.save(callback);
};

module.exports.updateNotification = function (query, values, callback) {
  firebaseNotification.findOneAndUpdate(query, values, callback);
};
