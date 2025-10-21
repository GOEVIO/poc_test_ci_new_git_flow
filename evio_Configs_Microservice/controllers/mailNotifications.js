const MailNotification = require('../models/mailNotification');
require("dotenv-safe").load();

module.exports = {
    addMailNotification: function (req) {
        let context = "Funciton addMailNotification";
        return new Promise((resolve, reject) => {

            let mailConfigs = req.body;

            MailNotification.findOne({}, (error, notificationConfigFound) => {
                if (error) {
                    console.error(`[${context}][.then][findOne] Error `, error.message);
                    reject(error);
                }
                else {
                    if (notificationConfigFound) {

                        let query = {
                            _id: notificationConfigFound._id
                        }
                        var newValue = { $set: mailConfigs };

                        MailNotification.updateMailNotificationConfig(query, newValue, (err, result) => {
                            if (err) {
                                console.log(`[${context}][updateNotificationsConfig] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result) {
                                    resolve({ auth: false, code: 'notification_configuration_updated', message: "Notification configurations updated" });
                                }
                                else {
                                    reject({ auth: false, code: 'notification_configuration_not_updated', message: "Notification configurations not updated" });
                                }
                            }
                        });

                    }
                    else {
                        let notificationConfig = new MailNotification(mailConfigs);

                        MailNotification.createMailNotificationConfig(notificationConfig, (err, result) => {
                            if (err) {
                                console.log(`[${context}][createNotificationsConfig] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result) {
                                    resolve({ auth: false, code: 'notification_configuration_created', message: "Notification configurations created" });
                                }
                                else {
                                    reject({ auth: false, code: 'notification_configuration_not_created', message: "Notification configurations not created" });
                                }
                            }
                        });

                    }
                }
            });

        });
    },
    getMailNotification: function (req) {
        let context = "Funciton getMailNotification";
        return new Promise((resolve, reject) => {

            let clientName = req.headers['clientname'];

            console.log("clientName", clientName);

            MailNotification.findOne({ clientName: clientName }, (err, configsFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err)
                }
                else {
                    if (configsFound) {
                        resolve(configsFound);
                    }
                    else {
                        reject({ auth: false, code: 'notification_configuration_not_found', message: "Notification configurations not found" });
                    }
                }
            });
        });
    },

    deleteMailNotification: function (req) {
        let context = "Funciton deleteMailNotification";
        return new Promise((resolve, reject) => {

            MailNotification.findOneAndDelete({}, (err, configsFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err)
                }
                else {
                    if (configsFound) {
                        resolve({ auth: true, code: 'notifications_configuration_deleted', message: "Notifications configuration deleted" });
                    } else {
                        reject({ auth: true, code: 'notifications_configuration_not_deleted', message: "Notifications configuration not deleted" });
                    }
                }
            });

        });
    },
}
