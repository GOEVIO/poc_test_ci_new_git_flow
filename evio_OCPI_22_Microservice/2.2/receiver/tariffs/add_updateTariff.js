
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const Tariff = require('../../../models/tariffs')

module.exports = {
    put: function (req, res) {
        //Get Token, sent previously to partner
        const token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        const data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        const tariffId = data.id;
        if (!tariffId)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        const ocpiVersion = req.params.version

        try {
            Utils.getPlatformInfo(token , ocpiVersion)
            .then((platform) => {
                let query = {
                    id: tariffId
                };

                data.source = platform.platformCode
                Tariff.updateTariff(query, { $set: data }, (err, doc) => {
                    if (doc != null) {
                        console.log("Updated " + tariffId);
                        //Send to public Network for update on chargers
                        updatePublicNetwork(data);
                        return res.status(200).send(Utils.response(null, 1000, "Updated Tariff " + tariffId + ""));
                    } else {
                        const new_tariff = new Tariff(data);
                        Tariff.create(new_tariff, (err, result) => {
                            if (result) {
                                //Send to public Network for update on chargers
                                updatePublicNetwork(data);
                                return res.status(200).send(Utils.response(null, 1000, "Created Tariff " + tariffId + ""));
                            } else {
                                console.error("Tariff not created ", err);
                                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                            }
                        })
                    }
                });
            })
            .catch(e=> {
                console.error("[addUpdateTariff.put.getPlatformInfo] Generic client error. ", e);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
            })
        }
        catch (e) {
            console.error("[addUpdateTariff.put] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}

function updatePublicNetwork(tariffOPC) {
    let opcTariff = Utils.tariffResponseBody(tariffOPC);
    let host = process.env.HostPublicNetwork + process.env.PathPublicNetworkUpdateTariffOPC;

    let data = opcTariff;

    axios.patch(host, data)
        .then((result) => {
            console.log("Tariff Updated");
        })
        .catch((error) => {
            console.error("[addUpdateTariff.updatePublicNetwork] Generic client error. ", error.message);
        });
};
