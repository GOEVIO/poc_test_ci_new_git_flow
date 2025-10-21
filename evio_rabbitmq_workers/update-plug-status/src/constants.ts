import * as dotenv from "dotenv";
dotenv.config();

export const teamsWebhookUrl =
  "https://goeviocom.webhook.office.com/webhookb2/45886307-9d1b-4d9f-baf8-27e6d10277ac@f676247a-5860-4d95-864a-f36d4e2fb07c/IncomingWebhook/f3bd334e556b4fde9e27e092b8a01d51/4b281e34-c80c-45d8-b6a8-2ead11e27ecb";
export const updatePlugStatusRabbitmqQueue =
  process.env.RABBITMQ_QUEUE_UPDATE_PLUG_STATUS || "";
export const hostNotifications = String(process.env.HostNotifications);
export const pathNotificationToUser = String(
  process.env.PathNotificationToUser
);
export const hostNotificationsFirebaseWL = String(
  process.env.HostNotificationsFirebaseWL
);
export const PlugStatusAvailable = String(process.env.PlugStatusAvailable);
export const databaseNames = {
  ev: "evsDB",
  notifications: "notificationsDB",
  chargers: "chargersDB",
  publicNetwork: "publicNetworkDB",
};

export const MAX_SIMULTANEOUSLY_MESSAGES =
  Number(process.env.MAX_SIMULTANEOUSLY_MESSAGES) || 2;
