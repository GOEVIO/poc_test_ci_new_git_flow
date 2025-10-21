const axios = require("axios");
const WLKeysMapping = require('../utils/WLKeysMapping.json');
const { logger } = require('../utils/constants');

module.exports = {
    getCEMEEVIOADHOC: (clientName, activePartner) => {
        const context = "Function getCEMEEVIOADHOC";
        return new Promise((resolve, reject) => {

            let params;

            if (clientName === process.env.CemeEVIO) {
                params = {
                    planName: "server_plan_EVIO_ad_hoc"
                };
            } else {
                if (clientName === process.env.clientNameACP && activePartner) {
                    params = {
                        planName: `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}_discount`
                    };
                } else {
                    params = {
                        planName: `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}`
                    };
                }

            };

            let host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data[0]);
                })
                .catch((error) => {
                    console.log(`[${context}][.catch] Error `, error.message);
                    reject(error);
                });
        });
    },
    getCEMEEVIO: (roamingName) => {
        const context = "Function getCEMEEVIO";
        return new Promise((resolve, reject) => {

            let params;
            if (roamingName) {
                params = {
                    CEME: process.env.NetworkEVIO + " " + roamingName
                };
            } else {
                params = {
                    CEME: process.env.NetworkEVIO
                };
            };

            let host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data[0]);
                })
                .catch((error) => {
                    console.log(`[${context}][.catch] Error `, error.message);
                    reject(error);
                });
        });
    },
    getCEMEEVIONormal: (clientName, userType, partner) => {
        const context = "Function getCEMEEVIONormal";
        return new Promise((resolve, reject) => {

            let planName;

            if (clientName === "EVIO") {
                planName = "server_plan_EVIO_ad_hoc"
                /*if (userType === process.env.UserTypeCompany)
                    planName = "server_plan_EVIO_company";
                else
                    planName = "server_plan_EVIO";*/

            } else {

                if (clientName === "ACP") {

                    if (partner)
                        planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}_discount`;
                    else
                        planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}`;

                } else {

                    planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}`;

                };

            };

            let params = {
                planName: planName
            };

            let host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data[0]);
                })
                .catch((error) => {
                    console.log(`[${context}][.catch] Error `, error.message);
                    reject(error);
                });
        });
    }
}
