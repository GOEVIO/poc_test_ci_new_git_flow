const mqtt = require('mqtt');
const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
var Charger = require('../models/charger');
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

var options = {};
switch (process.env.NODE_ENV) {
    case 'production':
        options = {
            port: process.env.PortServer_PROD,
            host: process.env.HostPrivate_PROD, //Private IP
            //host: process.env.HostPublic_PROD, // Public IP
            username: process.env.UserName,
            password: process.env.Password
        };
        break;
    case 'pre-production':
        options = {
            port: process.env.PortServer_PRE,
            host: process.env.HostPrivate_PRE, //Private IP
            //host: process.env.HostPublic_PROD, // Public IP
            username: process.env.UserName,
            password: process.env.Password
        };
        break;
    case 'development':
        
        options = {
            port: process.env.PortServer_DEV,
            host: process.env.HostPrivate_DEV, //Private IP
            //host: process.env.HostPublic_DEV, // Public IP
            username: process.env.UserName,
            password: process.env.Password
        };
        break;
    default:
        options = {
            port: process.env.PortServer_TEST,
            host: process.env.HostPrivate_TEST, //Private IP
            //host: process.env.HostPublic_TEST, // Public IP
            username: process.env.UserName,
            password: process.env.Password
        };
        break;
};

var client = mqtt.connect(options.host, options);


//========== Hear Beat Check ==========

//cron.schedule('*/1 * * * *', () => { 
/*
var context = "Hear Beats charger";
//client.subscribe(`tele/19080002/LWT`);
var fields = {
    hwId: 1
};
var query = { chargerType: '002' }
Charger.find(query, fields, (err, chargersFound) => {
    if (err) {
        console.log(`[${context}] Error `, err);
    }
    else {
        chargersFound.map(charger => {
            //console.log("charger HwId", charger.hwId);
            client.subscribe(`tele/${charger.hwId}/LWT`);
            client.subscribe(`tele/${charger.hwId}/STATE`);
        });
    };
});
});
*/
client.on('message', function (topic, message) {

    //console.log("topic: " + topic + "; message: " + message + ";");

    if (topic.includes('LWT')) {
        if (message == 'Online') {
            var hwId = topic.split('/');
            var query = {
                hwId: hwId[1]
            };
            var netStatus = true;
            var heartBeat = Date.now();
            chargerFindOne(query, netStatus, heartBeat);
        }
        else if (message == 'Offline') {
            var hwId = topic.split('/');
            var query = {
                hwId: hwId[1]
            };
            var netStatus = false;
            var heartBeat = ''
            chargerFindOne(query, netStatus, heartBeat);
        };
    };
    if (topic.includes('STATE')) {
        var hwId = topic.split('/');
        var query = {
            hwId: hwId[1]
        };
        var netStatus = true;
        var heartBeat = Date.now();
        chargerFindOne(query, netStatus, heartBeat);
    }
});

function chargerFindOne(query, netStatus, heartBeat) {
    var context = "chargerFindOne";
    Charger.findOne(query, (err, chargerFound) => {
        if (err)
            console.log(`[${context}][findOne] Error `, err);
        else {
            chargerFound.netStatus = netStatus;
            if (heartBeat !== '') {
                chargerFound.heartBeat = heartBeat;
            };
            var newValues = { $set: chargerFound };
            Charger.updateCharger(query, newValues, (err, result) => {
                if (err)
                    console.log(`[${context}][updateCharger] Error `, err);
                else
                    console.log(`[${chargerFound.hwId}] Hear Beat Updated`)
            });
        };
    });
};

module.exports = router;