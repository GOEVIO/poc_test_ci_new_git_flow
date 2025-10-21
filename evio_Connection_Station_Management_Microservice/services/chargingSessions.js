const Sentry = require("@sentry/node");
const axios = require("axios");
// Utils 
const Constants = require('../utils/constants');
// Libs
const { retrievePlafondById } = require("evio-library-payments").default;
const chargerLib = require("evio-library-chargers");

const commonLog = "[Service ChargingSessions";

/**
 * Process all running charging sessions with a plafond.
 * @param {Array<Object>} arrayChargingSessions - The array of charging session objects to be sorted.
 * @returns {Boolean} Returns an boolean just as a confirmation that all the sessions were process correctly.
 */
async function processCheckRunningPlafondSessions(arrayChargingSessions) {
  const context = ` ${commonLog} processCheckRunningPlafondSessions ]`;
  try {
    const sortedSessions = sortSessionsByPlafondId(arrayChargingSessions);

    for await (const plafondSession of sortedSessions) {
      const plafond = await retrievePlafondById(plafondSession.plafondId);
      
      if(!plafond) {
        console.log(`[${context}] Plafond ${plafondSession.plafondId} not found`);
        Sentry.captureMessage(new Error(`[${context}] Plafond ${plafondSession.plafondId} not found`));
        plafondSession.sessions.forEach(session => {
          autoStopChargingSession(session, "No plafond found for id " + plafondSession.plafondId);
        });
        continue;
      }

      let totalConsumed = 0
      for await(const session of plafondSession.sessions) {
        const isInternal = await isInternalCharge(
          plafondSession.plafondId,
          session.hwId,
          session.fleetDetails?._id
        );
        if ((isInternal && plafond.includingInternalCharging) || !isInternal)
          totalConsumed += session.total_cost?.incl_vat ?? session.totalPrice?.incl_vat ?? 0;
      };

      switch (plafond.actionMinimumValue) {
        case "CHARGINGNEXTPLAFOND":
          // we are only allowed to charge to an maximum of 50% of the plafond of next month.
          if(totalConsumed >= plafond.amount.value + (plafond.monthlyPlafond.value/2) - Constants.plafond_minimum_value_running_session) {
            console.log( `${plafondSession.plafondId} plafond is over the limit and need to stop charging`);
            plafondSession.sessions.forEach(session => {
              autoStopChargingSession(session, "Spent more than half of next month Plafond");
            });
          }
          console.log(`[${context}] Plafond ${plafondSession.plafondId} is active`);
          break;
        case "NOTCHARGING":
          if (
            totalConsumed >= plafond.amount.value - Constants.plafond_minimum_value_running_session ||
            plafond.amount.value <= 0
          ) {
            console.log( `${plafondSession.plafondId} plafond is over the limit and need to stop charging`);
            plafondSession.sessions.forEach(session => {
              autoStopChargingSession(session, "Plafond is about to be over");
            });
          }
          break;
          default:
          console.error(`[${context}] Plafond ${plafondSession.plafondId} Does not have a valid actionMinimumValue`);
      }
    }

    return true;
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    throw error;
  }
}

/**
 * Sorts an array of charging sessions by their `plafondId` property.
 * Groups sessions with the same `plafondId` into a single entry in the resulting array.
 * @param {Array<Object>} arrayChargingSessions - The array of charging session objects to be sorted.
 * Each object is expected to have a `plafondId` property and a `sessions` array.
 * @returns {Array<Object>} An array of grouped charging sessions, where each group corresponds to a unique `plafondId`.
 */
function sortSessionsByPlafondId(arrayChargingSessions) {
  const context = ` ${commonLog} sortSessionsByPlafondId ]`;
  let sortedSessions = [];
  for (const session of arrayChargingSessions) {
    const foundPlafondId = sortedSessions.findIndex(
      (s) => s.plafondId === session.plafondId
    );

    if (foundPlafondId >= 0) {
      sortedSessions[foundPlafondId].sessions.push(session);
      continue;
    }
    sortedSessions.push({
      plafondId: session.plafondId,
      sessions: [session],
    });
  }
  return sortedSessions;
}

/**
 * Sends a request to stop a charging session.
 * @param {Object} session - The session object containing information about the charging session.
 * @param {string} reason - The reason for stopping the charging session. 
 */
async function autoStopChargingSession(session, reason) {
    var context = `${commonLog} autoStopChargingSession]`;

    const host = process.env.HostConnectioStation + process.env.PathConnectioStation;

    var body = {
        _id: session._id,
        sessionId: session.sessionId,
        chargerId: session.hwId,
        plugId: session.plugId,
        evId: session.evId,
        userId: session.userId,
        estimatedPrice: session.estimatedPrice,
        idTag: session.idTag,
        stopReason: reason,
        action: process.env.ActionStop,
        chargerType: session.chargerType,
        clientName: session.clientName
    }

    axios.post(host, body)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}][axios.post] Result `, result.data);
            } else {
                console.error(`[${context}][axios.post] Error`);
            };
        })
        .catch((error) => {
            if (error.response)
                console.error(`[${context}][axios.post] Error `, error.response.data);
            else
                console.error(`[${context}][axios.post] Error `, error.message);
        });
}

async function isInternalCharge(chargerType, hwId, fleetId) {
  const context = ` ${commonLog} isInternalCharge ]`;
  try {
    if (
      [
        Constants.networks.mobie.chargerType,
        Constants.networks.gireve.chargerType,
        Constants.networks.hubject.chargerType,
      ].includes(chargerType) ||
      !fleetId
    )
      return false;

    return chargerLib.isPlafondInternalCharge(hwId, fleetId);
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    throw error;
  }
}

module.exports = {
  processCheckRunningPlafondSessions,
  autoStopChargingSession,
};
