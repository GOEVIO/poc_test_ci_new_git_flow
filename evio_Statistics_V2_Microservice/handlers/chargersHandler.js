require("dotenv-safe").load();
const axios = require("axios");
const ErrorHandler = require("./errorHandler");

module.exports = {
    getCharger: function (hwId, res) {
        let context = "Function getCharger";
        return new Promise((resolve, reject) => {

            let params = {
                hwId: hwId,
                //hasInfrastructure: true,
                //active: true
            };

            let host = process.env.HostCharger + process.env.PathGetChargerHistory;

            axios.get(host, { params })
                .then((result) => {
                    //console.log(result.data)
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