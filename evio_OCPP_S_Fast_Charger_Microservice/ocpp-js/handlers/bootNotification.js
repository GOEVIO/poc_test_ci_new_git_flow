const Promise = require('promise');
const moment = require('moment');
var Notification = require('../../models/notifications');
const axios = require("axios");
const global = require('../../global');

var host = global.charger_microservice_host;

const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;

module.exports = {
  handle: function (data) {
    return new Promise(function (resolve, reject) {


      // Create Notification
      data.chargeBoxIdentity = JSON.parse(JSON.stringify(data.chargeBoxIdentity), function (k, v) {
        if (k === "$value") {
          this.value = v;
        } else {
          return v;
        }
      });

      if (data.chargeBoxIdentity.value)
        data.chargeBoxIdentity = data.chargeBoxIdentity.value;

      var message = data.chargeBoxIdentity + ' connection available';

      var notification = new Notification({
        hwId: data.chargeBoxIdentity,
        text: message,
        unread: true,
        type: 'BootNotification',
        timestamp: moment().format(),
        data: data
      });

      console.log('[BootNotification] Notification: ' + JSON.stringify(notification) + '\n')

      /////////////////////////////////////////////////////////////////////////////
      //Check if charger exists on EVIO Network
      var params = {
        hwId: data.chargeBoxIdentity
      };

      chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

        if (charger) {
          var chargerId = charger.data.charger[0]._id;
          var body = {
            _id: chargerId,
            endpoint: data.endpoint,
            vendor: data.chargePointVendor,
            model: data.chargePointModel,
            chargerType: global.OCPPS_15_DeviceType
          }

          var heartBeatInterval = global.defaultHeartBeatInterval;
          if (typeof charger.data.charger[0].heartBeatInterval !== 'undefined') {
            heartBeatInterval = charger.data.charger[0].heartBeatInterval;
          }
          
          /////////////////////////////////////////////////////////////////////////////
          //If charger exists, update relevant info such as: endpoint, vendor, model...
          updateChargerData(chargerServiceUpdateProxy, body).then((result) => {

            if (!result) {
              resolve({
                bootNotificationResponse: {
                  status: global.bootNotificationStatusRejected,
                  currentTime: new Date().toISOString(),
                  heartbeatInterval: heartBeatInterval
                }
              });
            } else {
              Notification.createNotification(notification, (err, result) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({
                    bootNotificationResponse: {
                      status: global.bootNotificationStatusAccepted,
                      currentTime: new Date().toISOString(),
                      heartbeatInterval: heartBeatInterval
                    }
                  });
                }
              });
            }
          });
        }
        else {
          console.log(`[BootNotification] Error:  Charger ${data.chargeBoxIdentity} does not exists.`);
          resolve({
            bootNotificationResponse: {
              status: global.bootNotificationStatusRejected,
              currentTime: new Date().toISOString(),
              heartbeatInterval: global.defaultHeartBeatInterval
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
          resolve(response);
        }

      }).catch(function (error) {
        console.log("error" + error);
      });
  });
};

const updateChargerData = (ServiceProxy, body) => {

  return new Promise((resolve, reject) => {
    axios.patch(ServiceProxy, body)
      .then(function (response) {
        resolve(true);
      })
      .catch(function (error) {
        console.log("error", error.response.data.message);
        reject(false);
      });
  });
};

