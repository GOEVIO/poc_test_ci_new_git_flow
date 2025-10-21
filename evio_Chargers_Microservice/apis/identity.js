const axios = require("axios");
const { captureException } = require('@sentry/node');
const { findGroupCSUserGroupMap } = require('evio-library-identity').default;
async function getGroupsMap(userId) {
    const context = "Function getGroupsMap in apis/identity.js";
    return findGroupCSUserGroupMap(userId)
    .catch((error) => {
        captureException(error);
        console.error(`[${context}][.catch] Error `, error.message);
        throw error;
    });
}
module.exports ={ getGroupsMap };