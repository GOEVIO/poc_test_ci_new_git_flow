require("dotenv-safe").load();
const express = require("express");
const router = express.Router();
const axios = require("axios");
const JsonFind = require("json-find");
const regex = /<U\+([0-9A-Z]{4})>/gm;
const subst = `\\u$1`;
const parseLink = require("parse-link-header");
const mappingMobie = require("../models/MappingMobie.json");
const jsonFile = JsonFind(mappingMobie);
const Sentry = require("@sentry/node");
const mqConnection =
  require("evio-rabbitmq-connection/dist/src/rabbitmq-connection").default;
const Charger = require("../models/charger");
const constants = require("../utils/constants");
const ChargerEnums = require("../utils/enums/chargerEnums");
const {
  verifyIfCoordinatesUpdate,
  getGeoQueryAndFeatureFlag,
  returnCoordinatesAccordingToFlagMap,
} = require("../helpers/handleCoordinates");
const { ensureCountryCode } = require("evio-library-configs").default;

//Update Or create new or existing charger
router.post("/api/private/updateMobieChargers", async (req, res, next) => {
  var context = "POST /api/private/updateMobieChargers";
  try {
    var data = req.body;

    if (typeof data === "undefined")
      return res
        .status(200)
        .send(Utils.response(null, 2001, "Invalid or missing parameters"));

    let externalMobieChargers = await getAllChargers(
      process.env.PathExternalMobieLocations,
      {}
    );
    if (typeof data.length === "undefined") {
      let charger = data;
      updateOrCreateCharger(charger, externalMobieChargers);
      return res
        .status(200)
        .send({
          code: "chargers_update_success",
          message: "Chargers update success",
        });
    } else {
      for (let i = 0; i < data.length; i++) {
        let charger = data[i];
        console.log(charger);

        updateOrCreateCharger(charger, externalMobieChargers);

        if (i == data.length - 1) {
          return res
            .status(200)
            .send({
              code: "chargers_update_success",
              message: "Chargers update success",
            });
        }
      }
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    Sentry.captureException(error);
    return res.status(500).send(error.message);
  }
});

router.post("/api/private/updateMobieChargersBulkOld", (req, res, next) => {
  var context = "POST /api/private/updateMobieChargersBulk";
  try {
    let originalHost = req.body.data.host;
    var host = "";
    var token = req.body.data.token;
    var offset = 0;
    var totalCount = 10;

    var date_from = req.body.data.date_from;
    var date_to = req.body.data.date_to;

    if (date_from != "")
      host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to;

    console.log(host);

    var chargersCount = 0;

    // while (offset < totalCount) {

    //     var testes = await new Promise((resolve, reject) => {
    //         asyncCall(host, offset, totalCount, date_from, originalHost, resolve);
    //     });

    // }

    return res
      .status(200)
      .send({
        code: "chargers_update_success",
        message: "Chargers update success : " + chargersCount,
      });

    // axios.get(host, {}, { timeout: 5000 })
    // .then((result) => {

    //     for (let i = 0; i < result.data.length; i++) {
    //         let charger = result.data[i];

    //         updateOrCreateCharger(charger);

    //         if (i == result.data.length - 1) {
    //             return res.status(200).send({ code: 'chargers_update_success', message: "Chargers update success" });
    //         }

    //     }

    // });
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.post("/api/private/updateMobieChargersBulk", (req, res, next) => {
  var context = "POST /api/private/updateMobieChargersBulk";
  try {
    getChargers(req).then((result) => {
      if (result.error == true)
        return res
          .status(400)
          .send({
            code: "chargers_update_error",
            message: "Chargers update error: " + result.message,
          });
      else
        return res
          .status(200)
          .send({
            code: "chargers_update_success",
            message: "Chargers update success: " + result.chargersCount,
          });
    });
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.post("/api/private/updateMobieCharger", (req, res, next) => {
  var context = "POST /api/private/updateMobieCharger";
  try {
    getCharger(req).then((result) => {
      if (result.error == true)
        return res
          .status(400)
          .send({
            code: "chargers_update_error",
            message: "Chargers update error: " + result.message,
          });
      else
        return res
          .status(200)
          .send({
            code: "chargers_update_success",
            message: "Chargers update success: " + req.body.data.hwId,
          });
    });
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Used for update status of specific evse id and plugs
router.patch(
  "/api/private/updatePlugStatus/:hwId/:evse_uid",
  async (req, res, next) => {
    const context = "PATCH /api/private/updatePlugStatus";
    try {
      const message = {
        hwId: req.params.hwId,
        evse_uid: req.params.evse_uid,
        source: req.body?.source,
        status: req.body?.status,
        subStatus: req.body?.subStatus,
        type: "PUBLIC_NETWORKS",
      };
      await mqConnection.sendToQueue(
        constants.updatePlugStatusRabbitmqQueue,
        message
      );
      return res.status(200).send();
    } catch (error) {
      Sentry.captureException(error);
      console.error(`[${context}] Error `, error.message);
      return res.status(500).send(error.message);
    }
  }
);

router.get("/api/private/getLastDateUpdated", (req, res, next) => {
  Charger.findOne({})
    .sort({ lastUpdated: -1 })
    .limit(1)
    .then((doc) => {
      return res.status(200).send(doc.lastUpdated);
    });
});

router.patch("/api/private/updateChargerRating", (req, res, next) => {
  var context = "PATCH /api/private/updateChargerRating";

  try {
    var calc = req.body;
    var query = {};
    if (Object.keys(calc).length !== 0) {
      if (calc._id != undefined && calc.hwId != undefined) {
        query = {
          $or: [{ _id: calc._id }, { hwId: calc.hwId }],
        };
      } else if (calc._id != undefined) {
        query = {
          _id: calc._id,
        };
      } else {
        query = {
          hwId: calc.hwId,
        };
      }
    } else {
      return res
        .status(400)
        .send({
          auth: false,
          code: "server_data_required",
          message: "Data is required",
        });
    }
    var fields = {
      _id: 1,
      rating: 1,
      numberOfSessions: 1,
    };

    Charger.findOne(query, fields, (err, result) => {
      if (err) {
        console.error(`[${context}][fnidOne] Error `, err);
        return res.status(500).send(err.message);
      } else {
        if (result) {
          var newRating =
            (result.rating * result.numberOfSessions + calc.rating) /
            (result.numberOfSessions + 1);
          result.rating = newRating;
          result.numberOfSessions += 1;
          var newValues = { $set: result };
          updateCharger(query, newValues)
            .then((value) => {
              return res
                .status(200)
                .send({
                  auth: true,
                  code: "server_rating_updated",
                  message: "Rating updated successfully",
                });
            })
            .catch((error) => {
              console.error(`[${context}][.catch] Error `, error.message);
              return res.status(500).send(error.message);
            });
        } else {
          return res
            .status(200)
            .send({
              auth: true,
              code: "server_charger_not_found",
              message: "Charger not found for the given parameters.",
            });
        }
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.get("/api/private/chargers/old", (req, res, next) => {
  var context = "GET /api/private/chargers/hwId";
  var hwId = req.params.hwId;

  let query = { hwId: hwId };
  console.log(query);

  Charger.findOne(query, (err, doc) => {
    if (err) {
      console.error(`[${context}][.then][find] Error `, err.message);
      return res.status(500).send(err.message);
    } else {
      return res.status(200).send(doc);
    }
  });
});

//Usado para atualizar um charger ou um plug
router.post("/api/private/updateAsset", (req, res, next) => {
  var context = "GET /api/private/updateAsset";
  try {
    let body = req.body.data;

    //Atualizar charger porque não existe uid do EVSE
    if (body.uid == undefined) {
      let query = {
        hwId: body.hwId,
        source: "MobiE",
      };

      let chargerInfo = {
        status: body.status,
      };

      //update charger asset
      Charger.updateCharger(query, { $set: chargerInfo }, (err, doc) => {
        if (doc != null) {
          console.log("Updated " + query.hwId);
          return res.status(200).send();
        } else {
          console.error(
            `[${context}][Charger.find] Error ` +
              "[Charger " +
              query.hwId +
              " not found]"
          );
          return res.status(500).send("Asset not found");
        }
      });
    } else {
      //Atualizar plug

      let query = {
        hwId: body.hwId,
        source: "MobiE",
        "plugs.uid": body.uid,
      };

      let plugInfo = {
        "plugs.$.status": body.status,
      };

      //update plug asset
      Charger.updateCharger(query, { $set: plugInfo }, (err, doc) => {
        if (doc != null) {
          console.log("Updated " + query.hwId + " plug " + body.uid);
          return res.status(200).send();
        } else {
          console.error(
            `[${context}][Charger.find] Error ` +
              "[Plug " +
              body.uid +
              " not found]"
          );
          return res.status(500).send("Asset not found");
        }
      });
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//========== GET ==========
router.get("/api/private/mobie", async (req, res, next) => {
  var context = "GET /api/private/mobie";
  try {
    const query = {
      source: "MobiE",
    };

    const { queryGeoSearch, searchCoordinatesFlagActive } =
      await getGeoQueryAndFeatureFlag(req);

    if (req.body) {
      Object.assign(query, req.body);
      Charger.find(queryGeoSearch).find(query, (error, chargersFound) => {
        if (error) {
          console.error(`[${context}][.then][find] Error `, error.message);
          return res.status(500).send(error.message);
        } else {
          return res
            .status(200)
            .send(
              returnCoordinatesAccordingToFlagMap(
                chargersFound,
                searchCoordinatesFlagActive
              )
            );
        }
      });
    } else {
      Charger.find(queryGeoSearch, (error, chargersFound) => {
        if (error) {
          console.error(`[${context}][.then][find] Error `, error.message);
          return res.status(500).send(error.message);
        } else {
          return res
            .status(200)
            .send(
              returnCoordinatesAccordingToFlagMap(
                chargersFound,
                searchCoordinatesFlagActive
              )
            );
        }
      });
    }
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

const updateOrCreateCharger = (charger, externalChargers) => {
  return new Promise(async (resolve, reject) => {
    //console.log(charger.operator);
    if (charger.evses != undefined && charger.evses.length > 0) {
      getPlugs(charger.evses, charger.id).then(async (plugs) => {
        try {
          var name = "";
          if (typeof charger.name !== "undefined") {
            name = charger.name;
          } else {
            name = charger.address.replace(regex, subst);
          }

          for (let plug of plugs) {
            plug.hasRemoteCapabilities =
              typeof plug.capabilities === "undefined" ||
              plug.capabilities.includes("REMOTE_START_STOP_CAPABLE")
                ? true
                : false;
          }

          let chargerInfo = {
            hwId: charger.id,
            chargerType: process.env.ChargerTypeMobiE,
            source: "MobiE",
            partyId: charger.party_id,
            operatorID: charger.party_id,
            countryCode: charger.country_code,
            cpoCountryCode: charger.country_code,
            country: charger.country,
            name: name,
            address: {
              street: charger.address.replace(regex, subst),
              zipCode: charger.postal_code ?? "",
              city: charger.city.replace(regex, subst),
            },
            parkingType: getMapping(charger.parking_type, "parkingType"),
            geometry: {
              type: "Point",
              coordinates: [
                charger.coordinates.longitude,
                charger.coordinates.latitude,
              ],
            },
            availability: {
              availabilityType: "Always",
            },
            status: getChargerStatus(charger.evses),
            subStatus: getChargerSubStatus(charger.evses),
            //imageContent: [],
            //rating: 0,
            plugs: plugs.sort((a, b) =>
              a.plugId > b.plugId ? 1 : b.plugId > a.plugId ? -1 : 0
            ),
            network: "MobiE",
            stationIdentifier: charger.id,
            voltageLevel: charger.mobie_voltage_level,
            timeZone: charger.time_zone,
            lastUpdated: charger.last_updated,
            operationalStatus: getOperationalStatus(plugs),
            publish: charger.publish,
            mobie_access_type: charger.mobie_access_type,
            mobie_cpe: charger.mobie_cpe,
            originalCoordinates: {
              type: "Point",
              coordinates: [
                charger.coordinates.longitude,
                charger.coordinates.latitude,
              ],
            },
          };

          chargerInfo = await ensureCountryCode(
            chargerInfo,
            "updateOrCreateCharger"
          );

          let query = {
            source: "MobiE",
            hwId: charger.id,
          };

          chargerInfo = await verifyIfCoordinatesUpdate(
            charger.id,
            chargerInfo
          );

          Charger.updateCharger(query, { $set: chargerInfo }, (err, doc) => {
            if (doc != null) {
              console.info("Updated " + chargerInfo.hwId);
              resolve(true);
            } else {
              const new_charger = new Charger(chargerInfo);
              Charger.createCharger(new_charger, (err, result) => {
                if (err) {
                  console.info(
                    "Not created: " + chargerInfo.hwId + " : " + err
                  );
                  throw new Error(err);
                }
                console.info("Created " + chargerInfo.hwId);
                resolve(true);
              });
            }
          });
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
          reject(error);
        }
      });
    }
  });
};

const getPlugs = (evses, hwId) => {
  return new Promise(async (resolve, reject) => {
    let plugs = [];

    let query = {
      source: "MobiE",
      hwId: hwId,
    };

    let chargerFound = await Charger.findOne(query, { _id: 1, plugs: 1 });
    for (let evs of evses) {
      let uid = evs.uid;
      let evse_id = evs.evse_id;
      let status = evs.status;
      let capabilities = evs.capabilities;
      let plug = null;

      let connectors = evs.connectors;
      if (Array.isArray(connectors) && connectors.length > 0) {
        for (let connector of connectors) {
          //console.log(connector);
          if (connector.tariff_ids) {
            let params = {
              tariffId: connector.tariff_ids[0],
            };
            let serviceCost = await getTariffOPC(params);
            let statusChangeDate;
            if (chargerFound) {
              let index = chargerFound.plugs.indexOf(
                chargerFound.plugs.find((plug) => {
                  return plug.plugId === connector.id;
                })
              );
              if (index > -1) {
                if (
                  chargerFound.plugs[index].status ===
                  getMapping(status, "plugStatus")
                ) {
                  statusChangeDate = chargerFound.plugs[index].statusChangeDate;
                } else {
                  statusChangeDate = new Date();
                }
              } else {
                statusChangeDate = new Date();
              }
            } else {
              statusChangeDate = new Date();
            }
            plug = {
              plugId: connector.id,
              uid: uid,
              evse_id: evse_id,
              connectorFormat: connector.format,
              connectorPowerType: connector.power_type,
              connectorType: getMapping(connector.standard, "connectorType"),
              voltage: connector.max_voltage,
              amperage: connector.max_amperage,
              status: getMapping(status, "plugStatus"),
              statusChangeDate: statusChangeDate,
              subStatus: getPlugSubStatus(evs),
              termsAndConditions: connector.terms_and_conditions,
              tariffId: connector.tariff_ids,
              serviceCost: serviceCost,
              capabilities: capabilities,
              // serviceCost: {
              //     initialCost: -1,
              //     costByTime: [
              //         {
              //             minTime: 0,
              //             cost: -1,
              //             uom: ""
              //         }
              //     ],
              //     costByPower: {
              //         cost: -1,
              //         uom: ""
              //     }
              // },
              lastUpdated: connector.last_updated,
            };

            if (typeof connector.max_electric_power === "undefined") {
              if (
                connector.max_voltage != null &&
                connector.max_amperage != null
              ) {
                if (
                  (connector.max_voltage * connector.max_amperage) / 1000 >
                  0
                ) {
                  plug.power =
                    (connector.max_voltage * connector.max_amperage) / 1000;
                } else {
                  plug.power = await axios
                    .get(process.env.PathExternalMobieLocations)
                    .then((result) => {
                      let chargerObj = result.data.find(
                        (element) => element.id === hwId
                      );
                      let evseObj = chargerObj.evses.find(
                        (evse) => evse.uid === uid
                      );
                      let connectorObj = evseObj.connectors.find(
                        (plug) => plug.id === connector.id
                      );
                      return connectorObj.max_electric_power / 1000;
                    })
                    .catch((error) => {
                      return 0;
                    });
                }
              }
            } else {
              if (connector.max_electric_power / 1000 > 0) {
                plug.power = connector.max_electric_power / 1000;
              } else {
                plug.power = await axios
                  .get(process.env.PathExternalMobieLocations)
                  .then((result) => {
                    let chargerObj = result.data.find(
                      (element) => element.id === hwId
                    );
                    let evseObj = chargerObj.evses.find(
                      (evse) => evse.uid === uid
                    );
                    let connectorObj = evseObj.connectors.find(
                      (plug) => plug.id === connector.id
                    );
                    return connectorObj.max_electric_power / 1000;
                  })
                  .catch((error) => {
                    return 0;
                  });
              }
            }

            plugs.push(plug);
          }
        }
      }
    }

    resolve(plugs);
  });
};

const getMapping = (data, mapping_type) => {
  //console.log(data);
  let mapping_list = jsonFile[mapping_type];

  var value = "unknown";

  if (mapping_type == "parkingType") value = "Street";
  else if (mapping_type == "plugStatus") value = "40";

  if (data != undefined) {
    value = Object.keys(mapping_list).find(
      (key) => mapping_list[key] === data.toString()
    );
    if (value === undefined) {
      value = Object.keys(mapping_list).find((key) =>
        mapping_list[key].includes(data.toString())
      );
      if (value === undefined) {
        if (mapping_type == "parkingType") value = "Street";
        else if (mapping_type == "plugStatus") value = "40";
        else value = "unknown";
      }
    }
  }

  return value;
};

//Function to update a charger
function updateCharger(query, values) {
  var context = "Function updateCharger";
  return new Promise((resolve, reject) => {
    try {
      Charger.updateCharger(query, values, (err, result) => {
        if (err) {
          console.error(`[${context}][updateCharger] Error `, err.message);
          reject(err);
        } else {
          if (result) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

const getChargerStatus = (evses) => {
  const plugStatus = [];

  for (let evs of evses) {
    plugStatus.push(evs.status);
  }

  if (
    plugStatus.includes("AVAILABLE") ||
    plugStatus.includes("CHARGING") ||
    plugStatus.includes("BLOCKED")
  ) {
    return "10";
  }
  return "50";
};

const getPlugSubStatus = (evs) => {
  if (evs != undefined) {
    return evs.status;
  }
  return "UNKNOWN";
};

const getChargerSubStatus = (evses) => {
  const plugStatus = [];

  for (let evs of evses) {
    plugStatus.push(evs.status);
  }

  if (
    plugStatus.includes("AVAILABLE") ||
    plugStatus.includes("CHARGING") ||
    plugStatus.includes("BLOCKED")
  ) {
    return "AVAILABLE";
  }

  return "UNKNOWN";
};

async function getChargers(req) {
  let originalHost = req.body.data.host;

  var host = "";
  var token = req.body.data.token;
  var offset = 0;
  var totalCount = 10;

  var date_from = req.body.data.date_from;
  var date_to = req.body.data.date_to;

  if (date_from !== "")
    host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to;
  else host = originalHost;

  var chargersCount = 0;
  var result;

  console.log("host", host);
  console.log("offset", offset);
  console.log("totalCount", totalCount);

  while (offset < totalCount) {
    result = await new Promise((resolve, reject) => {
      asyncCall(
        host,
        offset,
        totalCount,
        date_from,
        date_to,
        originalHost,
        token,
        chargersCount,
        resolve
      );
    });

    console.log(result);
    offset = result.offset;
    totalCount = result.totalCount;
    chargersCount = result.chargersCount;
    host = result.host;

    //console.log("testes", result);
  }

  return result;
}

async function getCharger(req) {
  let originalHost = req.body.data.host;
  let hwId = req.body.data.hwId;
  var host = "";
  var token = req.body.data.token;

  host = originalHost + "/" + hwId;

  var result;
  var chargersCount = 0;
  console.log("host", host);

  result = await new Promise((resolve, reject) => {
    asyncCallSpecificLocation(host, token, chargersCount, hwId, resolve);
  });

  chargersCount = result.chargersCount;

  //console.log("testes", result);

  return result;
}

async function asyncCall(
  host,
  offset,
  totalCount,
  date_from,
  date_to,
  originalHost,
  token,
  chargersCount,
  resolve
) {
  try {
    const result = await axios.get(host, {
      headers: { Authorization: `Token ${token}` },
    });

    const x_total_count = result.headers["x-total-count"];
    if (
      x_total_count !== 0 &&
      x_total_count !== null &&
      x_total_count !== undefined &&
      x_total_count !== ""
    ) {
      totalCount = x_total_count;
    }

    const x_limit = result.headers["x-limit"];
    const link = result.headers["link"];

    offset = Number(offset) + Number(x_limit);
    const parsedLink = parseLink(link);

    if (result.data && result.data.data && result.data.data.length > 0) {
      let externalMobieChargers = await getAllChargers(
        process.env.PathExternalMobieLocations,
        {}
      );
      for (let i = 0; i < result.data.data.length; i++) {
        chargersCount++;
        let charger = result.data.data[i];
        // console.log(JSON.stringify(charger));

        await updateOrCreateCharger(charger, externalMobieChargers)
          .then((result) => {})
          .catch((e) => {});
      }
    }

    if (date_from !== "") {
      host =
        originalHost +
        "?date_from=" +
        date_from +
        "&date_to=" +
        date_to +
        "&offset=" +
        offset;
    } else {
      host = originalHost + "?offset=" + offset;
    }

    console.log("parsedLink", JSON.stringify(parsedLink));
    if (parsedLink) {
      host = parsedLink?.next?.url;
      offset = Number(parsedLink?.next?.offset) || chargersCount;
    }

    resolve({
      offset: offset,
      totalCount: totalCount,
      chargersCount: chargersCount,
      host: host,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.log(error);
    let message = "";
    if (error.response && error.response.data) {
      message = error.response.data.message;
    }
    resolve({
      offset: offset,
      totalCount: -1,
      chargersCount: chargersCount,
      error: true,
      message: message,
    });
  }
}

async function asyncCallSpecificLocation(
  host,
  token,
  chargersCount,
  hwId,
  resolve
) {
  try {
    const result = await axios.get(host, {
      headers: { Authorization: `Token ${token}` },
    });

    if (
      result.data &&
      typeof result.data.data !== "undefined" &&
      result.data.data !== null
    ) {
      let externalMobieChargers = await getAllChargers(
        process.env.PathExternalMobieLocations,
        {}
      );
      chargersCount++;
      let charger = result.data.data;
      updateOrCreateCharger(charger, externalMobieChargers);
    } else {
      const query = { source: "MobiE", hwId };
      const chargersFound = await Charger.find(query);

      const updateOperations = chargersFound.map((charger) => ({
        updateOne: {
          filter: { _id: charger._id },
          update: {
            $set: {
              status: ChargerEnums.chargerStatus.status,
              subStatus: ChargerEnums.subStatus.removed,
              operationalStatus: ChargerEnums.operationalStatus.removed,
            },
          },
        },
      }));

      await Charger.updateMany(query, updateOperations);

      console.log(
        `Chargers with hwId ${hwId} were removed from MobiE repository and updated to status REMOVED on EVIO`
      );
    }

    resolve({ chargersCount: chargersCount, host: host });
  } catch (error) {
    if (
      error.response &&
      error.response.data &&
      error.response.data.status_message.includes("Unknown Location")
    ) {
      const query = { source: "MobiE", hwId };
      const chargersFound = await Charger.find(query);

      const updateOperations = chargersFound.map((charger) => ({
        updateOne: {
          filter: { _id: charger._id },
          update: {
            $set: {
              status: ChargerEnums.chargerStatus.status,
              subStatus: ChargerEnums.subStatus.removed,
              operationalStatus: ChargerEnums.operationalStatus.removed,
            },
          },
        },
      }));

      await Charger.updateMany(query, updateOperations);

      console.log(
        `Chargers with hwId ${hwId} were removed from MobiE repository and updated to status REMOVED on EVIO`
      );
      resolve({ chargersCount: chargersCount, host: host });
    } else {
      Sentry.captureException(error);
      console.error(`[asyncCallSpecificLocation] Error `, error.message);
      resolve({
        totalCount: -1,
        chargersCount: chargersCount,
        error: true,
        message: error.response.data.status_message,
      });
    }
  }
}

async function getTariffOPC(params) {
  var context = "Function getTariffOPC";
  return new Promise((resolve, reject) => {
    let defaultServiceCost = {
      initialCost: -1,
      costByTime: [
        {
          minTime: 0,
          cost: -1,
          uom: "",
        },
      ],
      costByPower: {
        cost: -1,
        uom: "",
      },
    };
    var host = process.env.HostOcpi + process.env.PathGetOPCTariffs;
    axios
      .get(host, { params })
      .then((result) => {
        if (result.data) {
          if (result.data.length != undefined) {
            resolve(defaultServiceCost);
          } else {
            resolve(result.data);
          }
        } else {
          resolve(defaultServiceCost);
        }
      })
      .catch((error) => {
        if (error.response) {
          console.error(`[${context}][get][.catch]`, error.response.data);
          resolve(defaultServiceCost);
        } else {
          console.error(`[${context}][get][.catch]`, error.message);
          resolve(defaultServiceCost);
        }
      });
  });
}

function getAllChargers(chargerProxy, params) {
  var context = "Function getAllChargers";
  return new Promise((resolve, reject) => {
    try {
      axios
        .get(chargerProxy, { params })
        .then((result) => {
          if (result) {
            resolve(result.data);
          } else {
            resolve([]);
          }
        })
        .catch((error) => {
          console.error(`[${context}] Error `, error.message);
          resolve([]);
          //resolve([]);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      resolve([]);
      //resolve([]);
    }
  });
}

function getOperationalStatus(plugs) {
  const context = "Function getOperationalStatus";
  try {
    return plugs.every((plug) => plug.subStatus === "REMOVED")
      ? "REMOVED"
      : "APPROVED";
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return "APPROVED";
  }
}

module.exports = router;
