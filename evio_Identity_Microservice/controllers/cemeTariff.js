const CEMETariff = require('../models/cemeTariff');
const CemeData = require('./ceme');
const { logger } = require('../utils/constants');

module.exports = {
    updateTariffCEMEACP: async (userId, valid, clientName) => {
        const context = "Funciton updateTariffCEMEACP";
        return new Promise(async (resolve, reject) => {
            try {

                let cemeTariff = await CemeData.getCEMEEVIOADHOC(clientName, valid);

                let tariff = {
                    power: "all",
                    planId: cemeTariff.plan._id
                };

                let CEMETariffUpdated = await CEMETariff.updateMany({ userId: userId, status: "active" }, { $set: { tariff: tariff } });
                resolve(CEMETariffUpdated);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    removeCEMETariff: (userId) => {
        var context = "Function removeCEMETariff";
        var query = {
            userId: userId
        };

        CEMETariff.find(query, (err, CEMETariffFound) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
            }
            else {

                if (CEMETariffFound.length === 0) {
                    console.log(`[${context}] No CEME tariff to remove`);
                }
                else {

                    Promise.all(

                        CEMETariffFound.map(cemeTariff => {
                            return new Promise((resolve, reject) => {
                                var query = {
                                    _id: cemeTariff._id
                                };
                                CEMETariff.removeCEMETariff(query, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][removeCEMETariff] Error `, err.message);
                                        reject(err);
                                    }
                                    else {
                                        resolve(true);
                                    };
                                });
                            });
                        })

                    ).then(() => {
                        console.log(`[${context}] CEME Tariff removed`);
                    }).catch((error) => {
                        console.log(`[${context}][.catch] Error `, error.message);
                    });

                };

            };
        });
    },
    standardizeCemeTariff: async () => {
        let context = "Function standardizeCemeTariff";
        try {

            let cemeTariff = await CemeData.getCEMEEVIOADHOC("EVIO", false);

            console.log("cemeTariff", cemeTariff.plan._id);

            let query = {
                CEME: "EVIO",
                clientName: "EVIO"
            }

            let tariff = {
                power: "all",
                planId: cemeTariff.plan._id
            }

            let cemeTariffUpdated = await CEMETariff.updateMany(query, { $set: { tariff: tariff } }, { new: true });
            console.log("cemeTariffUpdated", cemeTariffUpdated)


        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        };
    }

}