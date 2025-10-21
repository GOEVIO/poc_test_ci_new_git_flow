const Promise = require('promise');
const moment = require('moment');
var Heartbeat = require('../../models/heartbeats');
const axios = require("axios");
const global = require("../../global");
const Utils = require('../utils/utils');

var host = global.charger_microservice_host;

const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerHeartBeatServiceProxy = `${host}/api/private/chargers/heartBeat`;

module.exports = {
  handle: function (data) {
    return new Promise(function (resolve, reject) {

      data.chargeBoxIdentity = JSON.parse(JSON.stringify(data.chargeBoxIdentity), function (k, v) {
        if (k === "$value") {
          this.value = v;
        } else {
          return v;
        }
      });

      if (data.chargeBoxIdentity.value)
        data.chargeBoxIdentity = data.chargeBoxIdentity.value;

      var heartBeat = new Heartbeat({
        hwId: data.chargeBoxIdentity,
        timestamp: moment().format()
      });

      console.log('[Heartbeat] Heartbeat: ' + JSON.stringify(heartBeat) + '\n');

      var params = {
        hwId: data.chargeBoxIdentity
      };

      chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

        //console.log(charger)
        //Update heartBeatDate

        var body = {
          _id: charger._id
        }

        Utils.saveHeartBeat(chargerHeartBeatServiceProxy, body);

        if (charger) {
          Heartbeat.createHeartbeat(heartBeat, (err, result) => {

            if (err) {
              console.log('[Heartbeat] err: ' + JSON.stringify(err));
              reject(err);
            } else {
              resolve({
                heartbeatResponse: {
                  currentTime: new Date().toISOString()
                }
              });
            }
          });
        }
        else {
          resolve({
            heartbeatResponse: {
              currentTime: new Date().toISOString()
            }
          });
        }

      });

    });
  }
}


const chekIfChargerExists = (ServiceProxy, params) => {

  return new Promise((resolve, reject) => {

    axios.get(ServiceProxy, { params })
      .then(function (response) {

        var charger = response.data.charger[0];

        if (typeof charger === 'undefined') {
          resolve(false);
        }
        else {
          resolve(charger);
        }

      }).catch(function (error) {
        console.log("error" + error);
        console.log(error.response.data.message);
      });
  });
};

