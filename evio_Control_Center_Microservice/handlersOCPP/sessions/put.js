
const Utils = require('../../utils');

module.exports = {
    send: async function (req, res) {

        //Validate if sent session is valid JSON to process
        let session = req.body;
        console.log(`PUT Session ${JSON.stringify(session)}`)

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

        let startDate = session.startDate;
        if (!startDate) {
            return res.status(400).send({ auth: 'true', code: "server_startDate_required", message: 'startDate required' });
        }


        let totalPower = session.totalPower;
        if (!(totalPower !== null && totalPower !== undefined && totalPower >= 0)) {
            return res.status(400).send({ auth: 'true', code: "server_totalPower_required", message: 'totalPower required' });
        }

        let cdr_token = session.cdr_token;
        if (!cdr_token) {
            return res.status(400).send({ auth: 'true', code: "server_cdr_token_required", message: 'cdr_token required' });
        }

        let auth_method = session.auth_method;
        if (!auth_method) {
            return res.status(400).send({ auth: 'true', code: "server_auth_method_required", message: 'auth_method required' });
        }

        let location_id = session.location_id;
        if (!location_id) {
            return res.status(400).send({ auth: 'true', code: "server_location_id_required", message: 'location_id required' });
        }

        let evse_uid = session.evse_uid;
        if (!evse_uid) {
            return res.status(400).send({ auth: 'true', code: "server_evse_uid_required", message: 'evse_uid required' });
        }

        let connector_id = session.connector_id;
        if (!connector_id) {
            return res.status(400).send({ auth: 'true', code: "server_connector_id_required", message: 'connector_id required' });
        }

        let currency = session.currency;
        if (!currency) {
            return res.status(400).send({ auth: 'true', code: "server_currency_required", message: 'currency required' });
        }

        let status = session.status;
        if (!status) {
            return res.status(400).send({ auth: 'true', code: "server_status_required", message: 'status required' });
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
            let ocpiSession = Utils.transformSessionObject(network , session)
            let platform = await Utils.findOnePlatform({cpo : party_id , platformCode : network})
            Utils.addToSessionsQueue(ocpiSession , process.env.PutSessionCommand , network , country_code , party_id , operatorId , ocpiId , platform._id , process.env.IntegrationStatusOpen  , session , session)
            return res.status(200).send();

        } catch (e) {
            console.log("Generic client error. ", e);
            return res.status(400).send(e.message);
        }
    }
}
