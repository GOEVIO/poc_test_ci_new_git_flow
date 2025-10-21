const axios = require("axios");

async function getEVsMap(userId, groupDrivers) {
    const context = "Function getEVsMap";
    try {
        const headers = { userid: userId };
        const host = process.env.HostEvs + process.env.PathGetEVSMap;
        const data = { groupDrivers }
        const result = await axios.get(host, { data, headers });
        if (result.data.length > 0) {
            const listFleet = result.data.map(ev => ev.fleet);
            return listFleet;
        }
        return [];
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return [];
    }
}

module.exports = { getEVsMap };