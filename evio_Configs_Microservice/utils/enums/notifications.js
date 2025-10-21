const notificationTypesEnum = {
    CHARGER_AVAILABLE_NOTIFY_ME: "CHARGER_AVAILABLE_NOTIFY_ME"
}

const notificationSettingsEnum = [    {
    "type": "ChargingPoints",
    "notificationType": "CHARGING_SESSION_START",
    "translationKey": "notifications_startingSession",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "CHARGING_SESSION_STOP",
    "translationKey": "notifications_endingSession",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "CHARGING_SESSION_DATA",
    "translationKey": "notifications_sessionDataUpdate",
    "enabled": false
},
{
    "type": "ChargingPoints",
    "notificationType": "MY_CHARGERS_CHARGING_SESSION_START",
    "translationKey": "notifications_startingSessionOnMyCp",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "MY_CHARGERS_CHARGING_SESSION_STOP",
    "translationKey": "notifications_endingSessionOnMyCp",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "CHARGING_SESSION_STOP_MISSING_PAYMENT",
    "translationKey": "notifications_advanceNoticeOfSessionEnding",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "CHARGING_SESSION_EV_NOT_CHARGING",
    "translationKey": "notifications_evNotCharging",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "CHARGING_SESSION_EV_CHARGING",
    "translationKey": "notifications_evCharging",
    "enabled": true
},
{
    "type": "ChargingPoints",
    "notificationType": "CHARGER_AVAILABLE_NOTIFY_ME",
    "translationKey": "notifications_notifyWhenCpBecomesAvailable",
    "enabled": true
},
{
    "type": "Account",
    "notificationType": "ACCOUNT_SUSPENSION",
    "translationKey": "notifications_accountSuspension",
    "enabled": true
},
{
    "type": "Account",
    "notificationType": "ACCOUNT_REACTIVATION",
    "translationKey": "notifications_accountReactivation",
    "enabled": true
},
{
    "type": "Account",
    "notificationType": "ACCOUNT_LOW_BALANCE",
    "translationKey": "notifications_lowBalance",
    "enabled": true
},
{
    "type": "Account",
    "notificationType": "NEWS",
    "translationKey": "notifications_news",
    "enabled": true
},
{
    "type": "Account",
    "notificationType": "SERVER_RFID_BLOCKED",
    "translationKey": "notifications_server_rfid_blocked",
    "enabled": true
},
{
    "type": "Account",
    "notificationType": "SERVER_RFID_UNLOCKED",
    "translationKey": "notifications_server_rfid_unlocked",
    "enabled": true
},
{
    "type": "MarketingAndPromotions",
    "notificationType": "notifications_license_information_products_text",
    "translationKey": "licenseInformationProductsServicesNotification",
    "enabled": false
},
{
    "type": "MarketingAndPromotions",
    "notificationType": "notifications_license_promotion_products_text",
    "translationKey": "licensePromotionsProductsServicesNotification",
    "enabled": false
},
{
    "type": "MarketingAndPromotions",
    "notificationType": "notifications_license_partner_products_text",
    "translationKey": "licensePartnersProductsServicesNotification",
    "enabled": false
}];


const notificationSettingsACPEnum = [
    ...notificationSettingsEnum,
    {
        "type": "Account",
        "notificationType": "ACCOUNT_VALID_PARTNER",
        "translationKey": "notifications_partner",
        "enabled": true
    }
]


const notificationsGeneralEnum = {
    marketingAndPromotionsType: "MarketingAndPromotions",
    licenseServicesType: "notification_licenseServices",
    licenseProductsType: "notification_licenseProducts",
    licenseMarketingType: "notification_licenseMarketing",
    unsubscribedLinkDefault: 'https://legal.go-evio.com/unsubscribe/',
    licenseServicesTypeKey: "notification_licenseServices_text",
    licenseProductsTypeKey: "notification_licenseProducts_text",
    licenseMarketingTypeKey: "notification_licenseMarketing_text"
}

module.exports = {notificationSettingsEnum, notificationSettingsACPEnum, notificationsGeneralEnum, notificationTypesEnum }