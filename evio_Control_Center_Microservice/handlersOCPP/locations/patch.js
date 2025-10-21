
const Utils = require('../../utils');

module.exports = {
    send: async function (req, res) {

        //Validate if sent session is valid JSON to process
        let location = req.body;
        console.log(`PATCH Location ${JSON.stringify(location)}`)
        if (Utils.isEmptyObject(location)) {
            return res.status(400).send({ auth: 'true', code: "server_location_required", message: 'location required' });
        }

        let country_code = location.country_code;
        if (!country_code) {
            return res.status(400).send({ auth: 'true', code: "server_country_code_required", message: 'country_code required' });
        }

        let party_id = location.party_id;
        if (!party_id) {
            return res.status(400).send({ auth: 'true', code: "server_party_id_required", message: 'party_id required' });
        }

        let network = location.network;
        if (!network) {
            return res.status(400).send({ auth: 'true', code: "server_network_required", message: 'network required' });
        }

        let hwId = location.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwId_required", message: 'hwId required' });
        }

        let plugId = location.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plugId_required", message: 'plugId required' });
        }

        let status = location.status;
        if (!status) {
            return res.status(400).send({ auth: 'true', code: "server_status_required", message: 'status required' });
        }

        let operatorId = location.operatorId;
        if (!operatorId) {
            return res.status(400).send({ auth: 'true', code: "server_operatorId_required", message: 'operatorId required' });
        }

        try {
            let platform = await Utils.findOnePlatform({cpo : party_id , platformCode : network})
            let foundCharger = await Utils.getChargerByHwId(hwId)
            if (foundCharger && foundCharger.accessType === process.env.ChargerAccessPublic) {
                let locationObj = await Utils.transformLocationObject(network , foundCharger , country_code , party_id , platform , true, status)
                // The plugId "0" means that the update will be done on the whole charger
                if (plugId !== "0") {
                    let {evse } = findConnector(locationObj.evses , plugId)
                    Utils.addToLocationQueue(locationObj , process.env.ChargerUpdateEvseStatus ,network , country_code , party_id , operatorId , foundCharger._id , platform._id , process.env.IntegrationStatusOpen , foundCharger , location , evse , undefined)
                } else {
                    Utils.addToLocationQueue(locationObj , process.env.ChargerUpdateLocation ,network , country_code , party_id , operatorId , foundCharger._id , platform._id , process.env.IntegrationStatusOpen , foundCharger , location , undefined , undefined)
                }
            }
            return res.status(200).send();

        } catch (e) {
            console.log(`Error on location ${JSON.stringify(location)}`)
            console.log("Generic client error. ", e);
            return res.status(400).send(e.message);
        }
    }
}


function findConnector(evses , plugId) {
    for (let evse of evses) {
        for (let connector of evse.connectors) {
            if (connector.id === `${evse.uid}-${plugId}`) {
                return {evse , connector}
            }
        }
    }
}