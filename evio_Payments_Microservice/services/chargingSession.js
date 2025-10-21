require("dotenv-safe").load();
const AxiosHandler = require('./axios')

module.exports = {
    sessionSyncToPlafond: async (session) => {

        let host = process.env.HostCharger + process.env.PathUpdateSyncPlafond

        if (process.env.PublicNetworkChargerType.includes(session.chargerType)) {

            host = process.env.HostOcpi + process.env.PathUpdateSyncPlafond

        }

        let data = { sessionId: session._id };
        let response = await AxiosHandler.axiosPut(host, data);
        console.log("response", response);
    }
};