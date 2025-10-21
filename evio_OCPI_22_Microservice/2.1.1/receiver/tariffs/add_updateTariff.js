
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const Tariff = require('../../../models/tariffs')

module.exports = {
    put: function (req, res) {

        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;

        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        var tariffId = data.id;
        if (!tariffId)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        let ocpiVersion = req.params.version
        try {

            Utils.getPlatformInfo(token , ocpiVersion)
            .then((platform) => {
                let query = {
                    id: tariffId
                };
    
                let country_code = req.params.country_code
                let party_id = req.params.party_id
    
                data.country_code = country_code
                data.party_id = party_id
                data.source = platform.platformCode
                //TODO: In 2.1.1 version, we don't get the type of tariff (REGULAR OR AD_HOC_PAYMENT), so we use all REGULAR 
                data.type = "REGULAR"
                if (data.min_price !== null && data.min_price !== undefined) {
                    data.min_price = {
                        excl_vat : data.min_price
                    }
                }
                data.elements = Utils.transformTariffElements(data.elements)
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
                                console.log("Tariff not created ", err);
                                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                            }
                        })
                    }
                });
            })
            .catch(e => {
                console.log("[addUpdateTariff.put.getPlatformInfo] Generic client error. ", e);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
            })

        }
        catch (e) {
            console.log("[addUpdateTariff.put] Generic client error. ", e);
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
            console.log("Generic client error. ", error.message);
        });

};

