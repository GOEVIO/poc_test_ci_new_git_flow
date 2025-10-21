const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
var moment = require('moment');

var publicNetworkHost = 'http://public-network:3029';
const publicNetworkUpdateChargersProxy = `${publicNetworkHost}/api/private/updateOCMChargers`;

var configsHost = 'http://configs:3028';
const openChargeMapConfigProxy = `${configsHost}/api/private/config/openChargeMap`;

/*const sections = [
    '(42.268956,-9.055435),(41.447365,-6.134476)'
    '(41.552095,-8.946676),(41.050194,-6.499596)',
    '(41.2256669,-8.9154053),(40.803677,-6.623892)',
    '(40.927051,-8.837916),(40.573946,-6.678272)',
    '(40.733075,-8.907833),(40.195236,-6.686040)',
    '(40.355364,-9.055435),(39.838264,-6.748188)',
    '(39.987229,-9.094277),(39.419439,-6.825873)',
    '(39.6532841,-9.5993042),(39.14857,-6.833642)',
    '(39.376679,-9.474709),(38.924187,-6.851144)',
    '(39.1108825,-9.6968079),(38.578361,-6.878859)',
    '(38.7184654,-9.6532059),(38.318787,-6.840653)',
    '(38.409236,-9.389481),(38.038110,-6.868119)',
    '(38.153830,-9.026932),(37.817130,-7.021927)',
    '(37.968854,-9.015946),(37.634649,-7.280106)',
    '(37.778065,-8.961014),(37.495313,-7.313065)',
    '(37.625948,-8.900589),(37.298933,-7.346024)',
    '(37.416823,-8.933548),(37.0757236,-7.3570633)',
    '(37.220237,-9.037918),(36.7771175,-7.2417068)',
    '(39.9839601,-31.4538574),(36.7878414,-24.3766022)',
    '(33.3265122,-17.3700714),(32.3480623,-16.0626984)'
];
*/

/*
const getAvailableCountries = (() => {
    return new Promise((resolve, reject) => {
        var host = process.env.HostReferenceData;
        axios.get(host, { timeout: process.env.TimeOut })

            .then((result) => {
                let countries = result.data.Countries;
                console.log(countries);
                resolve(true);
            });
    });
});
*/

const getOpenChargeMapConfig = (() => {
    return new Promise((resolve, reject) => {

        axios.get(openChargeMapConfigProxy, {})
            .then((openChargeMapConfig) => {

                if (openChargeMapConfig) {
                    let config = openChargeMapConfig.data;

                    if (config) {
                        resolve(config);
                    }
                    else {
                        reject({});
                    }
                }
                else {
                    reject({});
                }

            }).catch((error) => {
                console.log(`[getMailList] Error `, error.message);
                res.send(false);
            });

    });
});

const startIndex = (() => {

    getOpenChargeMapConfig()
        .then((config) => {

            let countriesCodes = config.listCountryCodes;
            let host = config.hostOCM;

            for (let i = 0; i < countriesCodes.length; i++) {
                setTimeout(function () {
                    let countryCode = countriesCodes[i];
                    setTimeout(function () {
                        console.log("Country: " + countryCode);
                        getOpenChargeSectionMap(countryCode, host)
                            .then(result => {
                                if (result) {
                                    console.log("Finished section");
                                }
                            });
                    }, 5000)
                }, i * 15 * 1000);
            }

        })
        .catch((error) => {
            console.log(`[${context}][GetConfig] Error `, error.message);
            reject(error);
        });

});

const startIndexLastUpdated = (() => {

    getOpenChargeMapConfig()
        .then((config) => {

            let countriesCodes = config.listCountryCodes;
            let host = config.hostOCM;

            let lastUpdateDate = moment.utc();
            lastUpdateDate = lastUpdateDate.subtract(7, "days").format();
            console.log(lastUpdateDate.toString());

            for (let i = 0; i < countriesCodes.length; i++) {
                setTimeout(function () {
                    let countryCode = countriesCodes[i];
                    setTimeout(function () {
                        console.log("Country: " + countryCode);
                        getOpenChargeSectionMapLatestUpdated(countryCode, lastUpdateDate.toString(), host)
                            .then(result => {
                                if (result) {
                                    console.log("Finished section");
                                }
                            });
                    }, 5000)
                }, i * 15 * 1000);
            }

        })
        .catch((error) => {
            console.log(`[${context}][GetConfig] Error `, error.message);
            reject(error);
        });

});

const getOpenChargeSectionMap = ((countryCode, host) => {
    return true
});

const getOpenChargeSectionMapLatestUpdated = ((countryCode, modifiedData, host) => {
    return new Promise((resolve, reject) => {
        var params = {
            key: process.env.KEY,
            output: 'json',
            countrycode: countryCode,
            maxresults: 9999,
            compact: true,
            verbose: false,
            opendata: true,
            modifiedsince: modifiedData
            //boundingbox: section_coordinates
        }

        var data = {
            host: host,
            params: params,
            countryCode: countryCode
        }

        axios.post(publicNetworkUpdateChargersProxy, { data })
            .then((response) => {
                if (response) {
                    resolve(true);
                }
            });

    })
});

//startIndex();

//Everyday at 4 AM
// cron.schedule('0 4 * * *', () => {
//     console.log("Start cron 10 update");
//     startIndexLastUpdated();
// });

module.exports = router;