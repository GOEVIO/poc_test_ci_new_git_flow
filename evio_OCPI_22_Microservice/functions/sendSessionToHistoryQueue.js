const { sessionHistoryV2RabbitmqQueue } = require("../utils/constants");
const mqConnection =
  require("evio-rabbitmq-connection/dist/src/rabbitmq-connection").default;
const toggle = require("evio-toggle").default;
const Sentry = require("@sentry/node");

module.exports = {
  sendSessionToHistoryQueue: async (sessionId, from = "") => {
    const context = "sendSessionToHistoryQueue ocpi22";
    try {
      const message = {
        sessionId,
        origin: "ocpi22",
        from: `service OCPI - ${from}`,
      };
      await mqConnection.sendToQueue(sessionHistoryV2RabbitmqQueue, message);
    } catch (error) {
      console.error(`${context}`, error);
      Sentry.captureException(`${context} Error ${error}`);
    }
  },
};
