import mqConnection from "evio-rabbitmq-connection/dist/src/rabbitmq-connection";
import {
  MAX_SIMULTANEOUSLY_MESSAGES,
  PlugStatusAvailable,
  databaseNames,
  teamsWebhookUrl,
  updatePlugStatusRabbitmqQueue,
} from "./constants";
import evioLibraryNotifications from "evio-library-notifications";
const { notifyChargerAvailable } = evioLibraryNotifications;

import * as dotenv from "dotenv";
dotenv.config();
import { MongoClient } from "mongodb";

const customOutput =
  (err = false) =>
  (...args) => {
    const formattedArgs = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
      .join(" ");
    if (err) {
      process.stderr.write(`${formattedArgs}\n`);
      return;
    }
    process.stdout.write(`${formattedArgs}\n`);
  };
console.log = customOutput();
console.info = customOutput();
console.warn = customOutput();
console.error = customOutput(true);

// Replace the uri string with your MongoDB deployment's connection string.
const uri = String(process.env.DB_URI).replace(
  "{database}",
  databaseNames.publicNetwork
);
const client = new MongoClient(uri);

const notifyUsersAboutAvailableCharger = (hwId: string, plugId: string) => {
  var context = `Function notifyUsersAboutAvailableCharger ${JSON.stringify({
    hwId,
    plugId,
  })}`;
  const collection = client
    .db(databaseNames.notifications)
    .collection("notifymehistories");

  var filter = {
    hwId: hwId,
    plugId: plugId,
    active: true,
  };

  collection
    .findOne(filter)
    .then(async (notifymeHistoryFound) => {
      if (notifymeHistoryFound) {
        await sendNotificationToUsers(notifymeHistoryFound.listOfUsers, hwId);

        collection
          .updateMany(filter, { $set: { active: false } })
          .then((result) => {
            if (result.modifiedCount) {
              console.log(`[${context}][notifymeHistoryUpdate]`, {
                detail: "Update Successfully",
              });
            } else {
              console.log(`[${context}][notifymeHistoryUpdate]`, {
                detail: "Update Unsuccessfully",
              });
            }
          })
          .catch((error) => {
            console.log(`[${context}][notifymeHistoryUpdate] Error `, error);
            throw error;
          });
      } else {
        console.log(`[${context}][notifymeHistoryUpdate]`, {
          detail: "Notification not found for given parameters",
        });
      }
    })
    .catch((error) => {
      console.log(`[${context}][notifymeHistoryFindOne] Error `, error.message);
      throw error;
    });
};

async function sendNotificationToUsers(listOfUsers, hwId) {
  var context = "Function sendNotificationToUsers";
  const promises = listOfUsers.map((userI) =>
    notifyChargerAvailable(hwId, userI.userId)
  );
  await Promise.allSettled(promises).catch((errors) =>
    errors.forEach((error) =>
      console.error(`[${context}] Error`, error.message)
    )
  );
}

const handleIncomingMessage = async (message: {
  hwId: string;
  type: "EVIO" | "PUBLIC_NETWORKS";
  evse_uid: string;
  source: string;
  status: string;
  subStatus: string;
}) => {
  const context = "Update Plug Status Worker";
  try {
    const { hwId, evse_uid, type, status, subStatus, source } = message;
    const query = {
      hwId,
      source,
      plugs: { $elemMatch: { uid: evse_uid, status: { $ne: status } } },
    };
    // console.log(`[${context}] Incoming Message`, {hwId, evse_uid, type, status, subStatus, source});
    const collection = client
      .db(databaseNames.publicNetwork)
      .collection("chargers");

    if (type == "PUBLIC_NETWORKS") {
      const fetchedCharger = await collection.findOne(query);

      if (!fetchedCharger) {
        console.log(`[${context}][Charger.find] Not Found `, {
          hwId,
          source,
          evse_uid,
          status,
          subStatus,
          type,
        });
        return;
      }

      const updateDocument = {
        $set: {
          "plugs.$[i].status": status,
          "plugs.$[i].subStatus": subStatus,
          "plugs.$[i].statusChangeDate": new Date(),
        },
      };

      const queryToUpdate = { hwId: hwId, source: message.source };

      const arrayFilters = [{ "i.uid": evse_uid }];

      const updatedChargerResult = await collection.updateOne(
        queryToUpdate,
        updateDocument,
        { arrayFilters }
      );

      if (updatedChargerResult.modifiedCount !== 0) {
        if (status === PlugStatusAvailable) {
          const plugId = fetchedCharger.plugs.find(
            ({ uid }) => uid === evse_uid
          ).plugId;
          notifyUsersAboutAvailableCharger(hwId, plugId);
        }
        console.log(`[${context}] Sucessfuly Updated`, { query });
      } else {
        console.log(`[${context}][Charger.find] Error `, {
          detail: "[EVSE ID " + evse_uid + " not found]",
        });
        throw new Error(
          `[${context}][Charger.find] Error ` +
            "[EVSE ID " +
            evse_uid +
            " not found]"
        );
      }
    }
  } catch (error) {
    console.log(`[${context}] Error `, error);
  }
};

mqConnection.consume({
  queue: updatePlugStatusRabbitmqQueue,
  handleIncomingMessage,
  teamsWebhookUrl,
  maxRetries: 3,
  limitToProcess: MAX_SIMULTANEOUSLY_MESSAGES,
});
