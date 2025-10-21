const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const global = require("./global");
const moment = require("moment");
const host = global.charger_microservice_host;
const ConfigurationKey = require("./models/configurationKeys");
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateStatus = `${host}/api/private/chargers`;
const Notification = require("./models/notifications");
const constants = require("./utils/constants");
const { getCode } = require('country-list');

const Sentry = require("@sentry/node");

let Utils = {
  inteligentHeartBeat: function (
    chargerHeartBeatServiceProxy,
    hwId,
    updateEvseStatus
  ) {
    try {
      //Inteligent HeartBeat
      const body = {
        hwId: hwId,
      };
      Utils.saveHeartBeat(chargerHeartBeatServiceProxy, body, updateEvseStatus);
    } catch (error) {
      console.error("Function inteligentHeartBeat", error.message);
    }
  },
  getSession: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          if (typeof response.data !== "undefined") {
            const session = response.data.chargingSession[0];

            if (typeof session === "undefined") {
              resolve(false);
            } else {
              resolve(session);
            }
          } else {
            resolve(false);
          }
        })
        .catch(function (error) {
          console.error("error" + error);
          if (error.response) console.error(error.response.data.message);
          else console.error(error.message);
          resolve(false);
        });
    });
  },
  updateChargingSessionMeterValues: function (ServiceProxy, body) {
    axios
      .patch(ServiceProxy, { body })
      .then(function (response) {
        // console.log("Success");
        if (response) {
          if (response.data) {
            const chargingSession = response.data.chargingSessionFound;
            if (
              chargingSession &&
              chargingSession.createdWay !==
                process.env.createdWayOcpiOfflineUnknown
            ) {
              const {
                country_code,
                party_id,
                ocpiId,
                totalPower,
                updatedAt,
                network,
                operatorId,
                status,
                cpoTariffIds,
                plugId,
                startDate,
                readingPoints,
              } = chargingSession;

              const patchSession = {
                country_code,
                party_id,
                ocpiId,
                totalPower: totalPower ? totalPower / 1000 : 0,
                updatedAt,
                network,
                operatorId,
                status,
                charging_periods: Utils.buildChargingPeriod(
                  cpoTariffIds,
                  plugId,
                  startDate,
                  readingPoints
                ),
              };
              Utils.sendPatchSession(patchSession);
            }
          }
        }
      })
      .catch(function (error) {
        console.error(
          "[Utils - updateChargingSessionMeterValues] error, ",
          error
        );
      });
  },
  updateChargingSession: function (
    ServiceProxy,
    status,
    internalSessionId,
    meterStart
  ) {
    const body = {
      _id: internalSessionId,
      status: status,
      meterStart: meterStart,
    };

    axios
      .patch(ServiceProxy, { body })
      .then(function (response) {
        // console.log("Success");
      })
      .catch(function (error) {
        console.error("[Utils - updateChargingSession] error, ", error);
      });
  },
  updateChargingSession2: function (
    ServiceProxy,
    status,
    internalSessionId,
    meterStop,
    totalPowerConsumed,
    timeChargedinSeconds,
    stopDate
  ) {
    try {
      const dateNow = moment(new Date().toISOString()).utc();
      const body = {
        _id: internalSessionId,
        status: status,
        meterStop: meterStop,
        totalPower: totalPowerConsumed,
        timeCharged: timeChargedinSeconds,
        stopDate: stopDate,
        parkingStartDate: dateNow,
        stopTransactionReceived: true,
      };
      console.log("body updateChargingSession2", JSON.stringify(body));

      axios
        .patch(ServiceProxy, { body })
        .then(function (response) {
          // console.log("Success");
          if (response) {
            if (response.data) {
              let chargingSession = response.data.result;
              if (
                chargingSession &&
                chargingSession.createdWay !==
                  process.env.createdWayOcpiOfflineUnknown
              ) {
                let patchSession = {
                  country_code: chargingSession.country_code,
                  party_id: chargingSession.party_id,
                  ocpiId: chargingSession.ocpiId,
                  totalPower: chargingSession.totalPower
                    ? chargingSession.totalPower / 1000
                    : 0,
                  updatedAt: chargingSession.updatedAt,
                  network: chargingSession.network,
                  operatorId: chargingSession.operatorId,
                  status: chargingSession.status,
                  stopDate: new Date(stopDate).toISOString(),
                };
                Utils.sendPatchSession(patchSession);
              }
            }
          }
        })
        .catch(function (error) {
          console.error("[Utils - updateChargingSession2] error, ", error);
        });
    } catch (error) {
      console.error("[Utils - updateChargingSession2] Unexpected error: ", error);
    }
  },
  updateChargingSessionWithPlug: function (ServiceProxy, body) {
    axios
      .patch(ServiceProxy, { body })
      .then(function (response) {
        // console.log("Success");
      })
      .catch(function (error) {
        console.error("[Utils - updateChargingSession] error, ", error);
      });
  },
  getChargingTime: function (startDate, stopDate) {
    const duration = moment.duration(stopDate.diff(startDate));
    const timeChargedinSeconds = duration.asSeconds();
    return timeChargedinSeconds;
  },
  checkIdTagValidity: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          if (typeof response.data !== "undefined") {
            const contract = response.data.contract;

            if (typeof contract === "undefined") {
              resolve(false);
            } else {
              resolve(contract);
            }
          } else resolve(false);
        })
        .catch(function (error) {
          if (!error) console.error(`Error - Check error 456789123`);
          else console.error(`Error: , ${JSON.stringify(error)}`);
          resolve(false);
        });
    });
  },
  getEvioChargePointStatus: function (ocppStatus) {
    return new Promise((resolve, reject) => {
      let statusObj = null;
      if (ocppStatus == global.chargePointStatusPlugOCPPAvailable) {
        statusObj = {
          status: global.chargePointStatusEVIOAvailable,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPPreparing) {
        statusObj = {
          status: global.chargePointStatusEVIOAvailable,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPUnavailable) {
        statusObj = {
          status: global.chargePointStatusEVIOUnavailable,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPFaulted) {
        statusObj = {
          status: global.chargePointStatusEVIOUnavailable,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPOccupied) {
        statusObj = {
          status: global.chargePointStatusEVIOInUse,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPCharging) {
        statusObj = {
          status: global.chargePointStatusEVIOInUse,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPSuspendedEVSE) {
        statusObj = {
          status: global.chargePointStatusEVIOInUse,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPSuspendedEV) {
        statusObj = {
          status: global.chargePointStatusEVIOInUse,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPReserved) {
        statusObj = {
          status: global.chargePointStatusEVIOBooked,
          subStatus: ocppStatus.toUpperCase(),
        };
      } else if (ocppStatus == global.chargePointPlugStatusOCPPFinishing) {
        statusObj = {
          status: global.chargePointStatusEVIOInUse,
          subStatus: ocppStatus.toUpperCase(),
        };
      }

      resolve(statusObj);
    });
  },
  makeId: function () {
    const text = "",
      possible =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < 32; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
  },
  chekIfChargerExists: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          const charger = response.data.charger[0];

          if (typeof charger === "undefined") {
            resolve(false);
          } else {
            resolve(charger);
          }
        })
        .catch(function (error) {
          if (!error) console.error(`Error - Check error 45646231`);
          else console.error(`Error: , ${JSON.stringify(error)}`);

          resolve(null);
        });
    });
  },
  getEndpoint: function (uri, ip) {
    if (ip.substr(0, 7) == "::ffff:") {
      ip = ip.substr(7);
    }

    return ip;
  },
  getPort: function (url) {
    url = url.match(/^(([a-z]+:)?(\/\/)?[^\/]+).*$/)[1] || url;
    let parts = url.split(":"),
      port = parseInt(parts[parts.length - 1], 10);
    if (parts[0] === "http" && (isNaN(port) || parts.length < 3)) {
      return 80;
    }
    if (parts[0] === "https" && (isNaN(port) || parts.length < 3)) {
      return 443;
    }
    if (parts.length === 1 || isNaN(port)) return 80;
    return port;
  },
  updateChargerData: function (ServiceProxy, body) {
    return new Promise((resolve, reject) => {
      axios
        .patch(ServiceProxy, body)
        .then(function (response) {
          // console.log("Response: ", response);
          resolve(true);
        })
        .catch(function (error) {
          if (!error)
            console.error(
              `[Utils - updateChargerData] Error - Check error 45646231`
            );
          else
            console.error(
              `[Utils - updateChargerData] Error: , ${JSON.stringify(error)}`
            );

          resolve(false);
        });
    });
  },
  updateChargerStatus: function (ServiceProxy, id, status) {
    const body = {
      _id: id,
      status: status,
    };
    return new Promise((resolve, reject) => {
      axios
        .patch(ServiceProxy, body)
        .then(function (response) {
          resolve(true);
        })
        .catch(function (error) {
          if (!error)
            console.error(
              `[Utils - updateChargerData] Error - Check error 45646231`
            );
          else
            console.error(
              `[Utils - updateChargerData] Error: , ${JSON.stringify(error)}`
            );

          resolve(false);
        });
    });
  },
  saveHeartBeat: function (ServiceProxy, body, updateEvseStatus) {
    axios
      .patch(ServiceProxy, body)
      .then(async function (response) {
        const charger = response?.data;
        if (updateEvseStatus) {
          if (response) {
            if (response.data) {
              if (
                charger.status === global.chargePointStatusEVIOFaulted &&
                charger.plugs.length > 0
              ) {
                for (let plug of charger.plugs) {
                  let evseStatus = await Utils.getEvseStatus(
                    charger,
                    plug.plugId,
                    plug.status
                  );
                  Utils.patchManyLocations(charger, plug.plugId, evseStatus);
                }
              }
            }
          }
        } else {
          let networkObj = charger?.networks?.find(
            (obj) => obj.network === process.env.MobiePlatformCode
          );
          if (
            networkObj &&
            networkObj.status === process.env.ChargerNetworkStatusActive
          ) {
            // The plugId "0" means that the update will be done on the whole charger
            const body = {
              country_code: networkObj.country_code,
              party_id: networkObj.party_id,
              network: networkObj.network,
              status: process.env.evseStatusAvailable,
              hwId: charger.hwId,
              plugId: "0",
              operatorId: charger.operatorId,
            };

            Utils.sendPatchLocation(body);
          }
        }
        //console.log("Heartbeat updated");
      })
      .catch(function (error) {
        console.error("error updating heartbeat", error);
      });
  },
  checkIfHasChargingSession: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          const session = response.data.chargingSession[0];

          if (typeof session === "undefined") {
            resolve(false);
          } else {
            resolve(session);
          }
        })
        .catch(function (error) {
          console.error("error" + error);
          if (error.response) {
            console.error(error.response.data.message);
          } else {
            console.error(error.message);
          }
          resolve(false);
        });
    });
  },
  checkIfHasChargingSessions: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          const session = response.data.chargingSession;

          if (typeof session === "undefined") {
            resolve([]);
          } else {
            resolve(session);
          }
        })
        .catch(function (error) {
          console.error("error" + error);
          if (error.response) {
            console.error(error.response.data.message);
          } else {
            console.error(error.message);
          }
          resolve([]);
        });
    });
  },

  updateChargerStatusOnClose: function (chargeBoxIdentity) {
    return new Promise((resolve, reject) => {
      try {
        let params = {
          hwId: chargeBoxIdentity,
        };

        Utils.chekIfChargerExists(chargerServiceProxy, params).then(
          async (charger) => {
            if (charger) {
              let chargerId = charger._id;

              console.log(
                `[On Close Connection] Charger ${chargeBoxIdentity} status is being updated `
              );
              Utils.updateChargerStatus(
                chargerServiceUpdateStatus,
                chargerId,
                global.chargePointStatusEVIOFaulted
              );

              //Update EVSE Status
              if (charger.plugs.length > 0) {
                for (let plug of charger.plugs) {
                  let evseStatus = await Utils.getEvseStatus(
                    charger,
                    plug.plugId,
                    global.chargePointStatusEVIOUnknown
                  );
                  Utils.patchManyLocations(charger, plug.plugId, evseStatus);
                }
              }

              const trigger = global.triggeredByCP

              Utils.saveLog(
                  chargeBoxIdentity,
                  { event: "ws_close", source: "updateChargerStatusOnClose" },
                  { status: "Faulted", hwId: chargeBoxIdentity },
                  false,
                  "WebSocketClose",
                  `WS connection closed, charger ${chargeBoxIdentity} marked as Faulted`,
                  0,
                  trigger
              );
              // Utils.updateChargerData(chargerServiceUpdateProxy, body)
              resolve(charger);
            } else {
              console.error(
                `[On Close Connection] charger ${chargeBoxIdentity} does not exist: `
              );
              resolve(false);
            }
          }
        );
      } catch (error) {
        console.error("[On Close Connection] error :" + error);
        resolve(false);
      }
    });
  },
  getTariff: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          var tariff = response.data;

          if (typeof tariff === "undefined") {
            resolve("-1");
          } else {
            resolve(tariff);
          }
        })
        .catch(function (error) {
          if (!error) console.error(`Error - Check error 45646231`);
          else console.error(`Error: , ${JSON.stringify(error)}`);

          resolve("-1");
        });
    });
  },

  getSalesTariff: function (ServiceProxy, params) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          const salesTariff = response.data;

          if (typeof salesTariff === "undefined") {
            resolve(false);
          } else {
            resolve(salesTariff);
          }
        })
        .catch(function (error) {
          if (!error) console.error(`Error - Check error 45646231`);
          else console.error(`Error: , ${JSON.stringify(error)}`);

          resolve(false);
        });
    });
  },

  validatePaymentConditions: function (ServiceProxy, data) {
    return new Promise((resolve, reject) => {
      axios
        .get(ServiceProxy, { data })
        .then(function (response) {
          const paymentConditions = response.data;

          if (typeof paymentConditions === "undefined") {
            resolve(false);
          } else {
            resolve(paymentConditions);
          }
        })
        .catch(function (error) {
          if (!error) console.error(`Error - Check error 45646231`);
          else console.error(`Error: , ${JSON.stringify(error)}`);

          resolve(false);
        });
    });
  },
  getFees: function (charger) {
    const context = "[getFees-OCPP]";

    return new Promise(async (resolve, reject) => {
      try {
        let countryCode;
        let postalCode;

        if (charger.address != undefined) {
          if (charger.address.country) {
            if (
              charger.address.country === "Portugal" ||
              charger.address.country === ""
            ) {
              countryCode = "PT";
            } else {
              countryCode = getCode(charger.address.country);
            }
          } else {
            countryCode = "PT";
          }

          if (
            charger.address.zipCode != undefined &&
            charger.address.zipCode !== ""
          ) {
            let result = charger.address.zipCode.split("-");
            if (result.length > 1) {
              postalCode = result[0];
            } else {
              postalCode = "";
            }
          } else {
            postalCode = "";
          }
        } else {
          countryCode = "PT";
        }

        let params = {
          countryCode: countryCode,
          postalCode: postalCode,
        };

        axios
          .get(global.feesConfigEndpoint, { params })
          .then((res) => {
            if (res.data) {
              resolve(res.data);
            } else {
              console.error(`${context} Any fees retuned with params`, params);
              Sentry.captureMessage(
                `Any fees returned with params countryCode=${countryCode} postalCode=${postalCode}`
              );
              reject({
                code: "problem_while_get_fees",
                message: "At this time it is not possible to obtain fees",
              });
            }
          })
          .catch((error) => {
            console.error("[Error getFees] " + error.message);
            Sentry.captureException(error);
            reject({
              code: "problem_while_get_fees",
              message: "At this time it is not possible to obtain fees",
            });
          });
      } catch (error) {
        Sentry.captureException(error);
        reject({ code: "server_error", message: "Internal Error" });
      }
    });
  },
  /**
 * Builds and sends a request to get user fees
 * @param {import('../evio_Chargers_Microservice/models/charger.js')} charger
 * @param {string} userId
 * @returns { Promise<{ IEC: number, IVA: number }> }
 */
  getFeesWithUser: async function (charger, userId) {
    const context = "[getFeesWithUser-OCPP]";
    const ErrorFailedFees = {
      code: "problem_while_get_fees",
      message: "At this time it is not possible to obtain fees",
    };

    const countryCode = charger?.address?.country == "Portugal" ? "PT" : getCode(charger?.address?.country);
    const arrayPostalCodes = charger?.address?.zipCode?.split("-")
    const postalCode = arrayPostalCodes?.length > 1 ? arrayPostalCodes[0] : "";

    const params = {
      countryCode,
      postalCode,
      userId
    };

    try {
      const res = await axios.get(global.feesConfigEndpoint, { params })

      if (res.data) {
        return res.data;
      }
    }
    catch (error) {
      console.error(`[${context} Error] ` + error.message);
      Sentry.captureException(error);
      throw ErrorFailedFees
    }

    console.error(`${context} Any fees retuned with params `, params);
    Sentry.captureMessage(`Any fees returned with params countryCode=${countryCode} postalCode=${postalCode}`);
    throw ErrorFailedFees;
  },
  getCharger: function (ServiceProxy, params) {
    return new Promise(async (resolve, reject) => {
      axios
        .get(ServiceProxy, { params })
        .then(function (response) {
          const charger = response.data.charger[0];
          if (typeof charger === "undefined") {
            resolve(false);
          } else {
            resolve(charger);
          }
        })
        .catch(function (error) {
          if (!error) console.error(`Error - Check error 45646231`);
          else console.error(`Error: , ${JSON.stringify(error)}`);

          resolve(false);
        });
    });
  },
  sliceIntoChunks: function (arr, chunkSize) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
    }
    return res;
  },
  updateConfigurationKeys: function (
      configurationKeysObj,
      charger,
      client,
      eventEmitter,
      action
  ) {
    const context = "Function updateConfigurationKeys";
    return new Promise(async (resolve, reject) => {
      const trigger = global.triggeredByCS;
      const messageId = uuidv4();
      const data = {
        key: configurationKeysObj["key"],
        value: configurationKeysObj["value"],
      };

      try {
        const call = [global.callRequest, messageId, action, data];
        console.log(JSON.stringify(call));
        console.log(`Message sent to ${client.id}, ${action}`);

        eventEmitter.once(messageId, async function (result) {
          try {
            const remoteStatus = result.status;

            if (remoteStatus === process.env.statusAccepted) {
              let body = "";

              if (data.key === process.env.heartbeatInterval) {
                body = { _id: charger._id, heartBeatInterval: data.value };
                Utils.updateChargerData(chargerServiceUpdateStatus, body);
              } else if (data.key === process.env.meterValuesSampledData) {
                body = { _id: charger._id, meterValueSampleInterval: data.value };
                Utils.updateChargerData(chargerServiceUpdateStatus, body);
              }

              await Utils.updateConfigurationKeyValue(charger.hwId, data);
              Utils.saveLog(
                  charger.hwId,
                  data,
                  result,
                  true,
                  action,
                  "ChangeConfiguration command",
                  0,
                  trigger
              );

              resolve({
                result: remoteStatus,
                data,
                message: "Configuration key supported and setting has been changed.",
              });
            } else {
              let message = "Unknown response";

              if (remoteStatus === constants.responseStatus.Rejected) {
                message = "Configuration key supported, but setting could not be changed.";
              } else if (remoteStatus === process.env.statusRebootRequired) {
                message =
                    "Configuration key supported and setting changed, but needs reboot.";
              } else if (remoteStatus === process.env.statusNotSupported) {
                message = "Configuration key is not supported.";
              }

              console.error(`${context} error changing configuration`, JSON.stringify(result));
              Utils.saveLog(charger.hwId, data, result, false, action, message, 0, trigger);
              resolve({ result: remoteStatus, data, message });
            }
          } catch (err) {
            console.error(`${context} Handler error: ${err.message}`);
            Utils.saveLog(charger.hwId, data, {}, false, action, err.message, 0, trigger);
            resolve({ result: "Failed", data, message: err.message });
          }
        });

        client.send(JSON.stringify(call), (err) => {
          if (err) {
            console.error(`${context} client.send error: ${err.message}`);
            Utils.saveLog(charger.hwId, data, {}, false, action, err.message, 0, trigger);
            resolve({ result: "Failed", data, message: err.message });
          }
        });
      } catch (error) {
        console.error(`[${context}] Error `, error.message);
        Utils.saveLog(
          charger.hwId,
          data,
          {},
          false,
          action,
          `${error.message}`,
          0,
          trigger
        );
        resolve({ result: "Failed", data, message: error.message });
      }
    });
  },
  updateConfigurationKeyValue: async function (hwId, data) {
    const lastUpdated = moment(new Date().toISOString()).utc();
    ConfigurationKey.updateConfigurationKey(
      {
        $and: [{ hwId: hwId }, { "keys.key": data.key }],
      },
      {
        $set: {
          "keys.$.value": data.value,
          lastUpdated: lastUpdated,
        },
      }
    )
      .then((res) => {
        console.log(
          `[ ChangeConfiguration ] ${data.key} key was updated successfully`
        );
      })
      .catch((err) => {
        console.error(
          `[ ChangeConfiguration ] ${data.key} key failed to update`
        );
      });
  },
  updateManyConfigurationKeys: async function (
      configurationList,
      charger,
      client,
      eventEmitter,
      action,
      res
  ) {
    const context = "Function updateManyConfigurationKeys";
    try {
      let result = {
        successConfigurationKeys: [],
        failedConfigurationKeys: [],
        total: 0,
      };
      for (let configurationKeysObj of configurationList) {
        let update = await Utils.updateConfigurationKeys(
          configurationKeysObj,
          charger,
          client,
          eventEmitter,
          action
        );
        if (
            update.result === "Accepted" ||
            update.result === "RebootRequired"
        ) {
          result.successConfigurationKeys.push(update);
        } else {
          result.failedConfigurationKeys.push(update);
        }
        result.total++;
      }

      return res.status(200).send(result);
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return res
        .status(400)
        .send({
          auth: "true",
          code: "server_error_connecting_charging_station",
          message: `Communication not established between the CS and the charging station ${hwId}`,
        });
    }
  },
  closeUnknownChargerConnection: async function (request) {
    try {
      const urlWithoutEndingBars = request.url.replace(/\/+$/, "");
      const chargeBoxIdentity = urlWithoutEndingBars.split("/").pop();
      const params = {
        hwId: chargeBoxIdentity,
      };

      let charger = await Utils.chekIfChargerExists(
        chargerServiceProxy,
        params
      );
      if (!charger && charger !== null) {
        console.log(
          `[closeUnknownChargerConnection] charger ${chargeBoxIdentity} does not exist: `
        );
        return true;
      } else if (charger === null) {
        console.error(
          `[closeUnknownChargerConnection] Service down but didn't close connection on ${chargeBoxIdentity}: `
        );
      }
      return false;
    } catch (error) {
      console.error("[closeUnknownChargerConnection] error :" + error);
    }
  },
  saveLog: async function (
    hwId,
    request,
    response,
    success,
    type,
    text,
    plugId,
    trigger
  ) {
    const context = "Function saveLog";

    try {
      const notification = new Notification({
        hwId: hwId,
        text: text,
        unread: true,
        type: type,
        timestamp: moment(new Date().toISOString()).utc().format(),
        data: request,
        responseData: response,
        success: success,
        plugId: plugId,
        trigger: trigger,
      });
      await notification.save();
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
    }
  },
  cleanNotificationsHistory: async function (req, res) {
    const context = "Function cleanNotificationsHistory";
    try {
        let currentDate = new Date().toISOString();
        let deleteDate = moment
          .utc(currentDate)
          .add(-global.notificationsCleanHistoryDays, "days")
          .format();
        await Notification.deleteMany({ timestamp: { $lt: deleteDate } });
        if(res){
          res.status(200).send(`${context} - Process completed successfully`);
        }
        console.log(`[${context}] Process completed successfully`);
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      Sentry.captureException(error);
      if (res) {
        return res.status(500).send({ error: `${context} - An error occurred while processing` });
      }
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  sendCommandResult: async function (response_url, type, data) {
    const context = "Function sendCommandResult";
    try {
      if (response_url) {
        let headers = { apikey: process.env.controlCenterApiKey };
        let host =
          process.env.HostControlCenter +
          process.env.PathCommandResult +
          `/${type}`;
        await axios.post(host, data, { headers });
        console.log(`CommandResult ${type} sent! `);
      } else {
        console.log("No response_url provided");
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      if (error.response) {
        if (error.response.data) {
          console.error(
            `[${context}] Error response data `,
            error.response.data
          );
        }
      }
    }
  },
  getHttpStatus: function (response) {
    const context = "Function getHttpStatus";
    try {
      if (response) {
        if (response.status) {
          return response.status;
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return undefined;
    }
  },
  authorizeToken: async function (
    network,
    party_id,
    idTag,
    tokenType,
    location_id,
    evse_uids
  ) {
    const context = "Function authorizeToken";
    try {
      let host = process.env.HostControlCenter + process.env.PathAuthorizeToken;
      let headers = { apikey: process.env.controlCenterApiKey };
      let resp = await axios.post(
        host,
        { network, party_id, idTag, tokenType, location_id, evse_uids },
        { headers }
      );
      if (resp.data) {
        if (resp.data.allowed === "ALLOWED") {
          return resp.data;
        } else {
          console.log(
            `Token ${resp.data.allowed} on ${network} - ${resp.data.token.uid}`
          );
          return null;
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  buildCdrToken: function (network, token, idTag) {
    const context = "Function buildCdrToken";
    try {
      if (network === process.env.MobiePlatformCode) {
        if (token) {
          return {
            uid: token.uid,
            type: token.type,
            contract_id: token.contract_id,
          };
        } else {
          return {
            uid: idTag,
            type: "OTHER",
            contract_id: "",
          };
        }
      } else if (network === process.env.GirevePlatformCode) {
        if (token) {
          return {
            uid: token.uid,
            type: token.type,
            auth_id: token.auth_id,
          };
        } else {
          return {
            uid: token.uid,
            type: "OTHER",
            auth_id: "",
          };
        }
      } else {
        return {};
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return {};
    }
  },
  sendPutSession: async function (session) {
    const context = "Function sendPutSession";
    try {
      if (
        session.network &&
        session.network !== process.env.EvioNetwork &&
        session.createdWay !== process.env.createdWayOcpiOfflineUnknown
      ) {
        session.totalPower = session.totalPower ? session.totalPower / 1000 : 0;
        let headers = { apikey: process.env.controlCenterApiKey };
        let host = process.env.HostControlCenter + process.env.PathSendSession;
        await axios.put(host, session, { headers });
        console.log(`PUT Session sent!`);
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      if (error.response) {
        if (error.response.data) {
          console.error(
            `[${context}] Error response data `,
            error.response.data
          );
        }
      }
    }
  },
  sendPatchSession: async function (session) {
    const context = "Function sendPatchSession";
    try {
      if (session.network && session.network !== process.env.EvioNetwork) {
        let headers = { apikey: process.env.controlCenterApiKey };
        let host = process.env.HostControlCenter + process.env.PathSendSession;
        await axios.patch(host, session, { headers });
        console.log(`PATCH Session sent!`);
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      if (error.response) {
        if (error.response.data) {
          console.error(
            `[${context}] Error response data `,
            error.response.data
          );
        }
      }
    }
  },
  getEvseStatus: async function (charger, plugId, status) {
    const context = "Function getEvseStatus";
    try {
      if (charger.accessType === process.env.ChargerAccessPublic) {
        let data = await Promise.all(
          charger.networks.map(
            async (chargerNetwork) =>
              await Utils.updateEvseStatus(
                charger,
                plugId,
                chargerNetwork,
                status
              )
          )
        );
        return data.filter((evseStatus) => evseStatus);
      } else {
        return [];
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  },
  updateEvseStatus: async function (charger, plugId, chargerNetwork, status) {
    const context = "Function updateEvseStatus";
    try {
      if (
        chargerNetwork.network !== process.env.EvioNetwork &&
        chargerNetwork.activationRequest &&
        chargerNetwork.status === process.env.ChargerNetworkStatusActive
      ) {
        if (status !== global.chargePointStatusEVIOInUse) {
          return {
            network: chargerNetwork.network,
            status: Utils.statusMapper(status),
          };
        } else {
          let lastSession = await Utils.getLastSession({
            hwId: charger.hwId,
            plugId,
          });
          if (lastSession) {
            if (lastSession.network === process.env.EvioNetwork) {
              return {
                network: chargerNetwork.network,
                status: Utils.statusMapper(
                  global.chargePointStatusEVIOUnavailable
                ),
              };
            } else if (lastSession.network === process.env.MobiePlatformCode) {
              return {
                network: chargerNetwork.network,
                status: Utils.statusMapper(global.chargePointStatusEVIOInUse),
              };
            } else if (lastSession.network === process.env.GirevePlatformCode) {
              if (chargerNetwork.network === process.env.MobiePlatformCode) {
                return {
                  network: chargerNetwork.network,
                  status: Utils.statusMapper(
                    global.chargePointStatusEVIOUnavailable
                  ),
                };
              } else if (
                chargerNetwork.network === process.env.GirevePlatformCode
              ) {
                return {
                  network: chargerNetwork.network,
                  status: Utils.statusMapper(global.chargePointStatusEVIOInUse),
                };
              } else {
                return null;
              }
            } else {
              return {
                network: chargerNetwork.network,
                status: Utils.statusMapper(
                  global.chargePointStatusEVIOUnavailable
                ),
              };
            }
          } else {
            return null;
          }
        }
      } else {
        return null;
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  statusMapper: function (status) {
    const context = "Function statusMapper";
    try {
      switch (status) {
        case "10":
          return process.env.evseStatusAvailable;
        case "20":
          return process.env.evseStatusCharging;
        case "30":
          return process.env.evseStatusReserved;
        case "40":
          return process.env.evseStatusOutOfOrder;
        case "50":
          return process.env.evseStatusInoperative;
        case "80":
          return process.env.evseStatusUnknown;
        case "90":
          return process.env.evseStatusRemoved;
        default:
          return process.env.evseStatusUnknown;
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return "UNKNOWN";
    }
  },
  sendPatchLocation: async function (location) {
    const context = "Function sendPatchLocation";
    try {
      let headers = { apikey: process.env.controlCenterApiKey };
      let host = process.env.HostControlCenter + process.env.PathSendLocation;
      await axios.patch(host, location, { headers });
      console.log(`PATCH Location sent on charger ${location.hwId}!`);
    } catch (error) {
      console.error(`Error on patch location ${JSON.stringify(location)}`);
      console.error(`[${context}] Error `, error.message);
    }
  },
  getLastSession: async function (body) {
    const context = "Function getLastSession";
    try {
      let host = process.env.HostChargers + process.env.PathGetLastSession;
      let resp = await axios.get(host, body);
      if (resp.data) {
        return resp.data;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  patchManyLocations: function (
    charger,
    plugId,
    evseStatus,
    onConnection = false
  ) {
    const context = "Function patchManyLocations";
    try {
      for (let evse of evseStatus) {
        let networkObj = charger.networks.find(
          (obj) => obj.network === evse.network
        );
        if (
          networkObj &&
          networkObj.status === process.env.ChargerNetworkStatusActive
        ) {
          let body = {
            country_code: networkObj.country_code,
            party_id: networkObj.party_id,
            network: networkObj.network,
            status: evse.status,
            hwId: charger.hwId,
            plugId,
            operatorId: charger.operatorId,
          };
          if (
            charger.status === global.chargePointStatusEVIOFaulted ||
            onConnection
          ) {
            Utils.sendPatchLocation(body);
          } else {
            let plugObj = charger.plugs.find((plug) => plug.plugId === plugId);
            if (plugObj) {
              let oldEvseStatus = plugObj.evseStatus.find(
                (evseStatus) => evseStatus.network === evse.network
              );
              if (oldEvseStatus) {
                if (evse.status !== oldEvseStatus.status) {
                  Utils.sendPatchLocation(body);
                }
              }
            } else {
              Utils.sendPatchLocation(body);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return null;
    }
  },
  patchLocationCharger: async function (charger, plugId, status) {
    const context = "Function patchLocationCharger";
    try {
      if (charger.accessType === process.env.ChargerAccessPublic) {
        charger.networks.map((chargerNetwork) =>
          Utils.updateEvseChargerStatus(charger, plugId, chargerNetwork, status)
        );
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return [];
    }
  },
  updateEvseChargerStatus: async function (
    charger,
    plugId,
    chargerNetwork,
    status
  ) {
    const context = "Function updateEvseChargerStatus";
    try {
      if (
        chargerNetwork.network !== process.env.EvioNetwork &&
        chargerNetwork.activationRequest &&
        chargerNetwork.status === process.env.ChargerNetworkStatusActive
      ) {
        if (status === global.chargePointStatusEVIOFaulted) {
          let body = {
            country_code: chargerNetwork.country_code,
            party_id: chargerNetwork.party_id,
            network: chargerNetwork.network,
            status: Utils.statusMapper(global.chargePointStatusEVIOUnavailable),
            hwId: charger.hwId,
            plugId,
            operatorId: charger.operatorId,
            plugs: charger.plugs,
          };
          Utils.sendPatchLocation(body);
        } else if (status === global.chargePointStatusEVIOUnavailable) {
          let body = {
            country_code: chargerNetwork.country_code,
            party_id: chargerNetwork.party_id,
            network: chargerNetwork.network,
            status: Utils.statusMapper(global.chargePointStatusEVIOFaulted),
            hwId: charger.hwId,
            plugId,
            operatorId: charger.operatorId,
            plugs: charger.plugs,
          };
          Utils.sendPatchLocation(body);
        }
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
    }
  },
  getAllUserInfo: function (userId, userIdWillPay, userIdToBilling) {
    const context = "Function getAllUserInfo";
    return new Promise(async (resolve, reject) => {
      let host = process.env.HostUser + process.env.PathGetAllUserInfo;
      let params = { userId, userIdWillPay, userIdToBilling };

      axios
        .get(host, { params })
        .then((result) => {
          if (result.data) {
            resolve(result.data);
          } else {
            resolve({});
          }
        })
        .catch((error) => {
          console.error(`[${context}] Error `, error.message);
          resolve({});
        });
    });
  },
  getCpoTariffIds: function (plugs, network) {
    return plugs.map((plug) => ({
      plugId: plug.plugId,
      tariffId: plug.tariffIds.find(
        (tariffObj) => tariffObj.network === network
      )?.tariffId,
    }));
  },
  buildChargingPeriod: function (
    cpoTariffIds,
    plugId,
    startDate,
    readingPoints
  ) {
    /*
            The charging period in this case, consists in the amount of energy consumed in between
            the different reading points that we receive from the charger.

            Each charging period has a start_date_time marking the start of the period.
            So, we'll always get the date preceding our last reading point.
            It means that, if we only have one reading point (we'll always have at least one in here),
            we'll get the startDate of the session.
        */
    const [last, penultimate] = readingPoints.slice(-2).reverse();
    const chargingPeriodStartDate = new Date(
      penultimate?.readDate ?? startDate
    ).toISOString();
    const chargingPeriodEnergyVolume =
      (last?.totalPower - (penultimate?.totalPower ?? 0)) / 1000;
    const tariffId = cpoTariffIds.find(
      (tariff) => tariff.plugId === plugId
    )?.tariffId;

    // returning the charging periods array according to the OCPI documentation
    return [
      {
        start_date_time: chargingPeriodStartDate,
        dimensions: [
          {
            type: process.env.dimensionTypeEnergy,
            volume: chargingPeriodEnergyVolume,
          },
        ],
        tariff_id: tariffId,
      },
    ];
  },
  getChargerLocationEvses: function (charger, networkType) {
    const context = "Function getChargerLocationEvses";
    try {
      const location_id = networkType.id;
      const evse_uids = charger.plugs.map(
        (plug) => `${location_id}-${plug.plugId}`
      );
      return { location_id, evse_uids };
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return {};
    }
  },
  sendPatchLocationOnConnection: async function (charger) {
    const context = "Function sendPatchLocationOnConnection";
    try {
      if (charger?.plugs?.length > 0) {
        for (const { plugId, status } of charger.plugs) {
          const evseStatus = await Utils.getEvseStatus(charger, plugId, status);
          Utils.patchManyLocations(charger, plugId, evseStatus, true);
        }
      }
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
    }
  },
};

module.exports = Utils;
