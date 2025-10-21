
const Utils = require('../../utils');

module.exports = {
    send: async function (req, res) {

        //Validate if sent session is valid JSON to process
        let session = req.body;
        console.log(`PATCH Session ${JSON.stringify(session)}`)

        if (Utils.isEmptyObject(session)) {
            return res.status(400).send({ auth: 'true', code: "server_session_required", message: 'session required' });
        }

        let country_code = session.country_code;
        if (!country_code) {
            return res.status(400).send({ auth: 'true', code: "server_country_code_required", message: 'country_code required' });
        }

        let party_id = session.party_id;
        if (!party_id) {
            return res.status(400).send({ auth: 'true', code: "server_party_id_required", message: 'party_id required' });
        }

        let ocpiId = session.ocpiId;
        if (!ocpiId) {
            return res.status(400).send({ auth: 'true', code: "server_ocpiId_required", message: 'ocpiId required' });
        }

        let totalPower = session.totalPower;
        if (!(totalPower !== null && totalPower !== undefined && totalPower >= 0)) {
            return res.status(400).send({ auth: 'true', code: "server_totalPower_required", message: 'totalPower required' });
        }

        let updatedAt = session.updatedAt;
        if (!updatedAt) {
            return res.status(400).send({ auth: 'true', code: "server_updatedAt_required", message: 'updatedAt required' });
        }

        let network = session.network;
        if (!network) {
            return res.status(400).send({ auth: 'true', code: "server_network_required", message: 'network required' });
        }

        let operatorId = session.operatorId;
        if (!operatorId) {
            return res.status(400).send({ auth: 'true', code: "server_operatorId_required", message: 'operatorId required' });
        }

        try {
            const {kwh , charging_periods , status , end_date_time , last_updated} = Utils.transformSessionObject(network , session)
            const platform = await Utils.findOnePlatform({cpo : party_id , platformCode : network})
            Utils.addToSessionsQueue({kwh , charging_periods , status , end_date_time , last_updated} , process.env.PatchSessionCommand , network , country_code , party_id , operatorId , ocpiId , platform._id , process.env.IntegrationStatusOpen  , session , session)
            return res.status(200).send();

        } catch (e) {
            console.log("Generic client error. ", e);
            return res.status(400).send(e.message);
        }
    }
}
