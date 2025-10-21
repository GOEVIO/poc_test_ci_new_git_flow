const Promise = require('promise');
const moment = require('moment');
var Notification = require('../../models/notifications');
const global = require('../../global');
const Utils = require('../utils/utils');
const axios = require("axios");
var _ = require("underscore");

var host = global.charger_microservice_host;

const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers/plugs`;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const context = '[STatusNotification] ';
module.exports = {
  handle: function (data) {

    return new Promise(function (resolve, reject) {
      // notification is not read yet
      try {

        data.chargeBoxIdentity = JSON.parse(JSON.stringify(data.chargeBoxIdentity), function (k, v) {
          if (k === "$value") {
            this.value = v;
          } else {
            return v;
          }
        });

        if (data.chargeBoxIdentity.value)
          data.chargeBoxIdentity = data.chargeBoxIdentity.value;

        data.unread = true;

        stopChargingSession(data);

        var notification = new Notification({
          hwId: data.chargeBoxIdentity,
          text: 'Status Notification Update',
          unread: true,
          type: 'StatusNotification',
          timestamp: moment().format(),
          data: data
        });
        console.log('[StatusNotification] notification: ' + JSON.stringify(notification) + '\n');

        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network
        var params = {
          hwId: data.chargeBoxIdentity
        };

        chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

          if (charger) {

            var chargerId = charger.data.charger[0]._id;

            Utils.getEvioChargePointStatus(data.status).then((status) => {

              //get Connector type
              var plugs = charger.data.charger[0].plugs;
              var filteredPlug = _.where(plugs, { plugId: data.connectorId });

              if (data.connectorId != 0) {

                var connectorType = "Unknown";
                if (filteredPlug[0]) {
                  connectorType = filteredPlug[0].connectorType;
                }
                else {
                  connectorType = "Unknown";
                }

                var body = {
                  _id: chargerId,
                  plugs: [{
                    plugId: data.connectorId,
                    status: status,
                    connectorType: connectorType
                  }]
                }

                updateChargerData(chargerServiceUpdateProxy, body).then((result) => {

                  if (!result) {
                    console.log('[StatusNotification] Updating charger with connectores - error: ');
                    resolve({
                      statusNotificationResponse: {}
                    });
                  }
                  else {
                    Notification.createNotification(notification, (err, result) => {
                      if (err) {
                        console.log('[StatusNotification] err: ' + JSON.stringify(err));
                        reject(err);
                      } else {
                        resolve({
                          statusNotificationResponse: {}
                        });
                      }
                    });
                  }
                });
              }
              else {
                resolve({
                  statusNotificationResponse: {}
                });
              }
            });

          }
          else {
            console.log(`[StatusNotification] charger ${data.chargeBoxIdentity} does not exist: `);
            resolve({
              statusNotificationResponse: {}
            });
          }


        });
      } catch (error) {
        reject(error)
        console.log('[StatusNotification] error :' + error);
      }
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

//Function to stop transaction notification when user does not connects the plug
const stopChargingSession = (data) => {

  //Check if connector id is available
  if (data.status == global.chargePointStatusOCPPAvailable) {

    //Check if there is any charging session running to specific connector id
    // var params = {
    //   plugId: data.connectorId,
    //   status: process.env.SessionStatusToStart
    // };
    var params = {
      hwId: data.chargeBoxIdentity,
      status: process.env.SessionStatusToStart
    };

    Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {

      if (chargingSession) {
        //Update charging Session with failed
        updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession);
        console.log(`[StatusNotification] A charging session was canceled for charge station ${data.chargeBoxIdentity} and connectorId  ${data.connectorId}`)
      }

    }).catch(function (error) {
      console.log(`${context} error checking if has any charging session`, error)

    });

  }
};

const updateChargingSession = (ServiceProxy, status, chargingSession) => {


  var body = {
    _id: chargingSession._id,
    status: status
  }

  axios.patch(ServiceProxy, { body })
    .then(function (response) {
      // console.log("Success");
    })
    .catch(function (error) {
      console.log(error);

    });


};
