require("dotenv-safe").load();
const axios = require("axios");

module.exports = {
    getCharger: function (hwId, chargerType, res) {
        let context = "Function getCharger";
        return new Promise((resolve, reject) => {

            let params = {
                hwId: hwId,
                chargerType: chargerType
            };

            let host = process.env.HostPublicNetwork + process.env.PathPublicNetworGetChargerHistory;

            axios.get(host, { params })
                .then((result) => {

                    //console.log("result.data", result.data);
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
                    //ErrorHandler.ErrorHandler(error, res);
                    resolve({
                        charger: '-1',
                        infrastructure: '-1'
                    });
                });

        });
    }
};

//========== FUNCTION ==========