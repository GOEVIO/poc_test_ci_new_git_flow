const express = require("express");
const router = express.Router();
const Notification = require("../models/FirebaseNotification");
require("dotenv-safe").load();

//========== POST ==========
//Create notification
router.post("/api/private/notifications/notification", (req, res) => {
  var context = "POST /api/private/notifications/notification";

  // validate request
  if (!isPostReqValid(req, res)) return;

  try {
    let notification = new Notification(req.body);
    var userId = req.headers["userid"];
    notification.userId = userId;
    Notification.createNotification(notification, (err, result) => {
      if (err) {
        console.log(`[${context}][createNotification] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (result) {
          return res.status(200).send(result);
        } else {
          return res.status(400).send({
            auth: false,
            code: "server_notification_not_created",
            message: "Notification not created",
          });
        }
      }
    });
  } catch (ex) {
    console.log(`[${context}] Error`, ex.message);
    return res.status(500).send(ex.message);
  }
});

//========== PATCH ==========
//Set notifications as sent
router.patch("/api/private/notifications/notification", (req, res) => {
  var context = "POST /api/private/notifications/notification";
  try {
    if (!isPatchReqValid(req, res)) return;

    let promises = [];
    const notifications = req.body.notifications;
    notifications.map((notif) => {
      const notification = Object.assign(
        {},
        { _id: notif, isToSend: false, sent: true }
      );
      var newValues = { $set: notification };
      var query = { _id: notification._id };

      promises.push(updateNotification(query, newValues));
    });

    // Even if it doesn't send all notifications, send 200 OK
    // and the update log
    Promise.all(promises).then((updates) => {
      return res.status(200).send(updates);
    });
  } catch (ex) {
    console.log(`[${context}] Error`, ex.message);
    return res.status(500).send(ex.message);
  }
});

//========== FUNCTION ==========
//Function to validate post request body
function isPostReqValid(req, res) {
  if (!req.body) {
    res.status(400).send({
      auth: false,
      code: "server_data_required",
      message: "Data required",
    });
    return false;
  }

  if (!req.body.notificationType) {
    res.status(400).send({
      auth: false,
      code: "server_notification_type_required",
      message: "Notification type required",
    });
    return false;
  }

  if (!req.body.hasOwnProperty("message")) {
    res.status(400).send({
      auth: false,
      code: "server_notification_missing_message",
      message: "You need to specify a message to send.",
    });
    return false;
  }

  const msg = req.body.message;
  if (
    !msg.hasOwnProperty("notification") &&
    !msg.hasOwnProperty("android") &&
    !msg.hasOwnProperty("apns") &&
    !msg.hasOwnProperty("webpush")
  ) {
    res.status(400).send({
      auth: false,
      code: "server_notification_message_missing_content",
      message:
        "You need to specify the common or platform-specific notification content (notification, android, apns or webpush).",
    });
    return false;
  }

  if (!req.body.hasOwnProperty("sendTo")) {
    res.status(400).send({
      auth: false,
      code: "server_notification_sendTo_required",
      message:
        "You need to specify the notification's delivery target (token, topic or condition).",
    });
    return false;
  }

  if (typeof req.body.sendTo !== "object") {
    res.status(400).send({
      auth: false,
      code: "server_notification_invalid_sendTo",
      message:
        "The sendTo element must be an object, specifying type of target and value.",
    });
    return false;
  }

  return true;
}

function isPatchReqValid(req, res) {
  if (!req.body.hasOwnProperty("notifications")) {
    res.status(400).send({
      auth: false,
      code: "server_notification_missing_array",
      message: "The request's body needs to contain an array of notifications.",
    });
    return false;
  }

  const notifications = req.body.notifications;
  if (!Array.isArray(notifications)) {
    res.status(400).send({
      auth: false,
      code: "server_notification_invalid_array",
      message: "The notifications element value isn't an array.",
    });
    return false;
  }

  if (notifications.length === 0) {
    res.status(400).send({
      auth: false,
      code: "server_notification_empty_array",
      message: "The array of notifications is empty.",
    });
    return false;
  }

  return true;
}

function updateNotification(query, newValues) {
  var context = "Function updateNotification";
  return new Promise((resolve, reject) => {
    try {
      Notification.updateNotification(query, newValues, (err, result) => {
        if (err) {
          console.log(`[${context}][updateNotification] Error `, err.message);
          return res.status(500).send(err.message);
        } else {
          if (result) {
            resolve({ _id: result._id, status: "updated" });
          } else {
            resolve({ _id: query._id, status: "not updated" });
          }
        }
      });
    } catch (error) {
      console.log(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

module.exports = router;
