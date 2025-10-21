require("dotenv-safe").load();
const { findUsersByIds } = require('evio-library-identity').default;
const { updateLicensePreferences } = require('../services/identity');

const axios = require("axios");
const NotificationsSettings = require('../models/notificationsSettings');
const appConfigOperations = require('../models/appConfigurations');
const { notificationSettingsEnum, notificationSettingsACPEnum, notificationsGeneralEnum, notificationTypesEnum } = require('../utils/enums/notifications');

module.exports = {
    addNotificationsSettings: function (req) {
        let context = "Funciton addNotificationsSettings";
        return new Promise((resolve, reject) => {

            let notificationsSettings = new NotificationsSettings();
            let body = req.body;
            let notificationsPref;
            let clientTypeAndroid;
            let clientTypeiOS;
            let clientTypeBackOffice;

            //if (body.clientName === process.env.clientNameEVIO) {
            clientTypeAndroid = process.env.ClientAndroid
            clientTypeiOS = process.env.ClientIOS
            clientTypeBackOffice = process.env.ClientWeb
            /*} else {
                clientTypeAndroid = process.env.ClientAndroid + "-" + clientNameMapping[body.clientName]
                clientTypeiOS = process.env.ClientIOS + "-" + clientNameMapping[body.clientName]
                clientTypeBackOffice = process.env.ClientWeb + "-" + clientNameMapping[body.clientName]
            }*/
            if (body.clientName === process.env.clientNameACP) {
                notificationsPref = [
                    {
                        clientType: clientTypeAndroid,
                        global: {
                            translationKey: "notifications_pushNotifications",
                            enabled: true
                        },
                        notifications: notificationSettingsACPEnum
                    },
                    {
                        clientType: clientTypeiOS,
                        global: {
                            translationKey: "notifications_pushNotifications",
                            enabled: true
                        },
                        notifications: notificationSettingsACPEnum
                    },
                    {
                        clientType: clientTypeBackOffice,
                        global: {
                            translationKey: "notifications_pushNotifications",
                            enabled: true
                        },
                        notifications: notificationSettingsACPEnum
                    }
                ];
            } else {
                notificationsPref = [
                    {
                        clientType: process.env.ClientAndroid,
                        global: {
                            translationKey: "notifications_pushNotifications",
                            enabled: true
                        },
                        notifications: notificationSettingsEnum
                    },
                    {
                        clientType: process.env.ClientIOS,
                        global: {
                            translationKey: "notifications_pushNotifications",
                            enabled: true
                        },
                        notifications: notificationSettingsEnum
                    },
                    {
                        clientType: process.env.ClientWeb,
                        global: {
                            translationKey: "notifications_pushNotifications",
                            enabled: true
                        },
                        notifications: notificationSettingsEnum
                    }
                ];
            }

            notificationsSettings.userId = body.userId;
            notificationsSettings.notificationsPref = notificationsPref;
            notificationsSettings.clientName = body.clientName;

            var query = {
                userId: body.userId
            };

            notificationsSettingsFindOne(query)
                .then((result) => {
                    if (!result) {
                        notificationsSettingsCreate(notificationsSettings)
                            .then((result) => {
                                resolve(result);
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            });
                    }
                    else {
                        console.log("Settings already exist")
                        reject({ auth: false, code: 'settings_already_exist', message: 'Settings already exists' });
                    }
                })
                .catch((error) => {
                    console.error(`[] Error`, error.message);
                    reject(error);
                });

        });
    },
    getNotificationsSettings: async function (req) {
        let context = "Function getNotificationsSettings";

        try {
            const { userid: userId, client: clientType, clientname: clientName } = req.headers;


            if(!clientType){
                throw({ auth: false, code: 'client_type_null', message: 'Client type null' });
            }
            let clientTypeFinal = clientType.split("-");
    
            let query = {
                userId: userId,
                notificationsPref: {
                    $elemMatch: {
                        clientType: clientTypeFinal[0]
                    }
                }
            };
            let notificationsSettingsFound = await notificationsSettingsFindOne(query);    
            if (notificationsSettingsFound) {
                let settings = notificationsSettingsFound.notificationsPref.find(x => x.clientType === clientTypeFinal[0]);
    
                if (settings) {
                    settings.userId = notificationsSettingsFound.userId;
    
                    let history = await notifyMeUserList(userId);
                    let notifyMeChargers = [];

                    history.map(charger => {
                        let chargerInfo = {
                            name: charger.name,
                            imageContent: charger.imageContent,
                            hwId: charger.hwId,
                            plugId: charger.plugId
                        };
                        notifyMeChargers.push(chargerInfo);
                    });
    
                    let index = settings.notifications.findIndex(x => x.notificationType === notificationTypesEnum.CHARGER_AVAILABLE_NOTIFY_ME);
                    if (index !== -1) {
                        settings.notifications[index].chargers = notifyMeChargers;
                    }

                    // Get the app config
                    const appConfig = await appConfigOperations.getAppConfigsWithClientName(clientName, { marketingAndPromotionNotifications: 1 });

                    if (appConfig.length === 0) {
                        throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
                    }

                    const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled } = appConfig[0].marketingAndPromotionNotifications;

                    // Remove the marketing and promotions notification if it exists
                    settings.notifications = settings.notifications.filter(x => x.type !== notificationsGeneralEnum.marketingAndPromotionsType);

                    // If all notifications are disabled, return
                    if (!licenseServiceEnabled && !licenseProductEnabled && !licenseMarketingEnabled) {
                        return settings
                    }

                    // findoneuser in shared microservice
                    const [user] = await findUsersByIds([userId]);

                    if (!user) {
                        throw { auth: false, code: 'user_not_found', message: 'User not found' };
                    }

                    // Add the marketing and promotions notification
                    // The app needs the _id parameter to handle the toggles
                    if (licenseServiceEnabled) {
                        settings.notifications.push({
                            _id: "1",
                            type: notificationsGeneralEnum.marketingAndPromotionsType,
                            enabled: user.licenseServices || false,
                            notificationType: notificationsGeneralEnum.licenseServicesType,
                            translationKey: notificationsGeneralEnum.licenseServicesTypeKey,
                        });
                    }

                    if (licenseProductEnabled) {
                        settings.notifications.push({
                            _id: "2",
                            type: notificationsGeneralEnum.marketingAndPromotionsType,
                            enabled: user.licenseProducts || false,
                            notificationType: notificationsGeneralEnum.licenseProductsType,
                            translationKey: notificationsGeneralEnum.licenseProductsTypeKey,
                        });
                    }

                    if (licenseMarketingEnabled) {
                        settings.notifications.push({
                            _id: "3",
                            type: notificationsGeneralEnum.marketingAndPromotionsType,
                            enabled: user.licenseMarketing || false,
                            notificationType: notificationsGeneralEnum.licenseMarketingType,
                            translationKey: notificationsGeneralEnum.licenseMarketingTypeKey,
                        });
                    }

                    return settings;
                } else {
                    throw { auth: false, code: 'settings_not_available', message: 'Settings not available' };
                }
            } else {
                let query = {
                    userId: userId
                };
    
                let newNotificationsPref = {
                    clientType: clientTypeFinal[0],
                    global: {
                        translationKey: "notifications_pushNotifications",
                        enabled: true
                    },
                    notifications: clientName === process.env.clientNameACP ? notificationSettingsACPEnum : notificationSettingsEnum
                };
    
                var newValues = {
                    $push: { notificationsPref: newNotificationsPref }
                };
    
                let result = await notificationsSettingsUpdate(query, newValues);
    
                if (result) {
                    let settings = result.notificationsPref.find(x => x.clientType === clientTypeFinal[0]);
    
                    if (settings) {
                        settings = JSON.parse(JSON.stringify(settings));
                        settings.userId = result.userId;
    
                        let history = await notifyMeUserList(userId);
                        let notifyMeChargers = [];
                        history.map(charger => {
                            let chargerInfo = {
                                name: charger.name,
                                imageContent: charger.imageContent,
                                hwId: charger.hwId,
                                plugId: charger.plugId
                            };
                            notifyMeChargers.push(chargerInfo);
                        });
    
                        let index = settings.notifications.findIndex(x => x.notificationType === notificationTypesEnum.CHARGER_AVAILABLE_NOTIFY_ME);
                        if (index !== -1) {
                            settings.notifications[index].chargers = notifyMeChargers;
                        }
    
                        return settings;
                    } else {
                        throw { auth: false, code: 'settings_not_available', message: 'Settings not available' };
                    }
                } else {
                    throw { auth: false, code: 'settings_not_available', message: 'Settings not available' };
                }
            }
        } catch (error) {
            console.error(`[${context}][getNotificationsSettings] Error `, error.message);
            throw error;
        }
    },
    checkUserNotificationSettings: function (req) {
        let context = "Funciton checkUserNotificationSettings";
        return new Promise((resolve, reject) => {

            let userId = req.query.userId;
            let notificationType = req.query.notificationType;

            let query = {
                userId: userId
            };

            notificationsSettingsFindOne(query)
                .then((notificationsSettingsFound) => {

                    let devicesToNotify = [];
                    //console.log("notificationsSettingsFound", notificationsSettingsFound)
                    if (notificationsSettingsFound) {

                        notificationsSettingsFound = JSON.parse(JSON.stringify(notificationsSettingsFound));
                        notificationsSettingsFound.notificationsPref.forEach(preference => {
                            console.log("preference.global", preference.global);
                            if (!preference.global) {

                                let notification = preference.notifications.find(i => i.notificationType === notificationType);

                                if (notification) {
                                    if (notification.enabled) {
                                        if (!devicesToNotify.includes(preference.clientType)) {
                                            devicesToNotify.push(preference.clientType);
                                        }

                                    }
                                }

                            } else if (preference.global.enabled) {

                                let notification = preference.notifications.find(i => i.notificationType === notificationType);

                                if (notification) {
                                    if (notification.enabled) {
                                        if (!devicesToNotify.includes(preference.clientType)) {
                                            devicesToNotify.push(preference.clientType);
                                        }

                                    }
                                }

                            }

                        });

                        Promise.all([]).then(() => {
                            console.log(`[${context}] 1 - `, devicesToNotify)
                            resolve(devicesToNotify);
                        });

                    }
                    else {
                        console.log(`[${context}] 2 - `, devicesToNotify)
                        reject(devicesToNotify);
                    }

                })
                .catch((error) => {
                    console.error(`[${context}][notificationsSettingsFindOne] Error `, error.message);
                    reject(error);
                });
        });
    },
    deleteNotificationsSettings: function (req) {
        let context = "Funciton deleteNotificationsSettings";
        return new Promise((resolve, reject) => {

            let body = req.body;
            let query = {
                userId: body.userId
            };

            notificationsSettingsRemove(query)
                .then((result) => {
                    resolve(result);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error)
                });

        });
    },
    updateNotificationsSettings: async function (req) {
        let context = 'Function updateNotificationsSettings';
        try {
            let received = req.body;
            const clientName = req.headers['clientname'];

            if (!received.clientType) throw({ auth: false, code: 'client_type_null', message: 'Client type null' });

            let clientType = received.clientType.split('-');

            let query = {
                userId: received.userId,
                notificationsPref: {
                    $elemMatch: {
                        clientType: clientType,
                    },
                },
            };

            // Get the app config
            const appConfig = await appConfigOperations.getAppConfigsWithClientName(clientName, { marketingAndPromotionNotifications: 1 });

            if (appConfig.length === 0) {
                throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
            }

            const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled } = appConfig[0].marketingAndPromotionNotifications;

            const userLicensePreferences = {
                licenseServices: licenseServiceEnabled ? received.notifications?.find(x => x.notificationType === notificationsGeneralEnum.licenseServicesType)?.enabled || false : undefined,
                licenseProducts: licenseProductEnabled ? received.notifications?.find(x => x.notificationType === notificationsGeneralEnum.licenseProductsType)?.enabled || false : undefined,
                licenseMarketing: licenseMarketingEnabled ? received.notifications?.find(x => x.notificationType === notificationsGeneralEnum.licenseMarketingType)?.enabled || false : undefined,
            };

            // If any of the notifications is enabled, save all notifications in user's collection
            if (licenseServiceEnabled || licenseProductEnabled || licenseMarketingEnabled) {
                console.log(`[${context}] Updating user license preferences for userId: ${received.userId}`);
                await updateLicensePreferences(received.userId, userLicensePreferences);
            }

            // Remove all notifications that are not in the generalNotificationTypes
            let deviceNotifications = received.notifications?.filter(x => x.type !== notificationsGeneralEnum.marketingAndPromotionsType) || [];

            let currentNotificationSettings = (await notificationsSettingsFindOne(query)).notificationsPref[0] || [];     
            currentNotificationSettings = currentNotificationSettings?.notifications.filter(x => x.type !== notificationsGeneralEnum.marketingAndPromotionsType) || [];

            let newNotifications=[];

            // Percorre todas as preferências de notificação no currentNotificationSettings
            for await (const pref of currentNotificationSettings) {
                const deviceNotif = deviceNotifications.find(deviceNotif => deviceNotif.notificationType === pref.notificationType); 
                // Se encontrou uma correspondência, atualiza o valor enabled               
                if (deviceNotif) {
                    pref.enabled = deviceNotif.enabled;
                    newNotifications.push(pref);
                } 
            }
            
            let newNotificationsSettings = {
                $set: {
                    'notificationsPref.$.global': {
                        translationKey: currentNotificationSettings?.global?.translationKey || "notifications_pushNotifications",
                        enabled: received?.global?.enabled || true
                    },
                    'notificationsPref.$.notifications': newNotifications,
                },
            };            
            const result = await notificationsSettingsUpdate(query, newNotificationsSettings);

            if (result) {
                const chargerNotification = received.notifications.filter(
                    (x) => x.notificationType === notificationTypesEnum.CHARGER_AVAILABLE_NOTIFY_ME
                  )[0];
                  
                  if (chargerNotification) {
                    await removeUserChargerNotification(received.userId, chargerNotification.chargers);
                  }

                return { auth: true, code: 'settings_updated_with_success', message: 'Settings updated with success' };
            } else {
                throw { auth: false, code: 'settings_not_available', message: 'Settings not available' };
            }
        } catch (error) {
            console.error(`[${context}][notificationsSettingsUpdate] Error `, error.message);
            return error;
        }
    },
    removeUserChargerNotification: function (req) {
        let context = "Funciton removeUserChargerNotification";
        return new Promise((resolve, reject) => {
            var host = process.env.HostNotifications + process.env.PathRemoveChargerFromNotifyMe;

            let headers = {
                userid: req.headers['userid']
            }

            let body = {
                hwId: req.body.hwId,
                plugId: req.body.plugId
            }

            axios.patch(host, body, { headers })
                .then((result) => {
                    let history = result.data;
                    console.log(history);
                    resolve({ auth: false, code: 'charger_notification_removed', message: 'Charger notification removed' });
                })
                .catch((error) => {
                    console.log(error.message);
                    reject({ auth: false, code: 'charger_notification_not_removed', message: 'Charger notification not removed' });
                });
        });
    },
    setupNotifications: function (req) {
        let context = "Funciton setupNotifications";
        return new Promise((resolve, reject) => {

            var host = process.env.HostUsers + process.env.PathUsers;

            axios.get(host, {})
                .then((result) => {
                    var users = result.data;
                    users.map(user => {
                        var query = {
                            userId: user._id
                        };
                        notificationsSettingsFindOne(query)
                            .then((result) => {
                                if (!result) {

                                    var notificationsDefinition = new NotificationsSettings();

                                    var notificationsPref = [
                                        {
                                            clientType: process.env.ClientAndroid,
                                            global: {
                                                translationKey: "notifications_pushNotifications",
                                                enabled: true
                                            },
                                            notifications: notificationSettingsEnum
                                        },
                                        {
                                            clientType: process.env.ClientIOS,
                                            global: {
                                                translationKey: "notifications_pushNotifications",
                                                enabled: true
                                            },
                                            notifications: notificationSettingsEnum
                                        },
                                        {
                                            clientType: process.env.ClientWeb,
                                            global: {
                                                translationKey: "notifications_pushNotifications",
                                                enabled: true
                                            },
                                            notifications: notificationSettingsEnum
                                        }
                                    ];

                                    notificationsDefinition.userId = user._id;
                                    notificationsDefinition.notificationsPref = notificationsPref;

                                    notificationsSettingsCreate(notificationsDefinition)
                                        .then((result) => {
                                            console.log("Result notifications definition created");
                                            resolve('OK');
                                        })
                                        .catch((error) => {
                                            console.error(`[] Error `, error.message);
                                            reject(error);
                                        });
                                };
                            })
                            .catch((error) => {
                                console.error(`[] Error`, error.message);
                                reject(error);
                            });
                    });

                })
                .catch((error) => {
                    console.error(`[] Error `, error.message);
                    reject(error);
                });
        });
    },
    addEnergyConsumptionEndOfChargingNotification: function (req) {
        let context = "Funciton addEnergyConsumptionEndOfChargingNotification";
        return new Promise((resolve, reject) => {

            let { notificationType, translationKey } = req.body

            if (!notificationType) return reject("Missing notificationType")
            if (!translationKey) return reject("Missing translationKey")
            notificationsSettingsAll({})
                .then(async (notificationsSettingsFound) => {

                    if (notificationsSettingsFound.length > 0) {


                        for (let notificationsSettings of notificationsSettingsFound) {
                            let { userId, notificationsPref } = notificationsSettings

                            for (let preference of notificationsPref) {
                                let notification = {
                                    "type": "ChargingPoints",
                                    "notificationType": notificationType,
                                    "translationKey": translationKey,
                                    "enabled": preference.global.enabled ? true : false
                                }
                                let query = {
                                    userId,
                                    "notificationsPref.clientType": preference.clientType
                                }
                                let foundNotification = preference.notifications.find(obj => obj.notificationType === notification.notificationType)
                                if (!foundNotification) {
                                    await NotificationsSettings.updateOne(query, { $push: { "notificationsPref.$.notifications": notification } })
                                }

                            }
                        }
                        resolve("OK")

                    }
                    else {
                        resolve("No sessions found");
                    }

                })
                .catch((error) => {
                    console.error(`[${context}][notificationsSettingsFindOne] Error `, error.message);
                    reject(error);
                });
        });
    },
    runFirstTime: async function (req) {
        const context = "Function runFirstTime";
    
        try {
            const { notificationsToUpdate = 5000, offset = 0 } = req.query;
            const { notificationsArray, notificationsArrayRemove } = req.body;
    
            await Promise.all([
                addNewNotification(notificationsArray, notificationsToUpdate, offset),
                removeOldNotification(notificationsArrayRemove, notificationsToUpdate, offset)
            ]);
    
            return { message: `Successfully updated ${notificationsToUpdate} records with offset ${offset}` };
        } catch (error) {
            console.error(`[${context}] Error:`, error.message);
            throw error;
        }
    },
    removeOldNotification,
    addNewNotification,
    notifyMeUserList
};
//========== FUNCTION ==========

