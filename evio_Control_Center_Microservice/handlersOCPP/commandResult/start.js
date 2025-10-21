
const Utils = require('../../utils');

module.exports = {
    post: async function (req, res) {

        //Validate if sent data is valid JSON to process
        let data = req.body;
        console.log(`Command Result Start ${JSON.stringify(data)}`)

        if (Utils.isEmptyObject(data)) {
            return res.status(400).send({ auth: 'true', code: "server_data_required", message: 'data required' });
        }

        let response_url = req.body.response_url;
        if (!response_url) {
            return res.status(400).send({ auth: 'true', code: "server_response_url_required", message: 'response_url required' });
        }

        let party_id = req.body.party_id;
        if (!party_id) {
            return res.status(400).send({ auth: 'true', code: "server_party_id_required", message: 'party_id required' });
        }

        let network = req.body.network;
        if (!network) {
            return res.status(400).send({ auth: 'true', code: "server_network_required", message: 'network required' });
        }

        let result = req.body.result;
        if (!result) {
            return res.status(400).send({ auth: 'true', code: "server_result_required", message: 'result required' });
        }

        let message = req.body.message;
        // if (!message) {
        //     return res.status(400).send({ auth: 'true', code: "server_message_required", message: 'message required' });
        // }
        
        let hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwId_required", message: 'hwId required' });
        }

        let plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plugId_required", message: 'plugId required' });
        }

        let commandType = req.body.commandType;
        if (!commandType) {
            return res.status(400).send({ auth: 'true', code: "server_commandType_required", message: 'commandType required' });
        }

        let operatorId = req.body.operatorId;
        if (!operatorId) {
            return res.status(400).send({ auth: 'true', code: "server_operatorId_required", message: 'operatorId required' });
        }

        try {
            let platform = await Utils.findOnePlatform({cpo : party_id , platformCode : network})
            let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
            Utils.addToCommandQueue(commandType , hwId , plugId,  result , message , response_url ,  network , cpoCountryCode , party_id , operatorId  , platform._id , process.env.IntegrationStatusOpen)
            return res.status(200).send();

        } catch (e) {
            console.log("Generic client error. ", e);
            return res.status(400).send(e.message);
        }
    }
}
