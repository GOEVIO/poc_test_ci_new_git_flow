const axios = require("axios");
const _ = require("underscore");

const Session = require("../models/sessions");
const Platform = require("../models/platforms");
const { SessionStatusToStop } = require("../global");

/**
 * Curried getter function
 * @type {(field: string) => (obj: object) => any}
 */
const get = (field) => (obj) => obj[field];

/**
 * Returns a function that receives endpoint data validates according to version
 * @param {string} version
 * @returns {(any) => boolean}
 */
function platformUrlFilter(version) {
  if (version === process.env.ocpiVersion22) {
    return ({ identifier, role }) =>
      identifier === "commands" && role === "RECEIVER";
  } else {
    return ({ identifier }) => identifier === "commands";
  }
}

/**
 * builds stop session endpoint from platform
 * @param {object} platform
 * @returns {string | undefined}
 */
function getPlatformStopCommandEndpoint(platform) {
  const version = platform.platformVersions[0].version;

  const url = platform.platformDetails
    .filter((details) => details.version === version)
    .flatMap((details) => details.endpoints)
    .filter(platformUrlFilter(version))
    .map((endpoint) => endpoint.url)
    .find((_) => true);

  if (!url) {
    console.error("Malformed platform:", platform._id);
    return;
  }

  return `${url}/STOP_SESSION`;
}

/**
 * gets token from platform
 * @param {object} platform
 * @returns {string}
 */
function getPlatformToken(platform) {
  const version = platform.platformVersions[0].version;
  return _.where(platform.platformActiveCredentialsToken, { version })[0].token;
}

/**
 * @typedef {object} PlatformData
 * @property {string} endpoint
 * @property {string} token
 * @property {string} responseUrl
 * @property {string} code
 */
/**
 * Builds PlatformData object from platform
 * @param {object} platform
 * @returns {PlatformData}
 */
function getPlatformData(platform) {
  return {
    endpoint: getPlatformStopCommandEndpoint(platform),
    token: getPlatformToken(platform),
    responseUrl: `${platform.responseUrlSessionRemoteStart}/STOP_SESSION/`,
    code: platform.platformCode,
  };
}

/**
 * @typedef {object} PlatformMap
 * @property {PlatformData} MobiE
 * @property {PlatformData} Gireve
 */
/**
 * Groups elements in an array by the value in its 'code' field.
 * @param {PlatformData[]} platformDataArray
 * @returns {PlatformMap}
 */
function groupByCode(platformDataArray) {
  return platformDataArray.reduce((acc, platformData) => {
    acc[platformData.code] = platformData;
    return acc;
  }, {});
}

/**
 * Gets platforms from DB and builds a map to access them
 * @returns {Promise<PlatformMap | false>}
 */
async function getPlatformUrlsMap() {
  /** @type {object[] | undefined} */
  const platforms = await Platform.find();

  if (!platforms?.length) {
    return false;
  }

  const platformDataArray = platforms
    .map(getPlatformData)
    .filter(get("endpoint")); // keep the ones with valid endpoint

  if (!platformDataArray?.length) {
    throw "Not found platforms";
  }

  return groupByCode(platformDataArray);
}

/**
 * Sends axios request and returns response data
 * @param {string} endpoint
 * @param {object} body
 * @param {object} options
 * @returns {Promise<object>}
 * @throws {object} axios error response
 */
async function sendStop(endpoint, body, options) {
  const context = "[EvioApi][Sessions][stopInvalidCountrySessions][sendStop]";
  console.info(
    `${context} Sending request to platform:`,
    endpoint,
    body,
    options
  );

  const response = await axios.post(endpoint, body, options);

  console.info(`${context} Received response from platform:`, response.data);
  return response.data;
}

/**
 * @typedef {object} StopResult
 * @property {boolean} success
 * @property {string} id - session.id (not _id)
 * @property {object | undefined} response - axios response
 * @property {object | undefined} reason - error
 */
/**
 * Gets platform data by session source from platform map.
 * Builds and sends a request to stop the session to platform.
 * Updated the session in db if successful.
 * @type {(session: object) => Promise<StopResult>}
 */
const stopSession = async (session) => {
  try {
    const platformMap = await getPlatformUrlsMap();
    const platformData = platformMap[session.source];
    const body = {
      response_url: `${platformData.responseUrl}${session.authorization_reference}`,
      authorization_id: session.authorization_reference,
      session_id: session.id,
    };
    const options = {
      headers: { Authorization: `Token ${platformData.token}` },
    };

    const responseData = await sendStop(platformData.endpoint, body, options);

    if (
      responseData?.data?.status_code === 1000 &&
      responseData?.data?.result === "ACCEPTED"
    ) {
      const updateResult = await Session.updateOne(
        { id: session.id },
        { $set: { status: SessionStatusToStop } }
      );
      return { success: updateResult.acknowledged, id: session.id };
    } else {
      return { success: false, id: session.id, response: responseData };
    }
  } catch (e) {
    console.error("Unexpected error:", e);
    return { success: false, id: session.id, reason: e };
  }
};

module.exports = {
  stopSession
}
