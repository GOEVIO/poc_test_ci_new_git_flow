const axios = require('axios');
const Sentry = require("@sentry/node");

const toggle = require('evio-toggle').default;
const { retrieveCoordinatesSessionsConfig } = require('evio-library-configs');
const OCPI = require("evio-library-ocpi");
const OCPP = require("evio-library-chargers");
const { findOneChargerInPublicNetworkOrChargers, updateCharger } = require("evio-library-chargers").default;
const { Constants } = require('evio-library-commons').default;
const { publicChargersTypes, services, environment } = require('../utils/constants');

const dbConfigsToUse = {
  ocpi: {
    chargerDbName: Constants.DBNames.PublicNetworks,
    sessionRepository: OCPI.ChargingSessionReadRepository,
    chargerKey: 'location_id',
    status: 'COMPLETED'
  },
  ocpp: {
    chargerDbName: Constants.DBNames.Chargers,
    sessionRepository: OCPP.ChargingSessionReadRepository,
    chargerKey: 'hwId',
    status: '40'
  },
}

/**
 * Calculates the average coordinates from a list of sessions.
 *
 * This function takes a list of sessions, each containing user coordinates,
 * and calculates the average longitude and latitude across all sessions.
 *
 * @param {Array} sessions - An array of session objects, each containing userCoordinates property.
 * @returns {Array} An array containing the average longitude and latitude as [longitude, latitude].
 */
function calculateAverageCoordinates(sessions) {
  const total = sessions.length;
  const sum = sessions.reduce(
    (acc, session) => {
      const [longitude, latitude] = session.userCoordinates.coordinates;
      return {
        longitude: acc.longitude + longitude,
        latitude: acc.latitude + latitude,
      };
    },
    { longitude: 0, latitude: 0 }
  );

  return [sum.longitude / total, sum.latitude / total];
}


/**
 * Sends an email notification about updated charger coordinates.
 * 
 * This function sends an email to support with details about the updated coordinates of a charger.
 * It constructs the email payload and sends it using Axios.
 * 
 * @async
 * @function sendSupportEmail
 * @param {string} hwId - The hardware ID of the charger.
 * @param {Array<number>} coordinates - An array containing the longitude and latitude of the updated charger location.
 * @returns {Promise<void>} A promise that resolves when the email is sent successfully.
 * 
 * @example
 * await sendSupportEmail('CHG001', [12.3456789, 56.7890123]);
 */
async function sendSupportEmail(hwId, coordinates, updatedCoordinates) {
  const url = `${services.notificationsHost}${services.PathNotificationSendEmail}`
  const mailOptions = {
    to: (() => {
      if (!Object.keys(Constants?.emails)?.length) {
        Sentry.captureException(new Error("Constants.emails is undefined"));
        throw new Error("Email sending failed: Constants.emails is undefined");
      }
      const email = environment === 'production' ? Constants.emails?.SupportEvio : Constants.emails?.QaTest;
      if (!email) {
        Sentry.captureException(new Error("Target email address is undefined"));
        throw new Error("Email sending failed: Target email address is undefined");
      }
      return email;
    })(),
    message: {
      emailSubject: `EVIO - Alteração de coordenadas posto ${hwId}`,
      emailTitle: `Alteração de coordenadas posto hwId: ${hwId} via algorítimo`,
      emailBody: `
        Charger ${hwId}.
        </br>Coordenadas longitude: ${coordinates[0]}, latitude: ${coordinates[1]}.</br>
        Alteradas para longitude: ${updatedCoordinates[0]}, latitude: ${updatedCoordinates[1]}
      `,
    },
    type: "globalNotification"
  };

  const headers = { clientName: 'EVIO' };
  await axios.post(url, { mailOptions }, { headers });
}

