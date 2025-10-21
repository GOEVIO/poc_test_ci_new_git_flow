const axios = require("axios");
const { Constants } = require("../utils/constants");

/**
 * Fetches sessions from the public network based on the given transactionId.
 * It queries the OCPI microservice to retrieve all related sessions for the specified transaction | OcpiDB.
 *
 * @param {string} id - The ID of session.
 */
function getSessionsPublicNetwork(id) {
    const context = "function getSessionsPublicNetwork";
    const host = `${Constants.ocpi22.host}${Constants.ocpi22.getSessionById}`;
    const params = { id };

    return new Promise((resolve, reject) => {
        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}][${host}] Error`, error);
                reject(error);
            });
    });
}

/**
 * Fetches sessions from the private network based on the given sessionId.
 * It queries the Chargers microservice to retrieve the session details for the specified session | ChargersDB.
 *
 * @param {string} id - The ID of the session for which details are being retrieved.
 */
function getSessionsPrivateNetwork(id) {
    return new Promise((resolve, reject) => {
        const context = "function getSessionsPrivateNetwork";
        const url = `${Constants.chargers.host}${Constants.chargers.getSessionById}`;
        const params = { sessionId: id.toString() };

        axios.get(url, { params })
            .then(response => {
                resolve(Array.isArray(response.data) ? response.data : []);
            })
            .catch(error => {
                console.error(`${context} ${id}`, error);
                reject(error);
            });
    });
}

module.exports = { getSessionsPublicNetwork, getSessionsPrivateNetwork };
