
const Utils = require('../../../utils');
const Tariff = require('../../../models/tariffs')

module.exports = {
    delete: function (req, res) {
        //Get Token, sent previously to partner
        const token = req.headers.authorization.split(' ')[1];

        const tariffId = req.params.tariff_id
        const ocpiVersion = req.params.version

        try {
            Utils.getPlatformInfo(token , ocpiVersion)
            .then(async (platform) => {
                let query = {
                    id: tariffId
                };
                const foundTariff = await Utils.findTariffId(platform.platformCode , tariffId)
                if (!foundTariff) {
                    if (foundTariff === undefined) {
                        console.error("[deleteTariff.delete.getPlatformInfo] Generic client error. Undefined tariff ",);
                        return res.status(200).send(Utils.response(null, 3000, "Generic server error"));
                    } else {
                        const deleted = await Tariff.findOneAndDelete(query)
                        if (deleted) {
                            return res.status(200).send(Utils.response(null, 1000, 'Deleted tariff ' + tariffId));
                        } else {
                            return res.status(200).send(Utils.response(null, 2901, "The provided tariffId doesn't exist"));
                        }
                    }
                } else {
                    return res.status(200).send(Utils.response(null, 2900, "The provided tariffId still exists on at least one connector"));
                }
            })
            .catch(e=> {
                console.error("[deleteTariff.delete.getPlatformInfo] Generic client error. ", e?.message);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
            })
        }
        catch (e) {
            console.error("[deleteTariff.delete] Generic client error. ", e?.message);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}