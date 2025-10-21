require("dotenv-safe").load();
const axios = require("axios");
const ErrorHandler = require("./errorHandler");

module.exports = {
    getEvs: function (evId, res) {
        let context = "Function getEvs";
        return new Promise((resolve, reject) => {

            //console.log("evId", evId);

            let host = process.env.HostEvs + process.env.PathGetEVHistory + '/' + evId;

            let params = {
                _id: evId
            };

            axios.get(host)
                .then((result) => {
                    //console.log(result.data)
                    if (result.data.ev != "-1") {

                        resolve(result.data);

                    } else {

                        resolve({ ev: { _id: "-1", listOfGroupDrivers: [], listOfDrivers: [] }, fleet: undefined });

                    };
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
                    //ErrorHandler.ErrorHandler(error, res);
                    resolve({ ev: { _id: "-1", listOfGroupDrivers: [], listOfDrivers: [] }, fleet: undefined });
                });

        });
    },
    getNumberOfEVs: function (userId) {
        let context = "Function getNumberOfEVs";
        return new Promise((resolve, reject) => {

            let host = `${process.env.HostEvs}${process.env.PathGetNumberOfEVs}/${userId}`;

            axios.get(host)
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
                    //ErrorHandler.ErrorHandler(error, res);
                    reject(error)
                });

        });
    }
};

//========== FUNCTION ==========