function notificationsSettingsFindOne(query) {
    const context = "Function notificationsDefinitionFindOne";
    return new Promise((resolve, reject) => {
        NotificationsSettings.findOne(query).lean().exec((err, notificationsDefinitionFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(notificationsDefinitionFound);
            };
        });
    });
};

function notificationsSettingsAll(query) {
    var context = "Function notificationsSettingsAll";
    return new Promise((resolve, reject) => {
        NotificationsSettings.find(query, (err, notificationsDefinitionFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(notificationsDefinitionFound);
            };
        });
    });
};

function notificationsSettingsCreate(notificationsSettings) {
    var context = "Function notificationsSettingsCreate";
    return new Promise((resolve, reject) => {
        NotificationsSettings.createNotificationsDefinition(notificationsSettings, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function notifyMeUserList(userId) {
    var context = "Function notifyMeUserList";
    return new Promise((resolve, reject) => {

        var host = process.env.HostNotifications + process.env.PathNotifyMeUserList;

        let headers = {
            userid: userId
        }

        axios.get(host, { headers })
            .then((result) => {
                let history = result.data;
                resolve(history);
            })
            .catch((error) => {
                console.error(`[] Error `, error.message);
            });

    });
}

function notificationsSettingsUpdate(query, newValues) {
    var context = "Function notificationsSettingsUpdate";
    return new Promise((resolve, reject) => {
        NotificationsSettings.updateNotificationsDefinitionAndReturns(query, newValues, { new: true }, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function notificationsSettingsRemove(query) {
    var context = "Function notificationsDefinitionRemove";
    return new Promise((resolve, reject) => {
        NotificationsSettings.removeNotificationsDefinition(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
}

function removeUserChargerNotification(userId, chargers) {
    return new Promise(async (resolve, reject) => {

        let chargersNotificationsToRemove = [];

        let history = await notifyMeUserList(userId);

        history.forEach(charger => {
            let index = chargers.findIndex(x =>
                x.hwId === charger.hwId && x.plugId === charger.plugId);

            if (index < 0) {
                chargersNotificationsToRemove.push(charger);
            }
        });

        Promise.all([]).then(() => {

            if (chargersNotificationsToRemove.length !== 0) {

                chargersNotificationsToRemove.forEach(charger => {

                    var host = process.env.HostNotifications + process.env.PathRemoveChargerFromNotifyMe;

                    let headers = {
                        userid: userId
                    }

                    let body = {
                        hwId: charger.hwId,
                        plugId: charger.plugId
                    }

                    axios.patch(host, body, { headers })
                        .then((result) => {
                            console.log("Charger removed from NotifyMe list");
                        })
                        .catch((error) => {
                            console.log(error.message);
                        });
                });

                Promise.all([]).then(() => {
                    console.log("End");
                    resolve(true);
                });

            }
            else {
                resolve(false)
            }

        });

    });
}

//updateNotificationsConfigs();
async function updateNotificationsConfigs() {
    const context = "Function updateNotificationsConfigs";
    try {

        let notificationsFound = await NotificationsSettings.find({});

        console.log("notificationsFound.length", notificationsFound.length);
        if (notificationsFound.length > 0) {
            notificationsFound.forEach(notification => {

                let notificationsPref;
                let clientTypeAndroid;
                let clientTypeiOS;
                let clientTypeBackOffice;

                // if (notification.clientName === process.env.clientNameEVIO) {
                clientTypeAndroid = process.env.ClientAndroid
                clientTypeiOS = process.env.ClientIOS
                clientTypeBackOffice = process.env.ClientWeb
                /*} else {
                    clientTypeAndroid = process.env.ClientAndroid + "-" + clientNameMapping[notification.clientName]
                    clientTypeiOS = process.env.ClientIOS + "-" + clientNameMapping[notification.clientName]
                    clientTypeBackOffice = process.env.ClientWeb + "-" + clientNameMapping[notification.clientName]
                }*/

                if (notification.clientName === process.env.clientNameACP) {
                    notificationsPref = [
                        {
                            clientType: clientTypeAndroid,
                            global: {
                                translationKey: "notifications_pushNotifications",
                                enabled: true
                            },
                            notifications: notificationSettingsACPEnum
                        },
                        {
                            clientType: clientTypeiOS,
                            global: {
                                translationKey: "notifications_pushNotifications",
                                enabled: true
                            },
                            notifications: notificationSettingsACPEnum
                        },
                        {
                            clientType: clientTypeBackOffice,
                            global: {
                                translationKey: "notifications_pushNotifications",
                                enabled: true
                            },
                            notifications: notificationSettingsACPEnum
                        }
                    ];
                } else {
                    notificationsPref = [
                        {
                            clientType: process.env.ClientAndroid,
                            global: {
                                translationKey: "notifications_pushNotifications",
                                enabled: true
                            },
                            notifications: notificationSettingsEnum
                        },
                        {
                            clientType: process.env.ClientIOS,
                            global: {
                                translationKey: "notifications_pushNotifications",
                                enabled: true
                            },
                            notifications: notificationSettingsEnum
                        },
                        {
                            clientType: process.env.ClientWeb,
                            global: {
                                translationKey: "notifications_pushNotifications",
                                enabled: true
                            },
                            notifications: notificationSettingsEnum
                        }
                    ];
                }

                NotificationsSettings.findOneAndUpdate({ _id: notification._id }, { $set: { notificationsPref: notificationsPref } }, { new: true }, (err, notificationUpdated) => {
                    if (err) {
                        console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                    };
                    console.log("Notification Updated")
                });

            })
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

/**
 * Adds new notifications to existing user notification preferences in batches.
 * 
 * This function processes notifications in batches to handle large datasets.
 * It compares existing notifications with new ones to be added, avoiding duplicates.
 * 
 * @async
 * @param {Array} notificationsToAdd - Array of new notification objects to add.
 * @param {number} totalRecordsToProcess - Total number of records to process.
 * @param {number} startingOffset - Starting offset for batch processing.
 * 
 * @throws {Error} If an error occurs during the notification addition process.
 */
async function addNewNotification(notificationsToAdd, totalRecordsToProcess, startingOffset) {
    const context = 'addNewNotifications';

    try {
        let currentBatchStartIndex = parseInt(startingOffset);
        const recordsToProcess = parseInt(totalRecordsToProcess) + currentBatchStartIndex;
        let batchSize = Math.min(500, recordsToProcess);
        console.log(notificationsToAdd)
        while (currentBatchStartIndex < recordsToProcess) {
            const batchEndIndex = Math.min(currentBatchStartIndex + batchSize, recordsToProcess);
            const fetchedUserNotifications = await NotificationsSettings.find({}, {}, { skip: currentBatchStartIndex, limit: batchSize });

            const updateOperations = [];

            if (fetchedUserNotifications.length > 0) {
                const notificationUpdates = fetchedUserNotifications.flatMap(userNotification => {
                    const newNotifications = notificationsToAdd.filter(newNotification => {
                        return !userNotification.notificationsPref.some(pref => 
                            pref.notifications.some(commonNotification => 
                                commonNotification.translationKey === newNotification.translationKey
                            )
                        );
                    });

                    if (newNotifications.length > 0) {
                        userNotification.notificationsPref.forEach(pref => {
                            pref.notifications.push(...newNotifications);
                        });

                        return [{
                            updateOne: {
                                filter: { _id: userNotification._id },
                                update: { $set: { notificationsPref: userNotification.notificationsPref } }
                            }
                        }];
                    }

                    return [];
                });

                updateOperations.push(...notificationUpdates);
            }
            if(updateOperations.length>0){
            await NotificationsSettings.bulkWrite(updateOperations);
            }
            console.log(`[${context}]  Processed batch ${currentBatchStartIndex} to ${batchEndIndex}`);
            currentBatchStartIndex = batchEndIndex;
        }

        console.log('All batches processed successfully');
    } catch (error) {
        console.error(`[${context}] Error: ${error.message}`);
        throw error;
    }
}


/**
 * Removes old notifications from existing user notification preferences in batches.
 * 
 * This function processes notifications in batches to handle large datasets.
 * It compares existing notifications with old ones to be removed, ensuring no data loss.
 * 
 * @async
 * @param {Array} notificationsToRemove - Array of old notification objects to remove.
 * @param {number} totalRecordsToProcess - Total number of records to process.
 * @param {number} startingOffset - Starting offset for batch processing.
 * 
 */
async function removeOldNotification(notificationsToRemove, totalRecordsToProcess, startingOffset) {
    const context = 'RemoveOldNotifications';
    
    try {
        let currentBatchStartIndex = parseInt(startingOffset);
        const recordsToProcess = parseInt(totalRecordsToProcess) + currentBatchStartIndex;
        let batchSize = Math.min(500, recordsToProcess);
        
        while (currentBatchStartIndex < recordsToProcess) {
            const batchEndIndex = Math.min(currentBatchStartIndex + batchSize, recordsToProcess);
            
            // Fetch existing notifications for this batch
            const fetchedUserNotifications = await NotificationsSettings.find({}, {}, { skip: currentBatchStartIndex, limit: batchSize });
            
            const updateOperations = [];
            
            if (fetchedUserNotifications.length > 0) {
                const notificationUpdates = fetchedUserNotifications.flatMap(userNotification => {
                    const oldNotifications = notificationsToRemove.filter(oldNotification => 
                        userNotification.notificationsPref.some(pref => 
                            pref.notifications.some(commonNotification => 
                                commonNotification.translationKey === oldNotification.translationKey
                            )
                        )
                    );
                
                    if (oldNotifications.length > 0) {
                        userNotification.notificationsPref.forEach(pref => {
                            pref.notifications = pref.notifications.filter(notification => 
                                !oldNotifications.some(oldNotification => 
                                    oldNotification.translationKey === notification.translationKey
                                )
                            );
                        });
                        
                        return [{
                            updateOne: {
                                filter: { _id: userNotification._id },
                                update: { $set: { notificationsPref: userNotification.notificationsPref } }
                            }
                        }];
                    }
                    
                    return [];
                });
                
                updateOperations.push(...notificationUpdates);
            }
       
            if(updateOperations.length>0){
                await NotificationsSettings.bulkWrite(updateOperations);
                }
            
            console.log(`[${context}] Processed batch ${currentBatchStartIndex} to ${batchEndIndex}`);
            currentBatchStartIndex = batchEndIndex;
        }
        
        console.log('All batches processed successfully');
    } catch (error) {
        console.error(`[${context}] Error: ${error.message}`);
        throw error;
    }
}