/**
 * Handles the completion of a charging session.
 * 
 * This function performs the following steps:
 * 1. Retrieves configuration parameters
 * 2. Determines the appropriate database and model based on the charger type
 * 3. Finds chargers with updated coordinates
 * 4. Checks if there are enough completed sessions within the acceptable radius
 * 5. Updates the charger coordinates if necessary
 * 
 * @param {string} hwId - The hardware ID of the charger
 * @param {string} chargerType - The type of charger
 * @param {string} sessionId - The _id of session
 * 
 * @returns {Promise<void>} Resolves when the function completes successfully
 * 
 */
async function handleSessionCompletion(
  hwId,
  chargerType,
  sessionId
) {
  const context = '[handleSessionCompletion coordinates]'
  try {
    const isFlagActive = await toggle.isEnable('charge-149')
    if (!isFlagActive) {
      console.info(`${context} - Feature flag charge-149 is disabled`)
      return;
    }

    const coordinatesConfigs = await retrieveCoordinatesSessionsConfig();

    if (!coordinatesConfigs || !coordinatesConfigs?.acceptableRadius || !coordinatesConfigs?.minPercentage || !coordinatesConfigs?.minSessions) {
      console.warn(`${context} - Missing or incomplete coordinates configurations:`, coordinatesConfigs);
      return;
    }

    const { acceptableRadius, minPercentage, minSessions } = coordinatesConfigs;

    const protocol = publicChargersTypes.includes(chargerType) ? 'ocpi' : 'ocpp';

    const { chargerDbName, sessionRepository, chargerKey, status } = dbConfigsToUse[protocol];

    const charger = await findOneChargerInPublicNetworkOrChargers({
      hwId,
      operationalStatus: {
        $in: ['APPROVED', 'WAITINGAPROVAL']
      }
    }, chargerDbName, { geometry: 1 });
    if (!charger) {
      return;
    }

    const percentageRequired = minPercentage / 100;
    const originalCoordinates = charger.geometry?.coordinates || null;

    if (!originalCoordinates) {
      console.info(`${context} - The charger ${hwId} not have initial coordinates`)
      return;
    }

    const countSessionQuery = {
      userCoordinates: { $exists: true },
      "userCoordinates.coordinates": { $ne: [0, 0] },
      [chargerKey]: hwId
    }

    const totalWithCoordinates = await sessionRepository.findSessions(countSessionQuery);

    if (totalWithCoordinates.length < minSessions || totalWithCoordinates.length % minSessions !== 0) {
      console.info(
        `${context} - Sessions for charger ${hwId} not valid: received ${totalWithCoordinates.length}, expected multiple of ${minSessions} and >= ${minSessions}`
      );
      return;
    }

    const findSessionsQuery = {
      userCoordinates: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: originalCoordinates,
          },
          $maxDistance: acceptableRadius,
        }
      },
      $or: [
        { [chargerKey]: hwId, status },
        { id: sessionId }
      ]
    }

    let notifySupport = false;

    const recordsInOriginalChargerRadiusCoordinates = await sessionRepository.findSessions(findSessionsQuery)

    const requiredMinimumInRadius = Math.ceil(minSessions * percentageRequired);

    if (recordsInOriginalChargerRadiusCoordinates.length <= requiredMinimumInRadius) {
      const coordinatesToUpdate = calculateAverageCoordinates(totalWithCoordinates);
      notifySupport = true;
      const chargerUpdated = await updateCharger({ hwId }, {
        $set: {
          geometry: {
            type: 'Point',
            coordinates: coordinatesToUpdate,
          },
          updatedCoordinates: {
            date: new Date(),
            source: 'algorithm',
          },
          originalCoordinates: charger?.geometry,
        },
      }, chargerDbName);

      if (chargerUpdated && notifySupport) {
        console.log(
          `Coordinates charger ${hwId} updated.`
        );
        await sendSupportEmail(hwId, originalCoordinates, coordinatesToUpdate)
      }
    }

  } catch (error) {
    console.error(`${context} - Error to during updated coordinates ${hwId}: ${error}`);
    Sentry.captureException(`Error to during updated coordinates ${hwId}: ${error}`);
  }
}

module.exports = { handleSessionCompletion }
