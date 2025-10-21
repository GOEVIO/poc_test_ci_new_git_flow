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
const publicNetworkUpdateChargersProxy = `${publicNetworkHost}/api/private/updateMobieChargers`;

// Runs at 5:00 everyday
// Disabled 
/*cron.schedule('0 5 * * *', () => {
    console.log("Start cron update");
    startChargersUpdate();
});*/

const startChargersUpdate = (() => {
    return new Promise((resolve, reject) => {

        let host = process.env.MOBIE_URL;

        var data = {
            host: host
        }

        console.log("Start mobie chargers update");

        axios.post(publicNetworkUpdateChargersProxy, { data })
            .then((response) => {
                if (response) {
                    resolve(true);
                }
            });

    });
});

//startChargersUpdate();

module.exports = router;