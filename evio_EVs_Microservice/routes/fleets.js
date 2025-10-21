require('dotenv-safe').load();
const express = require('express');
const router = express.Router();
const Fleets = require('../models/fleets');
const axios = require('axios');
const fs = require('fs');
const EV = require('../models/ev');
const EVsHandler = require('../controllers/evsHandler');
const FleetsHandler = require('../controllers/fleetsHandler');
const Utils = require('../utils/evChargingUtils');
const FLeetKmHandler = require('../handlers/fleetKm');
const { validateUserPerClientName } = require('../auth/auth');

//========== POST ==========
//Create a new Fleets
router.post('/api/private/fleets', (req, res, next) => {
  var context = 'POST /api/private/fleets';
  try {
    var userId = req.headers['userid'];
    var clientName = req.headers['clientname'];
    var fleet = new Fleets(req.body);

    if (!validateUserPerClientName(req.headers)) {
      console.log(`[${context}] Action not allowed for ${clientName}`);
      return res.status(400).send({
        auth: false,
        code: 'action_not_allowed',
        message: 'Action not allowed',
      });
    }

    if (req.body.imageContent === undefined || req.body.imageContent === null) {
      fleet.imageContent = '';
    }

    fleet.createUserId = userId;
    fleet.clientName = clientName;

    console.log(`[${context}] Create Fleet for user ${userId}`);

    validateFields(fleet)
      .then(() => {
        if (fleet.imageContent !== '') {
          saveImageContent(fleet)
            .then((result) => {
              createFleets(result, res);
            })
            .catch((error) => {
              console.error(
                `[${context}][saveImageContent] Error `,
                error.message,
              );
              return res.status(500).send(error.message);
            });
        } else createFleets(fleet, res);
      })
      .catch((error) => {
        return res.status(400).send(error);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//========== PUT ==========
//Add ev to a group fleet
router.put('/api/private/fleets', (req, res, next) => {
  var context = 'PUT /api/private/fleets';
  try {
    var received = req.body;
    var query = {
      _id: received._id,
    };

    const clientName = req.headers['clientname'];
    if (!validateUserPerClientName(req.headers)) {
      console.log(`[${context}] Action not allowed for ${clientName}`);
      return res.status(400).send({
        auth: false,
        code: 'action_not_allowed',
        message: 'Action not allowed',
      });
    }

    Fleets.findOne(query, (err, fleetFound) => {
      if (err) {
        console.error(`[${context}][findOne] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (fleetFound) {
          const addEvs = (ev) => {
            return new Promise((resolve, reject) => {
              var found = fleetFound.listEvs.find((evs) => {
                return evs.evId == ev.evId;
              });
              if (found == undefined) {
                updateFleetOnEV(ev, 'PUT', received._id);
                fleetFound.listEvs.push(ev);
                resolve(true);
              } else resolve(false);
            });
          };
          Promise.all(received.evs.map((ev) => addEvs(ev))).then((value) => {
            if (value.length == 1 && value[0] == false)
              return res.status(400).send({
                auth: false,
                code: 'server_ev_already_group',
                message: 'Ev is already in the group',
              });
            else {
              var newValues = { $set: fleetFound };
              updateFleets(newValues, query)
                .then(async (result) => {
                  if (result) {
                    let listEvs = await getEvsId(fleetFound);
                    var newFleet = {
                      _id: fleetFound._id,
                      name: fleetFound.name,
                      sharedWithOPC: fleetFound.sharedWithOPC,
                      imageContent: fleetFound.imageContent,
                      createUserId: fleetFound.createUserId,
                      listEvs: listEvs,
                    };
                    return res.status(200).send(newFleet);
                  } else
                    return res.status(200).send({
                      auth: true,
                      code: 'server_update_unsuccessfully',
                      message: 'Update unsuccessfully',
                    });
                })
                .catch((error) => {
                  console.error(
                    `[${context}][updateFleets][.catch] Error `,
                    error.message,
                  );
                  return res.status(500).send(error.message);
                });
            }
          });
        } else
          return res.status(400).send({
            auth: false,
            code: 'server_fleet_not_found',
            message: 'Fleet not found for given parameters',
          });
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//========== PATCH ==========
//Update a fleet
// - Change Name;
// - Change Image;
router.patch('/api/private/fleets', (req, res, next) => {
  var context = 'PATCH /api/private/fleets';
  try {
    var userId = req.headers['userid'];
    var received = req.body;
    var query = {
      _id: received._id,
    };
    findOneFleet(query)
      .then((value) => {
        value.name = received.name;

        if (received.sharedWithOPC != undefined) {
          value.sharedWithOPC = received.sharedWithOPC;
        }
        if (received.shareEVData != undefined) {
          value.shareEVData = received.shareEVData;
        }

        if (received.imageContent == '' && value.imageContent != '') {
          unlikImage(value)
            .then((value) => {
              value.imageContent = '';
              var newValues = { $set: value };
              updateFleets(newValues, query)
                .then(async (result) => {
                  if (result) {
                    let listEvs = await getEvsId(value);
                    var newFleet = {
                      _id: value._id,
                      name: value.name,
                      sharedWithOPC: value.sharedWithOPC,
                      shareEVData: value.shareEVData,
                      imageContent: value.imageContent,
                      createUserId: value.createUserId,
                      listEvs: listEvs,
                    };
                    return res.status(200).send(newFleet);
                  } else
                    return res.status(200).send({
                      auth: true,
                      code: 'server_update_unsuccessfully',
                      message: 'Update unsuccessfully',
                    });
                })
                .catch((error) => {
                  console.error(
                    `[${context}][updateFleets][.catch] Error `,
                    error.message,
                  );
                  return res.status(500).send(error.message);
                });
            })
            .catch((error) => {
              console.error(
                `[${context}][unlinkImage][.catch] Error `,
                error.message,
              );
              return res.status(500).send(error.message);
            });
        } else if (received.imageContent.includes('base64')) {
          unlikImage(value)
            .then(() => {
              saveImageContent(received)
                .then((received) => {
                  value.imageContent = received.imageContent;
                  var newValues = { $set: value };

                  updateFleets(newValues, query)
                    .then(async (result) => {
                      if (result) {
                        let listEvs = await getEvsId(value);
                        var newFleet = {
                          _id: value._id,
                          name: value.name,
                          sharedWithOPC: value.sharedWithOPC,
                          shareEVData: value.shareEVData,
                          imageContent: value.imageContent,
                          createUserId: value.createUserId,
                          listEvs: listEvs,
                        };
                        return res.status(200).send(newFleet);
                      } else
                        return res.status(200).send({
                          auth: true,
                          code: 'server_update_unsuccessfully',
                          message: 'Update unsuccessfully',
                        });
                    })
                    .catch((error) => {
                      console.error(
                        `[${context}][updateFleets][.catch] Error `,
                        error.message,
                      );
                      return res.status(500).send(error.message);
                    });
                })
                .catch((error) => {
                  console.error(
                    `[${context}][saveImageContent][.catch] Error `,
                    error.message,
                  );
                  return res.status(500).send(error.message);
                });
            })
            .catch((error) => {
              console.error(
                `[${context}][unlinkImage][.catch] Error `,
                error.message,
              );
              return res.status(500).send(error.message);
            });
        } else {
          var newValues = { $set: value };
          updateFleets(newValues, query)
            .then(async (result) => {
              if (result) {
                let listEvs = await getEvsId(value);
                var newFleet = {
                  _id: value._id,
                  name: value.name,
                  sharedWithOPC: value.sharedWithOPC,
                  shareEVData: value.shareEVData,
                  imageContent: value.imageContent,
                  createUserId: value.createUserId,
                  listEvs: listEvs,
                };
                return res.status(200).send(newFleet);
              } else
                return res.status(200).send({
                  auth: true,
                  code: 'server_update_unsuccessfully',
                  message: 'Update unsuccessfully',
                });
            })
            .catch((error) => {
              console.error(
                `[${context}][updateFleets][.catch] Error `,
                error.message,
              );
              return res.status(500).send(error.message);
            });
        }
      })
      .catch((error) => {
        if (error.auth != undefined) {
          return res.status(400).send(error);
        } else {
          console.error(
            `[${context}][findOneFleet][.catch] Error `,
            error.message,
          );
          return res.status(500).send(error.message);
        }
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Remove evs from group fleets
//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.patch('/api/private/fleets/removeEv_old', (req, res, next) => {
  var context = 'PATCH /api/private/fleets/removeEv_old';
  try {
    var received = req.body;
    var query = {
      _id: received._id,
    };
    if (received.evs.length == 0) {
      return res.status(400).send({
        auth: false,
        code: 'server_no_ev_remove',
        message: 'No evs to remove',
      });
    } else {
      findOneFleet(query)
        .then((value) => {
          if (value.listEvs.length == 0) {
            return res.status(400).send({
              auth: false,
              code: 'server_no_ev_remove',
              message: 'No evs to remove',
            });
          } else {
            const removeEvs = (ev) => {
              return new Promise((resolve) => {
                var listEvs = value.listEvs.filter((evs) => {
                  if (evs.evId == ev.evId) {
                    updateFleetOnEV(ev, 'PATCH', received._id);
                  }
                  return evs.evId != ev.evId;
                });
                value.listEvs = listEvs;
                resolve(true);
              });
            };
            Promise.all(received.evs.map((ev) => removeEvs(ev))).then(() => {
              var newValues = { $set: value };
              updateFleets(newValues, query)
                .then(async (result) => {
                  if (result) {
                    let listEvs = await getEvsId(value);
                    var newFleet = {
                      _id: value._id,
                      name: value.name,
                      sharedWithOPC: value.sharedWithOPC,
                      shareEVData: value.shareEVData,
                      imageContent: value.imageContent,
                      createUserId: value.createUserId,
                      listEvs: listEvs,
                    };
                    return res.status(200).send(newFleet);
                  } else
                    return res.status(200).send({
                      auth: true,
                      code: 'server_evs_removed_unsuccessfully',
                      message: 'Evs removed unsuccessfully',
                    });
                })
                .catch((error) => {
                  console.error(
                    `[${context}][updateFleets][.catch] Error `,
                    error.message,
                  );
                  return res.status(500).send(error.message);
                });
            });
          }
        })
        .catch((error) => {
          if (error.auth != undefined) {
            return res.status(400).send(error);
          } else {
            console.error(
              `[${context}][findOneFleet][.catch] Error `,
              error.message,
            );
            return res.status(500).send(error.message);
          }
        });
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Remove evs from group fleets
router.patch('/api/private/fleets/removeEv', (req, res, next) => {
  const context = 'PATCH /api/private/fleets/removeEv';
  try {
    var received = req.body;
    var userId = req.headers['userid'];
    var queryFleet = {
      _id: received._id,
      createUserId: userId,
    };

    if (received.evs.length == 0) {
      return res.status(400).send({
        auth: false,
        code: 'server_no_ev_remove',
        message: 'No evs to remove',
      });
    } else {
      Promise.all(
        received.evs.map((ev) => {
          return new Promise(async (resolve, reject) => {
            let query = {
              _id: ev.evId,
              userId: userId,
            };
            let sessions = await getSessionsByEV(ev.evId);

            if (sessions.length === 0) {
              let newValues = {
                $pull: {
                  listEvs: { evId: ev.evId },
                },
              };

              updateFleets(newValues, queryFleet)
                .then((result) => {
                  EV.removeEV(query, (err, result) => {
                    if (err) {
                      console.error(
                        `[${context}][removeEV] Error `,
                        err.message,
                      );
                      reject(err);
                    } else {
                      EVsHandler.validateOnlyOneEV(userId);
                      deleteContractFleet({ evId: ev.evId });
                      if (ev.plafondId && ev.plafondId != '-1')
                        removePlafond(ev.evId);
                      resolve(true);
                    }
                  });
                })
                .catch((error) => {
                  console.error(`[${context}] Error `, error.message);
                  reject(error);
                });
            } else {
              let activeSessions = sessions.filter((session) => {
                return session.status === '20';
              });

              if (activeSessions.length > 0) {
                resolve(false);
              } else {
                let newValues = {
                  $pull: {
                    listEvs: { evId: ev.evId },
                  },
                };
                updateFleets(newValues, queryFleet)
                  .then((result) => {
                    let newValues = {
                      hasFleet: false,
                      //fleet: "",
                      listOfGroupDrivers: [],
                      listOfDrivers: [],
                    };

                    updateEV(query, newValues)
                      .then((result) => {
                        removeContractFleet({ evId: ev.evId });
                        if (ev.plafondId && ev.plafondId != '-1')
                          removePlafond(ev.evId);
                        resolve(true);
                      })
                      .catch((error) => {
                        console.error(
                          `[${context}][updateEV] Error `,
                          error.message,
                        );
                        reject(error);
                      });
                  })
                  .catch((error) => {
                    console.error(
                      `[${context}][updateFleets] Error `,
                      error.message,
                    );
                    reject(error);
                  });
              }
            }
          });
        }),
      )
        .then(async (result) => {
          let finalResult = result.filter((elem) => {
            return elem === false;
          });
          if (finalResult.length > 0) {
            return res.status(400).send({
              auth: false,
              code: 'server_ev_in_use',
              message: 'EV cannot be deleted, EV in use',
            });
          } else {
            EVsHandler.validateOnlyOneEV(userId);
            return res.status(200).send({
              auth: true,
              code: 'server_delete_successfully',
              message: 'Successfully deleted',
            });
          }
        })
        .catch((error) => {
          console.error(`[${context}] Error `, error.message);
          return res.status(500).send(error.message);
        });
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.patch('/api/private/fleets/acceptKMs', (req, res, next) => {
  var context = 'PATCH /api/private/fleets/acceptKMs ';
  try {
    let fleetID = req.body.fleetID;
    let acceptKMs = req.body.acceptKMs;

    if (!fleetID || typeof acceptKMs !== 'boolean') {
      console.error(`[${context}] Error - missing input information`);
      return res.status(400).send({
        message: {
          auth: false,
          code: '',
          message: 'missing input information',
          type: 'dialog',
        },
      });
    }

    FLeetKmHandler.updateAcceptKms([fleetID], acceptKMs)
      .then(function (response) {
        if (!response) {
          console.error(
            `[${context}] Error - missing Response from FLeetKmHandler`,
          );
          return res.status(500).send({
            message: {
              auth: false,
              code: 'general_genericErrorMessage',
              message: 'missing Response from FLeetKmHandler',
              type: 'dialog',
            },
          });
        } else
          return res.status(200).send({
            message: {
              auth: true,
              code: 'configurationKeys_updateSuccessful',
              message: 'Success',
              type: 'dialog',
            },
          });
      })
      .catch(function (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(error.status).send({ message: error.message });
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send({
      message: {
        auth: false,
        code: 'general_genericErrorMessage',
        message: error.message,
        type: 'dialog',
      },
    });
  }
});

router.patch('/api/private/fleets/user/acceptKMs', (req, res, next) => {
  const context = 'PATCH /api/private/fleets/user/acceptKMs';
  try {
    const userID = req.headers['userid'];
    const acceptKMs = req.body.acceptKMs;

    if (!userID || typeof acceptKMs !== 'boolean') {
      console.error(`[${context}] Error - missing input information`);
      return res.status(400).send({
        auth: false,
        code: 'general_genericErrorMessage',
        message: 'missing input information',
        type: 'dialog',
      });
    }

    // validate userID
    Utils.getUserById(userID)
      .then(function (userRequest) {
        if (userRequest.status !== 200) {
          console.error(`[${context}] Error - Getting Charging Session `);
          return res.status(400).send({
            auth: false,
            code: 'general_genericErrorMessage',
            message: 'Error Getting Charging Session',
            type: 'topmessage',
          });
        }
        const user = userRequest.data;
        if (!user) {
          console.error(`[${context}] Error - No user Found`);
          return res.status(400).send({
            auth: false,
            code: 'general_genericErrorMessage',
            message: 'No user Found',
            type: 'topmessage',
          });
        }

        // get all fleet from this user
        let query = {
          createUserId: user._id,
        };
        Fleets.find(query, { _id: 1 })
          .then(function (allFleets) {
            if (!allFleets || allFleets.length < 1) {
              console.error(`[${context}] Error - User has no fleets`);
              return res.status(400).send({
                auth: false,
                code: 'general_genericErrorMessage',
                message: 'User has no fleets',
                type: 'topmessage',
              });
            }

            let fleetArray = getArrayOfFleetId(allFleets);
            FLeetKmHandler.updateAcceptKms(fleetArray, acceptKMs)
              .then(function (response) {
                if (response.status)
                  return res
                    .status(response.status)
                    .send({ message: response.message });
                else return res.status(200).send({ message: response.message });
              })
              .catch(function (error) {
                console.error(`[${context}] Error `, error.message.message);
                return res.status(error.status).send(error.message);
              });
          })
          .catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({
              message: {
                auth: false,
                code: 'general_genericErrorMessage',
                message: error.message,
                type: 'dialog',
              },
            });
          });
      })
      .catch(function (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send({
          message: {
            auth: false,
            code: 'general_genericErrorMessage',
            message: error.message,
            type: 'dialog',
          },
        });
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send({
      message: {
        auth: false,
        code: 'general_genericErrorMessage',
        message: error.message,
        type: 'dialog',
      },
    });
  }
});

router.patch('/api/private/fleets/user/updateKms', (req, res, next) => {
  const context = 'PATCH /api/private/fleets/user/updateKms';
  try {
    const userID = req.headers['userid'];
    const updateKMs = req.body.updateKms;

    if (!userID || typeof updateKMs !== 'boolean') {
      console.error(`[${context}] Error - missing input information`);
      return res.status(400).send({
        auth: false,
        code: 'general_genericErrorMessage',
        message: 'missing input information',
        type: 'dialog',
      });
    }

    // validate userID
    Utils.getUserById(userID)
      .then(function (userRequest) {
        if (userRequest.status !== 200) {
          console.error(`[${context}] Error - Getting Charging Session `);
          return res.status(400).send({
            auth: false,
            code: 'general_genericErrorMessage',
            message: 'Error Getting Charging Session',
            type: 'topmessage',
          });
        }
        const user = userRequest.data;
        if (!user) {
          console.error(`[${context}] Error - No user Found`);
          return res.status(400).send({
            auth: false,
            code: 'general_genericErrorMessage',
            message: 'No user Found',
            type: 'topmessage',
          });
        }

        // get all fleet from this user
        let query = {
          createUserId: user._id,
        };
        Fleets.find(query, { _id: 1 })
          .then(function (allFleets) {
            if (!allFleets || allFleets.length < 1) {
              console.error(`[${context}] Error - User has no fleets`);
              return res.status(400).send({
                auth: false,
                code: 'general_genericErrorMessage',
                message: 'User has no fleets',
                type: 'topmessage',
              });
            }

            let fleetArray = getArrayOfFleetId(allFleets);
            FLeetKmHandler.updateUpdateKms(fleetArray, updateKMs)
              .then(function (response) {
                if (response.status)
                  return res
                    .status(response.status)
                    .send({ message: response.message });
                else return res.status(200).send({ message: response.message });
              })
              .catch(function (error) {
                console.error(`[${context}] Error `, error.message.message);
                return res.status(error.status).send(error.message);
              });
          })
          .catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({
              message: {
                auth: false,
                code: 'general_genericErrorMessage',
                message: error.message,
                type: 'dialog',
              },
            });
          });
      })
      .catch(function (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send({
          message: {
            auth: false,
            code: 'general_genericErrorMessage',
            message: error.message,
            type: 'dialog',
          },
        });
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send({
      message: {
        auth: false,
        code: 'general_genericErrorMessage',
        message: error.message,
        type: 'dialog',
      },
    });
  }
});

router.patch('/api/private/fleets/updateKMs', (req, res, next) => {
  const context = 'PATCH /api/private/fleets/updateKMs ';
  try {
    let fleetID = req.body.fleetID;
    let updateKMs = req.body.updateKMs;

    if (!fleetID || typeof updateKMs !== 'boolean') {
      console.error(`[${context}] Error - missing input information`);
      return res.status(400).send({
        message: {
          auth: false,
          code: '',
          message: 'missing input information',
          type: 'dialog',
        },
      });
    }

    FLeetKmHandler.updateUpdateKms([fleetID], updateKMs)
      .then(function (response) {
        if (!response) {
          console.error(
            `[${context}] Error - missing Response from FLeetKmHandler`,
          );
          return res.status(response.status).send({
            message: {
              auth: false,
              code: 'general_genericErrorMessage',
              message: 'missing Response from FLeetKmHandler',
              type: 'dialog',
            },
          });
        } else return res.status(200).send({ message: response.message });
      })
      .catch(function (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(error.status).send({ message: error.message });
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send({
      message: {
        auth: false,
        code: '',
        message: error.message,
        type: 'dialog',
      },
    });
  }
});

//========== GET ==========
//Get all my groups fleets
router.get('/api/private/fleets', async (req, res, next) => {
  var context = 'GET /api/private/fleets';
  try {
    const { userid: userId, version } = req.headers;

    console.log(`[${context}] userId: ${userId}, version: ${version}`);

    let listOfFleets = [];
    if (version === '2') {
      listOfFleets = await FleetsHandler.userFleetsInfoV2(userId, req.query);
    } else {
      listOfFleets = await FleetsHandler.userFleetsInfo(userId);
    }
    return res.status(200).json(listOfFleets);
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(400).json({
      auth: true,
      code: 'error_fleet_bad_request',
      message: error.message,
    });
  }
});

router.get('/api/private/fleets/byIdList', async (req, res, next) => {
  var context = 'GET /api/private/fleets/byIdList';
  try {
    const listOfFleetsIds = req?.body?.listOfFleetsIds ?? [];
    let listOfFleets = await FleetsHandler.fleetsInfoListIds(listOfFleetsIds);
    return res.status(200).send(listOfFleets);
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Get other Evs
router.get('/api/private/fleets/otherEvs', async (req, res, next) => {
  const context = 'GET /api/private/fleets/otherEvs';
  try {
    let userId = req.headers['userid'];
    let clientName = req.headers['clientname'];
    //console.log("clientName ", context, " ", clientName);

    let groupDrivers = await getGroupDrivers(userId, res, clientName);
    let evs = await getEvs(userId, groupDrivers, res);

    if (evs.length >= 0) {
      let fleets = await getFleetsNew(evs);
      fleets.sort((a, b) => (a._id > b._id ? 1 : b._id > a._id ? -1 : 0));
      return res.status(200).send(fleets);
    } else {
      return res.status(200).send([]);
    }
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Get all my groups fleets and fleets of my clients (B2B User)
router.get('/api/private/fleets/toAddOnChargerB2B', (req, res, next) => {
  var context = 'GET /api/private/fleets/toAddOnChargerB2B';
  try {
    let userId = req.headers['userid'];
    let headers = {
      userid: userId,
    };
    let proxyUser = process.env.HostUsers + process.env.PathGetClientListB2B;

    axios
      .get(proxyUser, { headers })
      .then(async (result) => {
        var query;
        if (result.data.clientList.length > 0) {
          console.log('with client List');

          let clientList = result.data.clientList;
          let clientsuser = [];

          clientList.map((client) => {
            if (
              client.clientType === process.env.ClientTypeFleet ||
              client.clientType === process.env.ClientTypeBoth
            )
              clientsuser.push(client.userId);
          });

          query = {
            $or: [
              { createUserId: userId },
              {
                $and: [{ createUserId: clientsuser }, { sharedWithOPC: true }],
              },
            ],
          };
        } else {
          console.log('without client List');

          query = {
            createUserId: userId,
          };
        }

        console.log('Query', query);

        Fleets.find(query, (err, fleetsFound) => {
          if (err) {
            console.error(`[${context}][Fleets.find] Error `, err.message);
            return res.status(500).send(err.message);
          } else {
            if (fleetsFound.length === 0) {
              return res.status(200).send(fleetsFound);
            } else {
              var sendToFrontEnd = [];
              const getEVS = (fleet) => {
                return new Promise(async (resolve, reject) => {
                  let listEvs = await getEvsIdMyFleets(fleet);
                  var newFleet = {
                    _id: fleet._id,
                    name: fleet.name,
                    sharedWithOPC: fleet.sharedWithOPC,
                    imageContent: fleet.imageContent,
                    createUserId: fleet.createUserId,
                    listEvs: listEvs,
                  };
                  sendToFrontEnd.push(newFleet);
                  resolve(true);
                });
              };

              Promise.all(
                fleetsFound.map((fleet) => {
                  return new Promise(async (resolve, reject) => {
                    var listEvs = [];
                    fleet = JSON.parse(JSON.stringify(fleet));
                    Promise.all(
                      fleet.listEvs.map((ev) => {
                        return new Promise(async (resolve, reject) => {
                          ev = JSON.parse(JSON.stringify(ev));
                          if (typeof ev.evId == null) {
                            console.log('Error ev.evId is null');
                            reject('Error ev.evId is null');
                          }
                          var query = {
                            _id: ev.evId,
                          };

                          EV.findOne(query, (err, evFound) => {
                            if (err) {
                              console.error(
                                `[${context}][EV.findOne] Error `,
                                err.message,
                              );
                              reject(err);
                            } else {
                              if (evFound) {
                                evFound = JSON.parse(JSON.stringify(evFound));
                                evFound.evId = ev.evId;
                                listEvs.push(evFound);
                              } else {
                                console.log(`evId ${ev?.evId} not found`);
                              }
                              resolve(true);
                            }
                          });
                        });
                      }),
                    )
                      .then(() => {
                        fleet.listEvs = listEvs;
                        sendToFrontEnd.push(fleet);
                        resolve(true);
                      })
                      .catch((error) => {
                        console.error(
                          `[${context}][EV.findOne] Error `,
                          error.message,
                        );
                        reject(error);
                      });
                  });
                }),
              )
                .then(() => {
                  sendToFrontEnd.sort((a, b) =>
                    a._id > b._id ? 1 : b._id > a._id ? -1 : 0,
                  );
                  return res.status(200).send(sendToFrontEnd);
                })
                .catch((error) => {
                  console.error(
                    `[${context}][fleetsFound.map][.catch] Error `,
                    error.message,
                  );
                  return res.status(500).send(error.message);
                });
            }
          }
        });
      })
      .catch((error) => {
        console.error(`[${context}][axios.get] Error `, error.message);
        return res.status(500).send(error.message);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Get my fleet for map
router.get('/api/private/fleets/map', (req, res, next) => {
  var context = 'GET /api/private/fleets/map';
  try {
    var userId = req.headers['userid'];
    var query = {
      createUserId: userId,
    };
    var fields = {
      _id: 1,
    };
    Fleets.find(query, fields, (err, fleetsFound) => {
      if (err) {
        console.log(`[${context}][ Fleets.find.find] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (fleetsFound.length == 0) return res.status(200).send(fleetsFound);
        else {
          var newfleets = [];
          Promise.all(
            fleetsFound.map((fleet) => {
              return new Promise((resolve) => {
                newfleets.push(fleet._id);
                resolve(true);
              });
            }),
          ).then(() => {
            return res.status(200).send(newfleets);
          });
        }
      }
    });
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Get all my groups fleets
router.get('/api/private/fleets/byId_old', (req, res, next) => {
  var context = 'GET /api/private/fleets/byId_old';
  try {
    var query = req.query;
    // console.log("origin-microservice - /api/private/fleets/byId" , JSON.stringify(req.headers['origin-microservice']))

    Fleets.findOne(query, async (err, fleetFound) => {
      if (err) {
        console.error(`[${context}] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (fleetFound) {
          let listEvs = await getEvsIdMyFleets(
            fleetFound,
            fleetFound.createUserId,
          );
          var newFleet = {
            _id: fleetFound._id,
            name: fleetFound.name,
            sharedWithOPC: fleetFound.sharedWithOPC,
            imageContent: fleetFound.imageContent,
            createUserId: fleetFound.createUserId,
            listEvs: listEvs,
          };
          return res.status(200).send(newFleet);
        } else {
          return res.status(200).send(fleetFound);
        }
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.get('/api/private/fleets/byId', async (req, res, next) => {
  const context = 'GET /api/private/fleets/byId';
  try {
    const fleetId = req?.query?._id;
    const fleet = await FleetsHandler.fleetInfoById(fleetId);
    return res.status(200).send(fleet);
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.get('/api/private/fleets/sharedWithOPC', (req, res, next) => {
  var context = 'GET /api/private/fleets/sharedWithOPC';
  try {
    var createUserIds = req.body.createUserIds;
    var query = {
      createUserId: createUserIds,
      sharedWithOPC: true,
    };
    Fleets.find(
      query,
      /*fields,*/ (err, fleetsFound) => {
        if (err) {
          console.log(`[${context}][ Fleets.find.find] Error `, err.message);
          return res.status(500).send(err.message);
        } else {
          if (fleetsFound.length > 0) {
            return res.status(200).send(fleetsFound);
          } else {
            return res.status(200).send([]);
          }
        }
      },
    );
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

router.get('/api/private/fleets/myFleets', (req, res, next) => {
  var context = 'GET /api/private/fleets/myFleets';
  try {
    var userId = req.headers['userid'];

    var query = {
      createUserId: userId,
    };

    Fleets.find(query, (err, fleetsFound) => {
      if (err) {
        console.error(`[${context}][Fleets.find] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        return res.status(200).send(fleetsFound);
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//========== DELETE ==========
//Delete a fleets group
//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.delete('/api/private/fleets_old', (req, res, next) => {
  var context = 'DELETE /api/private/fleets';
  try {
    var fleets = req.body;
    var query = {
      _id: fleets._id,
    };
    Fleets.removeFleets(query, (err, result) => {
      if (err) {
        console.error(`[${context}][findOne] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (result) {
          //whenRemoveFleet(fleets);
          //removeFleetFromCharger(fleets);
          return res.status(200).send({
            auth: true,
            code: 'server_fleet_group_removed',
            message: 'Fleet group removed',
          });
        } else
          return res.status(400).send({
            auth: false,
            code: 'server_fleet_not_found',
            message: 'Fleet not found for given parameters',
          });
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Delete a fleets group
router.delete('/api/private/fleets', (req, res, next) => {
  var context = 'DELETE /api/private/fleets';
  try {
    var fleets = req.body;
    var query = {
      _id: fleets._id,
    };

    Fleets.findOne(query, (err, fleetFound) => {
      if (err) {
        console.error(`[${context}] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        console.log('fleetFound');
        console.log(fleetFound);

        if (fleetFound.listEvs.length === 0) {
          Fleets.removeFleets(query, (err, result) => {
            if (err) {
              console.error(`[${context}][findOne] Error `, err.message);
              return res.status(500).send(err.message);
            } else {
              if (result) {
                removeFleetFromCharger(fleets);
                EVsHandler.validateOnlyOneEV(fleets.createUserId);
                if (
                  fleetFound.imageContent == '' ||
                  fleetFound.imageContent == undefined
                ) {
                  return res.status(200).send({
                    auth: true,
                    code: 'server_fleet_group_removed',
                    message: 'Fleet group removed',
                  });
                } else {
                  unlikImage(fleetFound)
                    .then(() => {
                      return res.status(200).send({
                        auth: true,
                        code: 'server_fleet_group_removed',
                        message: 'Fleet group removed',
                      });
                    })
                    .catch((err) => {
                      console.error(
                        `[${context}][unlikImage] Error `,
                        err.message,
                      );
                      return res.status(500).send(err.message);
                    });
                }
              } else
                return res.status(400).send({
                  auth: false,
                  code: 'server_fleet_not_found',
                  message: 'Fleet not found for given parameters',
                });
            }
          });
        } else {
          let listEvs = fleetFound.listEvs;

          Promise.all(
            listEvs.map((ev) => {
              return new Promise(async (resolve, reject) => {
                removeEV(ev)
                  .then((result) => {
                    if (result) {
                      listEvs = listEvs.filter((elem) => {
                        return elem.evId !== ev.evId;
                      });

                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  })
                  .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    resolve(false);
                  });
              });
            }),
          )
            .then(() => {
              if (listEvs.length === 0) {
                Fleets.removeFleets(query, (err, result) => {
                  if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                  } else {
                    if (result) {
                      removeFleetFromCharger(fleets);
                      EVsHandler.validateOnlyOneEV(fleets.createUserId);
                      if (
                        fleetFound.imageContent == '' ||
                        fleetFound.imageContent == undefined
                      ) {
                        return res.status(200).send({
                          auth: true,
                          code: 'server_fleet_group_removed',
                          message: 'Fleet group removed',
                        });
                      } else {
                        unlikImage(fleetFound)
                          .then(() => {
                            return res.status(200).send({
                              auth: true,
                              code: 'server_fleet_group_removed',
                              message: 'Fleet group removed',
                            });
                          })
                          .catch((err) => {
                            console.error(
                              `[${context}][unlikImage] Error `,
                              err.message,
                            );
                            return res.status(500).send(err.message);
                          });
                      }
                    } else
                      return res.status(400).send({
                        auth: false,
                        code: 'server_fleet_not_removed',
                        message: 'Fleet not removed',
                      });
                  }
                });
              } else {
                //fleetFound.listEvs: listEvs
                let newValues = {
                  $set: {
                    listEvs: listEvs,
                  },
                };

                Fleets.updateFleets(query, newValues, (err, result) => {
                  if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                  } else {
                    return res.status(400).send({
                      auth: false,
                      code: 'server_fleet_not_removed',
                      message: 'Fleet not removed',
                    });
                  }
                });
              }
            })
            .catch((error) => {
              console.error(`[${context}] Error `, error.message);
              return res.status(500).send(error.message);
            });
        }
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Delete a fleets by user
//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.delete('/api/private/fleets/user_old', (req, res, next) => {
  var context = 'DELETE /api/private/fleets/user';
  try {
    var userId = req.headers['userid'];
    var query = {
      createUserId: userId,
    };
    fleetFind(query)
      .then((fleetsFound) => {
        if (fleetsFound.length === 0) {
          return res.status(200).send([]);
        } else {
          Promise.all(
            fleetsFound.map((fleets) => {
              return new Promise((resolve, reject) => {
                var query = {
                  _id: fleets._id,
                };
                Fleets.removeFleets(query, (err, result) => {
                  if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    reject(err);
                  } else {
                    if (result) {
                      whenRemoveFleet(query);
                      resolve(true);
                    } else resolve(false);
                  }
                });
              });
            }),
          )
            .then((result) => {
              return res.status(200).send(result);
            })
            .catch((error) => {
              console.error(`[${context}] Error `, error.message);
              return res.status(500).send(error.message);
            });
        }
      })
      .catch((error) => {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//Delete a fleets by user
//TODO Review when remove user
router.delete('/api/private/fleets/user', (req, res, next) => {
  var context = 'DELETE /api/private/fleets/user';
  try {
    var userId = req.headers['userid'];
    var query = {
      createUserId: userId,
    };
    fleetFind(query)
      .then((fleetsFound) => {
        if (fleetsFound.length === 0) {
          return res.status(200).send([]);
        } else {
          Promise.all(
            fleetsFound.map((fleets) => {
              return new Promise((resolve, reject) => {
                if (fleets.listEvs.length === 0) {
                  Fleets.removeFleets({ _id: fleer._id }, (err, result) => {
                    if (err) {
                      console.error(
                        `[${context}][findOne] Error `,
                        err.message,
                      );
                      reject(err);
                    } else {
                      removeFleetFromCharger(fleets);
                      resolve(true);
                    }
                  });
                } else {
                  let listEvs = fleets.listEvs;
                  Promise.all(
                    listEvs.map((ev) => {
                      return new Promise(async (resolve, reject) => {
                        removeEVWhenUserDeleted(ev)
                          .then((result) => {
                            resolve(true);
                          })
                          .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            resolve(false);
                          });
                      });
                    }),
                  )
                    .then(() => {
                      Fleets.removeFleets(
                        { _id: fleets._id },
                        (err, result) => {
                          if (err) {
                            console.error(
                              `[${context}][findOne] Error `,
                              err.message,
                            );
                            return res.status(500).send(err.message);
                          } else {
                            if (result) {
                              removeFleetFromCharger(fleets);
                              if (
                                fleets.imageContent == '' ||
                                fleets.imageContent == undefined
                              ) {
                                return res.status(200).send({
                                  auth: true,
                                  code: 'server_fleet_group_removed',
                                  message: 'Fleet group removed',
                                });
                              } else {
                                unlikImage(fleets)
                                  .then(() => {
                                    return res.status(200).send({
                                      auth: true,
                                      code: 'server_fleet_group_removed',
                                      message: 'Fleet group removed',
                                    });
                                  })
                                  .catch((err) => {
                                    console.error(
                                      `[${context}][unlikImage] Error `,
                                      err.message,
                                    );
                                    return res.status(500).send(err.message);
                                  });
                              }
                            } else
                              return res.status(400).send({
                                auth: false,
                                code: 'server_fleet_not_removed',
                                message: 'Fleet not removed',
                              });
                          }
                        },
                      );
                    })
                    .catch((error) => {
                      console.error(`[${context}] Error `, error.message);
                      rreject(error);
                    });
                }
              });
            }),
          )
            .then((result) => {
              return res.status(200).send(result);
            })
            .catch((error) => {
              console.error(`[${context}] Error `, error.message);
              return res.status(500).send(error.message);
            });
        }
      })
      .catch((error) => {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
});

//========== FUNCTIONS ==========
// Function to validate data of fleets
function validateFields(fleet) {
  return new Promise((resolve, reject) => {
    var context = 'Function validateFields';

    if (!fleet)
      reject({
        auth: false,
        code: 'server_fleet_data_required',
        message: 'Fleet data is required',
      });
    else if (!fleet.name)
      reject({
        auth: false,
        code: 'server_fleet_name_required',
        message: 'Fleet name is required',
      });
    else if (!fleet.createUserId)
      reject({
        auth: false,
        code: 'server_user_id_required',
        message: 'User id is required',
      });
    else resolve(true);
  });
}

//Function to save image on file
function saveImageContent(fleet) {
  var context = 'Function saveImageContent';
  return new Promise((resolve, reject) => {
    var dateNow = Date.now();
    var path = `/usr/src/app/img/fleets/${fleet._id}_${dateNow}.jpg`;
    var pathImage = '';
    var base64Image = fleet.imageContent.split(';base64,').pop();

    if (process.env.NODE_ENV === 'production') {
      pathImage = `${process.env.HostProd}fleets/${fleet._id}_${dateNow}.jpg`; // For PROD server
    } else if (process.env.NODE_ENV === 'pre-production') {
      pathImage = `${process.env.HostPreProd}fleets/${fleet._id}_${dateNow}.jpg`; // For PROD server
    } else {
      //pathImage =  `${process.env.HostLocal}fleets/${fleet._id}_${dateNow}.jpg`; // For local host
      pathImage = `${process.env.HostQA}fleets/${fleet._id}_${dateNow}.jpg`; // For QA server
    }

    fs.writeFile(
      path,
      base64Image,
      { encoding: 'base64' },
      function (err, result) {
        if (err) {
          console.error(`[${context}] Error `, err.message);
          reject(err);
        } else {
          fleet.imageContent = pathImage;
          resolve(fleet);
        }
      },
    );
  });
}

//Function to delete image
function unlikImage(fleet) {
  var context = 'Function unlinkImage';
  return new Promise((resolve, reject) => {
    const image = fleet.imageContent.split('/');

    const path = `/usr/src/app/img/fleets/${image[image.length - 1]}`;

    fs.unlink(path, (err, result) => {
      if (err) {
        console.error(`[${context}] [fs.unlink]Error `, err.message);
        resolve(fleet);
        //reject(err);
      } else {
        resolve(fleet);
      }
    });
  });
}

//Function to create fleets
function createFleets(fleet, res) {
  var context = 'Function createFleets';
  try {
    var query = {
      $and: [{ name: fleet.name }, { createUserId: fleet.createUserId }],
    };

    Fleets.findOne(query, (err, result) => {
      if (err) {
        console.error(`[${context}][findOne] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (result)
          return res.status(409).send({
            auth: false,
            code: 'server_group_name_exist',
            message: 'Group name already exists',
          });
        else {
          Fleets.createFleets(fleet, (err, result) => {
            if (err) {
              console.error(`[${context}][createFleets] Error `, err.message);
              return res.status(500).send(err.message);
            } else {
              if (result) return res.status(200).send(result);
              else
                return res.status(400).send({
                  auth: false,
                  code: 'server_group_not_created',
                  message: 'Group not created',
                });
            }
          });
        }
      }
    });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

//Function to update a fleet
function updateFleets(fleet, query, res) {
  var context = 'Funciton updateFleets';
  return new Promise((resolve, reject) => {
    try {
      Fleets.updateFleets(query, fleet, (err, result) => {
        if (err) {
          console.error(`[${context}][updateFleets] Error `, err.message);
          reject(err);
        } else {
          if (result) resolve(true);
          else resolve(false);
        }
      });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

//Function to find one fleet
function findOneFleet(query) {
  var context = 'Funciton findOneFleet';
  return new Promise((resolve, reject) => {
    try {
      Fleets.findOne(query, (err, fleetFound) => {
        if (err) {
          console.error(`[${context}][findOne] Error `, err.message);
          reject(err);
        } else {
          if (fleetFound) {
            resolve(fleetFound);
          } else
            reject({
              auth: false,
              code: 'server_fleet_not_found',
              message: 'Fleet not found for given parameters',
            });
        }
      });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return res.status(500).send(error.message);
    }
  });
}

//Function to find fleets
function fleetFind(query) {
  var context = 'Funciton fleetFind';
  return new Promise((resolve, reject) => {
    try {
      Fleets.find(query, (err, fleetsFound) => {
        if (err) {
          console.error(`[${context}][findOne] Error `, err.message);
          reject(err);
        } else {
          resolve(fleetsFound);
        }
      });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      return res.status(500).send(error.message);
    }
  });
}

//Function to get ev by list of Drivers and list of group Drivers
function getEvs(userId, groupDrivers, res) {
  var context = 'Function getEvs';
  return new Promise((resolve) => {
    var dateNow = new Date();
    if (groupDrivers.length == 0) {
      var query = {
        listOfDrivers: {
          $elemMatch: {
            userId: userId,
          },
        },
        hasFleet: true,
      };
    } else {
      var query = {
        $or: [
          {
            listOfDrivers: {
              $elemMatch: {
                userId: userId,
              },
            },
          },
          {
            listOfGroupDrivers: {
              $elemMatch: {
                groupId: groupDrivers,
              },
            },
          },
        ],
        hasFleet: true,
      };
    }

    EV.find(query, (err, evsFound) => {
      if (err) {
        console.error(`[${context}][find] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        if (evsFound.length == 0) {
          resolve(evsFound);
        } else {
          var newEvsFound = [];
          Promise.all(
            evsFound.map((ev) => {
              return new Promise(async (resolve) => {
                ev = JSON.parse(JSON.stringify(ev));
                let networks = await getNetworksEV(ev);
                ev.networks = networks;

                if (
                  ev.listOfDrivers.length != 0 &&
                  ev.listOfGroupDrivers.length == 0
                ) {
                  getValidationDriver(ev, userId, dateNow).then((result) => {
                    if (result) {
                      newEvsFound.push(ev);
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  });
                } else if (
                  ev.listOfDrivers.length == 0 &&
                  ev.listOfGroupDrivers.length != 0
                ) {
                  getValidationGroupDrivers(ev, dateNow, groupDrivers).then(
                    (result) => {
                      if (result) {
                        newEvsFound.push(ev);
                        resolve(true);
                      } else {
                        resolve(false);
                      }
                    },
                  );
                } else if (
                  ev.listOfDrivers.length != 0 &&
                  ev.listOfGroupDrivers.length != 0
                ) {
                  getValidationDriver(ev, userId, dateNow).then((result) => {
                    if (result) {
                      newEvsFound.push(ev);
                      resolve(true);
                    } else {
                      getValidationGroupDrivers(ev, dateNow, groupDrivers).then(
                        (result) => {
                          if (result) {
                            newEvsFound.push(ev);
                            resolve(true);
                          } else {
                            resolve(false);
                          }
                        },
                      );
                    }
                  });
                } else {
                  resolve(false);
                }
              });
            }),
          ).then(() => {
            resolve(newEvsFound);
          });
        }
      }
    });
  });
}

function getEvsNew(userId, groupDrivers, res) {
  var context = 'Function getEvsNew';
  return new Promise((resolve) => {
    if (groupDrivers.length == 0) {
      var query = {
        listOfDrivers: {
          $elemMatch: {
            userId: userId,
          },
        },
      };
    } else {
      var query = {
        $or: [
          {
            listOfDrivers: {
              $elemMatch: {
                userId: userId,
              },
            },
          },
          {
            listOfGroupDrivers: {
              $elemMatch: {
                groupId: groupDrivers,
              },
            },
          },
        ],
      };
    }

    EV.find(query, (err, evsFound) => {
      if (err) {
        console.error(`[${context}][find] Error `, err.message);
        return res.status(500).send(err.message);
      } else {
        resolve(evsFound);
      }
    });
  });
}

function getFleetsNew(evs) {
  const context = 'Function getFleetsNew';
  return new Promise((resolve, reject) => {
    evs = JSON.parse(JSON.stringify(evs));
    let listOfFleets = [];
    let listOfEvs = [];

    Promise.all(
      evs.map((ev) => {
        return new Promise(async (resolve, reject) => {
          try {
            if (!(ev.fleet === '' || ev.fleet === undefined)) {
              listOfFleets.push(ev.fleet);
            }

            let plafond;
            //console.log("Plafonde", ev.plafondId)
            if (ev.plafondId && ev.plafondId != '-1') {
              ///console.log("Plafonde 1", ev.plafondId)
              plafond = await getPlafondValue(ev.plafondId);
            }

            if (plafond) {
              ev.plafond = plafond.amount.value;
              ev.plafondInfo = plafond;
            } else {
              ev.plafond = 0;
              ev.plafondInfo = {};
            }
            ev.evId = ev._id;

            if (
              ev.listOfDrivers.length != 0 &&
              ev.listOfGroupDrivers.length == 0
            ) {
              let listOfDrivers = await getDrivers(ev);
              //let listOfDrivers = await getDriversNew(ev);
              ev.listOfDrivers = listOfDrivers;
              listOfEvs.push(ev);
              resolve(true);
            } else if (
              ev.listOfDrivers.length == 0 &&
              ev.listOfGroupDrivers.length != 0
            ) {
              let listOfGroupDrivers = await getGroupsDrivers(ev);
              //let listOfGroupDrivers = await getGroupsDriversNew(ev);
              ev.listOfGroupDrivers = listOfGroupDrivers;
              listOfEvs.push(ev);
              resolve(true);
            } else if (
              ev.listOfDrivers.length != 0 &&
              ev.listOfGroupDrivers.length != 0
            ) {
              let listOfGroupDrivers = await getGroupsDrivers(ev);
              let listOfDrivers = await getDrivers(ev);
              //let listOfGroupDrivers = await getGroupsDriversNew(ev);
              //let listOfDrivers = await getDriversNew(ev);
              ev.listOfDrivers = listOfDrivers;
              ev.listOfGroupDrivers = listOfGroupDrivers;
              listOfEvs.push(ev);
              resolve(true);
            } else {
              listOfEvs.push(ev);
              resolve(true);
            }
          } catch (error) {
            console.error(`[${context}]Error `, error.message);
            reject(error);
          }
        });
      }),
    )
      .then(() => {
        let query = {
          _id: listOfFleets,
        };
        fleetFind(query)
          .then(async (fleetsFound) => {
            try {
              let fleets = await putEvsFleet(fleetsFound, listOfEvs);
              resolve(fleets);
            } catch (error) {
              console.error(`[${context}][fleetFind] Error `, error.message);
              reject(error);
            }
          })
          .catch((error) => {
            console.error(`[${context}][fleetFind] Error `, error.message);
            reject(error);
          });
      })
      .catch((error) => {
        console.error(`[${context}]Error `, error.message);
        reject(error);
      });
  });
}

//Funtion to get the fleet of one ev
async function getFleets(evs, res) {
  var context = 'Function getFleets';
  return new Promise((resolve) => {
    var listOfFleets = [];
    const findEvFleet = (ev) => {
      return new Promise((resolve, reject) => {
        var query = {
          listEvs: {
            $elemMatch: {
              evId: ev._id,
            },
          },
        };
        Fleets.find(query, (err, fleetsFound) => {
          if (err) {
            console.error(`[${context}][find] Error `, err.message);
            reject(err);
          } else {
            if (fleetsFound.length > 0) {
              const getFleets = (fleet) => {
                return new Promise(async (resolve) => {
                  var newlistEvs = [];
                  ev = JSON.parse(JSON.stringify(ev));
                  ev.evId = ev._id;
                  newlistEvs.push(ev);
                  var newFleet = {
                    _id: fleet._id,
                    name: fleet.name,
                    sharedWithOPC: fleet.sharedWithOPC,
                    imageContent: fleet.imageContent,
                    createUserId: fleet.createUserId,
                    listEvs: newlistEvs,
                  };
                  listOfFleets.push(newFleet);
                  resolve(true);
                });
              };
              Promise.all(fleetsFound.map((fleet) => getFleets(fleet))).then(
                () => {
                  resolve(true);
                },
              );
            } else {
              resolve(true);
            }
          }
        });
      });
    };
    Promise.all(evs.map((ev) => findEvFleet(ev))).then(async () => {
      let newListOfFleets = await adjustList(listOfFleets);
      resolve(newListOfFleets);
    });
  });
}

//Funtion to join evs ids in an array
function getEvsId(fleet) {
  var context = 'Function getEvsId';
  return new Promise((resolve) => {
    var listOfEvs = [];
    const getId = (ev) => {
      return new Promise((resolve) => {
        var query = {
          _id: ev.evId,
        };
        EV.findOne(query, (err, evFound) => {
          if (err) {
            console.error(`[${context}][EV.find] Error `, err.message);
            reject(err);
          } else {
            if (evFound) {
              evFound = JSON.parse(JSON.stringify(evFound));
              evFound._id = ev._id;
              evFound.evId = ev.evId;
              if (
                evFound.listOfDrivers.length == 0 &&
                evFound.listOfGroupDrivers.length == 0
              ) {
                listOfEvs.push(evFound);
                resolve(true);
              } else if (
                evFound.listOfDrivers.length != 0 &&
                evFound.listOfGroupDrivers.length == 0
              ) {
                getDrivers(evFound).then((listOfDrivers) => {
                  evFound.listOfDrivers = listOfDrivers;
                  listOfEvs.push(evFound);
                  resolve(true);
                });
              } else if (
                evFound.listOfDrivers.length == 0 &&
                evFound.listOfGroupDrivers.length != 0
              ) {
                getGroupsDrivers(evFound).then((listOfGroupDrivers) => {
                  evFound.listOfGroupDrivers = listOfGroupDrivers;
                  listOfEvs.push(evFound);
                  resolve(true);
                });
              } else {
                getGroupsDrivers(evFound).then((listOfGroupDrivers) => {
                  getDrivers(evFound).then((listOfDrivers) => {
                    evFound.listOfGroupDrivers = listOfGroupDrivers;
                    evFound.listOfDrivers = listOfDrivers;
                    listOfEvs.push(evFound);
                    resolve(true);
                  });
                });
              }
            } else {
              listOfEvs.push(ev);
              resolve(true);
            }
          }
        });
      });
    };
    Promise.all(fleet.listEvs.map((ev) => getId(ev))).then(() => {
      listOfEvs.sort((a, b) =>
        a.evId > b.evId ? 1 : b.evId > a.evId ? -1 : 0,
      );
      resolve(listOfEvs);
    });
  });
}

function getEvsIdMyFleets(fleet, userId) {
  var context = 'Function getEvsIdMyFleets';
  return new Promise((resolve) => {
    var listOfEvs = [];

    if (fleet.listEvs.length > 0) {
      const getId = (ev) => {
        return new Promise((resolve) => {
          var query = {
            _id: ev.evId,
          };
          EV.findOne(query, async (err, evFound) => {
            if (err) {
              console.error(`[${context}][EV.find] Error `, err.message);
              reject(err);
            } else {
              if (evFound) {
                evFound = JSON.parse(JSON.stringify(evFound));
                evFound._id = ev._id;
                evFound.evId = ev.evId;

                let contract = await getEvContract(ev.evId, userId);
                if (contract.length !== 0) {
                  //first element
                  evFound.contract = contract[0];
                }

                if (
                  evFound.listOfDrivers.length == 0 &&
                  evFound.listOfGroupDrivers.length == 0
                ) {
                  listOfEvs.push(evFound);
                  resolve(true);
                } else if (
                  evFound.listOfDrivers.length != 0 &&
                  evFound.listOfGroupDrivers.length == 0
                ) {
                  getDriversMyFleets(evFound).then((listOfDrivers) => {
                    evFound.listOfDrivers = listOfDrivers;
                    listOfEvs.push(evFound);
                    resolve(true);
                  });
                } else if (
                  evFound.listOfDrivers.length == 0 &&
                  evFound.listOfGroupDrivers.length != 0
                ) {
                  getGroupsDriversMyFleets(evFound).then(
                    (listOfGroupDrivers) => {
                      evFound.listOfGroupDrivers = listOfGroupDrivers;
                      listOfEvs.push(evFound);
                      resolve(true);
                    },
                  );
                } else {
                  getGroupsDriversMyFleets(evFound).then(
                    (listOfGroupDrivers) => {
                      getDriversMyFleets(evFound).then((listOfDrivers) => {
                        evFound.listOfGroupDrivers = listOfGroupDrivers;
                        evFound.listOfDrivers = listOfDrivers;
                        listOfEvs.push(evFound);
                        resolve(true);
                      });
                    },
                  );
                }
              } else {
                listOfEvs.push(ev);
                resolve(true);
              }
            }
          });
        });
      };
      Promise.all(fleet.listEvs.map((ev) => getId(ev))).then(() => {
        listOfEvs.sort((a, b) =>
          a.evId > b.evId ? 1 : b.evId > a.evId ? -1 : 0,
        );
        resolve(listOfEvs);
      });
    } else {
      resolve(listOfEvs);
    }
  });
}
//Funtion to adjust the array of fleets (check that there are no duplicates)
async function adjustList(listOfFleets) {
  var context = 'Function adjustList';
  return new Promise(async (resolve) => {
    var newListOfFleets = [];

    const getList = (list) => {
      return new Promise((resolve) => {
        if (newListOfFleets.length == 0) {
          newListOfFleets.push(list);
          resolve(true);
        } else {
          var found = newListOfFleets.indexOf(
            newListOfFleets.find((elem) => {
              return JSON.stringify(elem._id) === JSON.stringify(list._id);
            }),
          );
          if (found >= 0) {
            //("newListOfFleets[found]", newListOfFleets[found]);
            var newFound = newListOfFleets[found].listEvs.indexOf(
              newListOfFleets[found].listEvs.find((elem) => {
                return (
                  JSON.stringify(elem._id) ===
                  JSON.stringify(list.listEvs[0]._id)
                );
              }),
            );

            if (newFound >= 0) {
              resolve(true);
            } else {
              newListOfFleets[found].listEvs.push(list.listEvs[0]);
              resolve(true);
            }
          } else {
            newListOfFleets.push(list);
            resolve(true);
          }
        }
      });
    };
    Promise.all(listOfFleets.map((list) => getList(list))).then(() => {
      resolve(newListOfFleets);
    });
  });
}

//Funtion to get the group drivers I belong to
function getGroupDrivers(userId, res, clientName) {
  var context = 'Function getGroupDrivers';
  return new Promise((resolve) => {
    var host = process.env.HostUsers + process.env.PathGetGroupDrivers;
    var headers = {
      userid: userId,
      clientname: clientName,
    };

    axios
      .get(host, { headers })
      .then((value) => {
        if (value.data.length == 0) {
          resolve(value.data);
        } else {
          var groupDrivers = [];
          const getGroupId = (group) => {
            return new Promise((resolve) => {
              groupDrivers.push(group._id);
              resolve(true);
            });
          };
          Promise.all(value.data.map((group) => getGroupId(group))).then(() => {
            resolve(groupDrivers);
          });
        }
      })
      .catch((error) => {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
      });
  });
}

function updateFleetOnEV(ev, action, fleet) {
  var context = 'Function updateFleetOnEV';
  try {
    var query = { _id: ev.evId };
    findOneEV(query)
      .then((evFound) => {
        if (evFound) {
          if (action === 'PUT') {
            evFound.fleet = fleet;
            evFound.hasFleet = true;
          } else if (action === 'PATCH') {
            //evFound.fleet = "";
            evFound.hasFleet = false;
          } else {
            console.error(`[${context}] unknown action`);
          }
          var newValue = { $set: evFound };
          updateEV(query, newValue)
            .then((result) => {
              if (result) {
                removeContractFleet(ev);
                if (ev.plafondId && ev.plafondId != '-1')
                  removePlafond(ev.evId);
                console.error(`[${context}] updated`);
              } else {
                console.error(`[${context}] Not updated`);
              }
            })
            .catch((error) => {
              console.error(`[${context}][updateEV] Error `, error.message);
            });
        }
      })
      .catch((error) => {
        console.error(`[${context}][findOneEV] Error `, error.message);
      });
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
  }
}

function findOneEV(query) {
  var context = 'Function findOneEV';
  return new Promise((resolve, reject) => {
    EV.findOne(query, (err, evFound) => {
      if (err) {
        console.error(`[${context}] Error `, err.message);
        reject(err);
      } else {
        resolve(evFound);
      }
    });
  });
}

function updateEV(query, newValue) {
  var context = 'Function updateEV';
  return new Promise((resolve, reject) => {
    EV.updateEV(query, newValue, (err, result) => {
      if (err) {
        console.error(`[${context}] Error `, err.message);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function whenRemoveFleet(fleet) {
  var context = 'Function whenRemoveFleet';
  var query = {
    fleet: fleet._id,
  };
  EV.find(query, (err, evsFound) => {
    if (err) {
      console.error(`[${context}] Error `, err.message);
    } else {
      if (evsFound.length == 0) {
        console.error(`[${context}] Nothing to remove `);
      } else {
        evsFound.map((ev) => {
          //ev.fleet = "";
          ev.hasFleet = false;
          var newValue = { $set: ev };
          var query = {
            _id: ev._id,
          };
          EV.updateEV(query, newValue, (err, result) => {
            if (err) {
              console.error(`[${context}] Error `, err.message);
            } else {
              removeContractFleet({ evId: ev._id });
              if (ev.plafondId && ev.plafondId != '-1') removePlafond(ev.evId);
              return result;
            }
          });
        });
      }
    }
  });
}

//Function to get drivers
function getDrivers(evFound) {
  var context = 'Function getDrivers';
  return new Promise((resolve, reject) => {
    try {
      var newlistOfDrivers = [];
      const getDrivers = (driver) => {
        return new Promise((resolve, reject) => {
          if (driver.userId == '') {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else if (driver.userId === undefined) {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else {
            var headers = {
              userid: driver.userId,
            };
            var host = process.env.HostUsers + process.env.PathUsers;
            axios
              .get(host, { headers })
              .then((result) => {
                var driversFound = result.data;
                if (driversFound.auth !== undefined) {
                  newlistOfDrivers.push(driver);
                  resolve(true);
                } else {
                  if (driver.period.periodType === 'always') {
                    driver = JSON.parse(JSON.stringify(driver));
                    driver.name = driversFound.name;
                    driver.internationalPrefix =
                      driversFound.internationalPrefix;
                    driver.mobile = driversFound.mobile;
                    driver.imageContent = driversFound.imageContent;
                    newlistOfDrivers.push(driver);
                    resolve(true);
                  } else {
                    var dateNow = new Date();
                    var startDate = new Date(driver.period.period.startDate);
                    var stopDate = new Date(driver.period.period.stopDate);
                    if (startDate <= dateNow && stopDate >= dateNow) {
                      driver = JSON.parse(JSON.stringify(driver));
                      driver.name = driversFound.name;
                      driver.internationalPrefix =
                        driversFound.internationalPrefix;
                      driver.mobile = driversFound.mobile;
                      driver.imageContent = driversFound.imageContent;
                      newlistOfDrivers.push(driver);
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  }
                }
              })
              .catch((error) => {
                console.error(
                  `[${context}][axios.get][.catch] Error `,
                  error.message,
                );
                reject(error);
              });
          }
        });
      };
      Promise.all(evFound.listOfDrivers.map((driver) => getDrivers(driver)))
        .then(() => {
          resolve(newlistOfDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getDriversMyFleets(evFound) {
  var context = 'Function getDriversMyFleets';
  return new Promise((resolve, reject) => {
    try {
      var newlistOfDrivers = [];
      const getDrivers = (driver) => {
        return new Promise((resolve, reject) => {
          if (driver.userId == '') {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else if (driver.userId === undefined) {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else {
            var headers = {
              userid: driver.userId,
            };
            var host = process.env.HostUsers + process.env.PathUsers;
            axios
              .get(host, { headers })
              .then((result) => {
                var driversFound = result.data;
                if (driversFound.auth !== undefined) {
                  newlistOfDrivers.push(driver);
                  resolve(true);
                } else {
                  driver = JSON.parse(JSON.stringify(driver));
                  driver.name = driversFound.name;
                  driver.internationalPrefix = driversFound.internationalPrefix;
                  driver.mobile = driversFound.mobile;
                  driver.imageContent = driversFound.imageContent;
                  newlistOfDrivers.push(driver);
                  resolve(true);
                }
              })
              .catch((error) => {
                console.error(
                  `[${context}][axios.get][.catch] Error `,
                  error.message,
                );
                reject(error);
              });
          }
        });
      };
      Promise.all(evFound.listOfDrivers.map((driver) => getDrivers(driver)))
        .then(() => {
          resolve(newlistOfDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getDriversNew(evFound) {
  var context = 'Function getDrivers';
  return new Promise((resolve, reject) => {
    try {
      var newlistOfDrivers = [];
      const getDrivers = (driver) => {
        return new Promise((resolve, reject) => {
          if (driver.userId == '') {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else if (driver.userId === undefined) {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else {
            var headers = {
              userid: driver.userId,
            };
            var host = process.env.HostUsers + process.env.PathUsers;
            axios
              .get(host, { headers })
              .then((result) => {
                var driversFound = result.data;
                if (driversFound.auth !== undefined) {
                  newlistOfDrivers.push(driver);
                  resolve(true);
                } else {
                  newlistOfDrivers.push(driver);
                  resolve(true);
                  /*
                                    if (driver.period.periodType === "always") {
                                        driver = JSON.parse(JSON.stringify(driver));
                                        driver.name = driversFound.name;
                                        driver.internationalPrefix = driversFound.internationalPrefix;
                                        driver.mobile = driversFound.mobile;
                                        driver.imageContent = driversFound.imageContent;
                                        newlistOfDrivers.push(driver);
                                        resolve(true);
                                    }
                                    else {
                                        var dateNow = new Date();
                                        var startDate = new Date(driver.period.period.startDate);
                                        var stopDate = new Date(driver.period.period.stopDate);
                                        if ((startDate <= dateNow) && (stopDate >= dateNow)) {
                                            driver = JSON.parse(JSON.stringify(driver));
                                            driver.name = driversFound.name;
                                            driver.internationalPrefix = driversFound.internationalPrefix;
                                            driver.mobile = driversFound.mobile;
                                            driver.imageContent = driversFound.imageContent;
                                            newlistOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                        else {
                                            resolve(false);
                                        };
                                    };
                                    */
                }
              })
              .catch((error) => {
                console.error(
                  `[${context}][axios.get][.catch] Error `,
                  error.message,
                );
                reject(error);
              });
          }
        });
      };
      Promise.all(evFound.listOfDrivers.map((driver) => getDrivers(driver)))
        .then(() => {
          resolve(newlistOfDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

//Function to get groups driver
function getGroupsDrivers(evFound) {
  var context = 'Function getGroupsDrivers';
  return new Promise((resolve, reject) => {
    try {
      var newListOfGroupDrivers = [];
      const getGroupsDrivers = (groupDrivers) => {
        return new Promise((resolve, reject) => {
          if (groupDrivers.period.periodType === 'always') {
            var data = {
              _id: groupDrivers.groupId,
            };
            var host = process.env.HostUsers + process.env.PathDrivers;
            axios
              .get(host, { data })
              .then((result) => {
                var groupDriversFound = result.data;
                groupDrivers = JSON.parse(JSON.stringify(groupDrivers));
                groupDrivers.name = groupDriversFound.name;
                groupDrivers.imageContent = groupDriversFound.imageContent;
                if (
                  groupDriversFound.listOfDrivers === undefined ||
                  groupDriversFound.listOfDrivers.length == 0
                ) {
                  groupDrivers.listOfDrivers = groupDriversFound.listOfDrivers;
                  newListOfGroupDrivers.push(groupDrivers);
                  resolve(true);
                } else {
                  getListOfDrivers(groupDriversFound.listOfDrivers)
                    .then((listOfDrivers) => {
                      groupDrivers.listOfDrivers = listOfDrivers;
                      newListOfGroupDrivers.push(groupDrivers);
                      resolve(true);
                    })
                    .catch((error) => {
                      console.error(
                        `[${context}][getListOfDrivers][.catch] Error `,
                        error.message,
                      );
                      reject(error);
                    });
                }
              })
              .catch((error) => {
                console.error(
                  `[${context}][axios.get][.catch] Error `,
                  error.message,
                );
                reject(error);
              });
          } else {
            var dateNow = new Date();
            var startDate = new Date(groupDrivers.period.period.startDate);
            var stopDate = new Date(groupDrivers.period.period.stopDate);
            if (dateNow >= startDate && dateNow <= stopDate) {
              var data = {
                _id: groupDrivers.groupId,
              };
              var host = process.env.HostUsers + process.env.PathDrivers;
              axios
                .get(host, { data })
                .then((result) => {
                  var groupDriversFound = result.data;
                  groupDrivers = JSON.parse(JSON.stringify(groupDrivers));
                  groupDrivers.name = groupDriversFound.name;
                  groupDrivers.imageContent = groupDriversFound.imageContent;
                  if (groupDriversFound.listOfDrivers.length == 0) {
                    groupDrivers.listOfDrivers =
                      groupDriversFound.listOfDrivers;
                    newListOfGroupDrivers.push(groupDrivers);
                    resolve(true);
                  } else {
                    getListOfDrivers(groupDriversFound.listOfDrivers)
                      .then((listOfDrivers) => {
                        groupDrivers.listOfDrivers = listOfDrivers;
                        newListOfGroupDrivers.push(groupDrivers);
                        resolve(true);
                      })
                      .catch((error) => {
                        console.error(
                          `[${context}][getListOfDrivers][.catch] Error `,
                          error.message,
                        );
                        reject(error);
                      });
                  }
                })
                .catch((error) => {
                  console.error(
                    `[${context}][axios.get][.catch] Error `,
                    error.message,
                  );
                  reject(error);
                });
            } else {
              resolve(false);
            }
          }
        });
      };
      Promise.all(
        evFound.listOfGroupDrivers.map((groupDrivers) =>
          getGroupsDrivers(groupDrivers),
        ),
      )
        .then(() => {
          resolve(newListOfGroupDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getGroupsDriversMyFleets(evFound) {
  var context = 'Function getGroupsDriversMyFleets';
  return new Promise((resolve, reject) => {
    try {
      var newListOfGroupDrivers = [];
      const getGroupsDrivers = (groupDrivers) => {
        return new Promise((resolve, reject) => {
          var data = {
            _id: groupDrivers.groupId,
          };
          var host = process.env.HostUsers + process.env.PathDrivers;
          axios
            .get(host, { data })
            .then((result) => {
              var groupDriversFound = result.data;
              groupDrivers = JSON.parse(JSON.stringify(groupDrivers));
              groupDrivers.name = groupDriversFound.name;
              groupDrivers.imageContent = groupDriversFound.imageContent;
              if (
                groupDriversFound.listOfDrivers === undefined ||
                groupDriversFound.listOfDrivers.length == 0
              ) {
                groupDrivers.listOfDrivers = groupDriversFound.listOfDrivers;
                newListOfGroupDrivers.push(groupDrivers);
                resolve(true);
              } else {
                getListOfDrivers(groupDriversFound.listOfDrivers)
                  .then((listOfDrivers) => {
                    groupDrivers.listOfDrivers = listOfDrivers;
                    newListOfGroupDrivers.push(groupDrivers);
                    resolve(true);
                  })
                  .catch((error) => {
                    console.error(
                      `[${context}][getListOfDrivers][.catch] Error `,
                      error.message,
                    );
                    reject(error);
                  });
              }
            })
            .catch((error) => {
              console.error(
                `[${context}][axios.get][.catch] Error `,
                error.message,
              );
              reject(error);
            });
        });
      };
      Promise.all(
        evFound.listOfGroupDrivers.map((groupDrivers) =>
          getGroupsDrivers(groupDrivers),
        ),
      )
        .then(() => {
          resolve(newListOfGroupDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getGroupsDriversNew(evFound) {
  var context = 'Function getGroupsDrivers';
  return new Promise((resolve, reject) => {
    try {
      var newListOfGroupDrivers = [];
      const getGroupsDrivers = (groupDrivers) => {
        return new Promise((resolve, reject) => {
          var data = {
            _id: groupDrivers.groupId,
          };
          var host = process.env.HostUsers + process.env.PathDrivers;
          axios
            .get(host, { data })
            .then((result) => {
              var groupDriversFound = result.data;
              groupDrivers = JSON.parse(JSON.stringify(groupDrivers));
              groupDrivers.name = groupDriversFound.name;
              groupDrivers.imageContent = groupDriversFound.imageContent;
              if (groupDriversFound.listOfDrivers.length == 0) {
                groupDrivers.listOfDrivers = groupDriversFound.listOfDrivers;
                newListOfGroupDrivers.push(groupDrivers);
                resolve(true);
              } else {
                getListOfDrivers(groupDriversFound.listOfDrivers)
                  .then((listOfDrivers) => {
                    groupDrivers.listOfDrivers = listOfDrivers;
                    newListOfGroupDrivers.push(groupDrivers);
                    resolve(true);
                  })
                  .catch((error) => {
                    console.error(
                      `[${context}][getListOfDrivers][.catch] Error `,
                      error.message,
                    );
                    reject(error);
                  });
              }
            })
            .catch((error) => {
              console.error(
                `[${context}][axios.get][.catch] Error `,
                error.message,
              );
              reject(error);
            });
        });
      };
      Promise.all(
        evFound.listOfGroupDrivers.map((groupDrivers) =>
          getGroupsDrivers(groupDrivers),
        ),
      )
        .then(() => {
          resolve(newListOfGroupDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getListOfDrivers(listOfDrivers) {
  var context = 'Function getListOfDrivers';
  return new Promise((resolve, reject) => {
    try {
      var newlistOfDrivers = [];
      const getDrivers = (driver) => {
        return new Promise((resolve, reject) => {
          if (driver.driverId == '') {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else if (driver.driverId === undefined) {
            newlistOfDrivers.push(driver);
            resolve(true);
          } else {
            var headers = {
              userid: driver.driverId,
            };
            var host = process.env.HostUsers + process.env.PathUsers;
            axios
              .get(host, { headers })
              .then((result) => {
                var driversFound = result.data;
                if (driversFound.auth !== undefined) {
                  newlistOfDrivers.push(driver);
                  resolve(true);
                } else {
                  driver = JSON.parse(JSON.stringify(driver));
                  driver.name = driversFound.name;
                  driver.internationalPrefix = driversFound.internationalPrefix;
                  driver.mobile = driversFound.mobile;
                  driver.imageContent = driversFound.imageContent;
                  newlistOfDrivers.push(driver);
                  resolve(true);
                }
              })
              .catch((error) => {
                console.error(
                  `[${context}][axios.get][.catch] Error `,
                  error.message,
                );
                reject(error);
              });
          }
        });
      };
      Promise.all(listOfDrivers.map((driver) => getDrivers(driver)))
        .then(() => {
          resolve(newlistOfDrivers);
        })
        .catch((error) => {
          console.error(`[${context}][Promise.all] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getValidationDriver(ev, userId, dateNow) {
  return new Promise((resolve) => {
    var found = ev.listOfDrivers.indexOf(
      ev.listOfDrivers.find((driver) => {
        return driver.userId == userId;
      }),
    );
    if (found >= 0) {
      if (ev.listOfDrivers[found].period.periodType === 'always') {
        resolve(true);
      } else {
        if (
          ev.listOfDrivers[found].period.period.startDate <= dateNow &&
          ev.listOfDrivers[found].period.period.stopDate >= dateNow
        ) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    } else {
      resolve(false);
    }
  });
}

function getValidationGroupDrivers(ev, dateNow, groupDrivers) {
  return new Promise((resolve) => {
    var isValid = [];
    Promise.all(
      groupDrivers.map((groupDriver) => {
        return new Promise((resolve) => {
          var found = ev.listOfGroupDrivers.indexOf(
            ev.listOfGroupDrivers.find((group) => {
              return group.groupId == groupDriver;
            }),
          );
          if (found >= 0) {
            if (ev.listOfGroupDrivers[found].period.periodType === 'always') {
              isValid.push(ev.listOfGroupDrivers[found]);
              resolve(true);
            } else {
              if (
                ev.listOfGroupDrivers[found].period.period.startDate <=
                  dateNow &&
                ev.listOfGroupDrivers[found].period.period.stopDate >= dateNow
              ) {
                isValid.push(ev.listOfGroupDrivers[found]);
                resolve(true);
              } else {
                resolve(false);
              }
            }
          } else {
            resolve(false);
          }
        });
      }),
    ).then(() => {
      if (isValid.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

function putEvsFleet(fleetsFound, listOfEvs) {
  const context = 'Funciton putEvsFleet';
  return new Promise((resolve) => {
    fleetsFound = JSON.parse(JSON.stringify(fleetsFound));
    let listOfFleets = [];
    Promise.all(
      listOfEvs.map((ev) => {
        return new Promise((resolve, reject) => {
          let found = fleetsFound.find((fleet) => {
            return fleet._id === ev.fleet;
          });
          if (found) {
            let index = listOfFleets.indexOf(
              listOfFleets.find((fleet) => {
                return fleet._id === found._id;
              }),
            );
            if (index >= 0) {
              if (listOfFleets[index].listEvs === undefined) {
                listOfFleets[index].listEvs = [];
                listOfFleets[index].listEvs.push(ev);
                resolve(true);
              } else {
                listOfFleets[index].listEvs.push(ev);
                resolve(true);
              }
            } else {
              found.listEvs = [];
              found.listEvs.push(ev);
              listOfFleets.push(found);
              resolve(true);
            }
          } else {
            resolve(false);
          }
        });
      }),
    ).then(() => {
      resolve(listOfFleets);
    });
  });
}

function getEvContract(evId, userId) {
  var context = 'Function getEvContract';

  let host = process.env.HostUsers + process.env.PathGetContractByEV;

  let params = {
    evId: evId,
  };

  let headers = {
    userid: userId,
  };

  return new Promise((resolve, reject) => {
    axios
      .get(host, { headers, params })
      .then((result) => {
        resolve(result.data);
      })
      .catch((error) => {
        console.error(`[${context}] Error `, error.message);
        resolve([]);
      });
  });
}

function removeContractFleet(ev) {
  var context = 'Function removeContractFleet';

  let data = {
    evId: ev.evId,
  };
  let host = process.env.HostUsers + process.env.PathRemoveContractTypeFleet;

  axios
    .delete(host, { data })
    .then((result) => {
      console.log('Contract removed');
    })
    .catch((error) => {
      console.error(`[${context}] Error `, error.message);
    });
}

function removeFleetFromCharger(fleets) {
  var context = 'Function removeFleetFromCharger';

  let data = {
    fleetId: fleets._id,
  };

  let host = process.env.HostCharger + process.env.PathRemoveFleetFromCharger;

  axios
    .patch(host, data)
    .then((result) => {
      console.log('Fleet removed from charger');
    })
    .catch((error) => {
      console.error(`[${context}] Error `, error.message);
    });
}

function removeEVWhenUserDeleted(ev) {
  var context = 'Function removeEV';
  return new Promise(async (resolve, reject) => {
    let query = {
      _id: ev.evId,
    };

    let sessions = await getSessionsByEV(ev.evId);
    if (sessions.length === 0) {
      EV.removeEV(query, (err, result) => {
        if (err) {
          console.error(`[${context}][removeEV] Error `, err.message);
          reject(err);
        } else {
          deleteContractFleet(ev);
          if (ev.plafondId && ev.plafondId != '-1') removePlafond(ev.evId);

          if (result) resolve(true);
          else resolve(false);
        }
      });
    } else {
      let newValues = {
        hasFleet: false,
        // fleet: "",
        listOfGroupDrivers: [],
        listOfDrivers: [],
      };

      updateEV(query, newValues)
        .then((result) => {
          removeContractFleet(ev);
          if (ev.plafondId && ev.plafondId != '-1') removePlafond(ev.evId);
          if (result) resolve(true);
          else resolve(false);
        })
        .catch((error) => {
          console.error(`[${context}] Error `, error.message);
          reject(error);
        });
    }
  });
}

function removeEV(ev) {
  var context = 'Function removeEV';
  return new Promise(async (resolve, reject) => {
    let query = {
      _id: ev.evId,
    };

    let sessions = await getSessionsByEV(ev.evId);

    if (sessions.length === 0) {
      EV.removeEV(query, (err, result) => {
        if (err) {
          console.error(`[${context}][removeEV] Error `, err.message);
          reject(err);
        } else {
          deleteContractFleet(ev);
          if (ev.plafondId && ev.plafondId != '-1') removePlafond(ev.evId);
          if (result) resolve(true);
          else resolve(false);
        }
      });
    } else {
      let activeSessions = sessions.filter((session) => {
        return session.status === '20';
      });
      if (activeSessions.length > 0) {
        resolve(false);
      } else {
        let newValues = {
          hasFleet: false,
          //fleet: "",
          listOfGroupDrivers: [],
          listOfDrivers: [],
        };

        updateEV(query, newValues)
          .then((result) => {
            removeContractFleet(ev);
            if (ev.plafondId && ev.plafondId != '-1') removePlafond(ev.evId);
            if (result) resolve(true);
            else resolve(false);
          })
          .catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
          });
      }
    }
  });
}

function getSessionsByEV(evId) {
  var context = 'Function getSessionsByEV';
  return new Promise(async (resolve, reject) => {
    let sessionsEVIO = await getSessionsEVIOByEV(evId);
    let sessionsMobiE = await getSessionsMobiEByEV(evId);

    resolve(sessionsEVIO.concat(sessionsMobiE));
  });
}

//Get sessions by ev on EVIO network
function getSessionsEVIOByEV(evId) {
  var context = 'Function getSessionsEVIOByEV';
  return new Promise(async (resolve, reject) => {
    let host =
      process.env.HostCharger + process.env.PathGetSessionByEV + `/${evId}`;

    axios
      .get(host)
      .then((result) => {
        resolve(result.data);
      })
      .catch((error) => {
        console.error(`[${context}][${host}] Error `, error.message);
        resolve([]);
      });
  });
}

//Get sessions by ev on EVIO network
function getSessionsMobiEByEV(evId) {
  var context = 'Function getSessionsMobiEByEV';
  return new Promise(async (resolve, reject) => {
    let host =
      process.env.HostChargingSessionMobie +
      process.env.PathGetSessionByEV +
      `/${evId}`;

    axios
      .get(host)
      .then((result) => {
        resolve(result.data);
      })
      .catch((error) => {
        console.error(`[${context}][${host}] Error `, error.message);
        resolve([]);
      });
  });
}

function deleteContractFleet(ev) {
  var context = 'Function deleteContractFleet';

  let data = {
    evId: ev.evId,
  };
  let host = process.env.HostUsers + process.env.PathDeleteContractTypeFleet;

  axios
    .delete(host, { data })
    .then((result) => {
      console.log('Contract removed');
    })
    .catch((error) => {
      console.error(`[${context}] Error `, error.message);
    });
}

function getNetworksEV(evFound, clientName) {
  const context = 'Function getNetworksEV';
  return new Promise((resolve, reject) => {
    const host = `${process.env.HostUsers}${process.env.PathGetNetworks}/${evFound._id}`;

    console.log('host', host);

    axios
      .get(host)
      .then((response) => {
        if (response.data) {
          let networks = [];

          Promise.all(
            response.data.networks.map((network) => {
              return new Promise((resolve, reject) => {
                if (network.isVisible !== false) {
                  let token = network.tokens.find((token) => {
                    return (
                      token.tokenType === 'APP_USER' ||
                      token.tokenType === 'OTHER'
                    );
                  });

                  let status;
                  if (token) {
                    status = token.status;
                  } else {
                    status = 'inactive';
                  }
                  let networkInfo = {
                    name: network.name,
                    networkName: network.networkName,
                    network: network.network,
                    status: status,
                  };

                  console.log('networkInfo', networkInfo);

                  if (
                    clientName === process.env.clientNameSC ||
                    clientName === process.env.clientNameKLC ||
                    clientName === process.env.WhiteLabelKinto
                  ) {
                    networks.push(networkInfo);
                    resolve(true);
                  } else {
                    if (
                      process.env.listOfNetworks.includes(networkInfo.network)
                    ) {
                      networks.push(networkInfo);
                      resolve(true);
                    } else {
                      resolve(true);
                    }
                  }
                } else {
                  resolve(true);
                }
              });
            }),
          )
            .then((response) => {
              resolve(networks);
            })
            .catch((error) => {
              console.error(`[${context}] Error `, error.message);
              resolve([]);
            });
        } else {
          resolve([]);
        }
      })
      .catch((error) => {
        console.error(`[${context}] Error `, error.message);
        resolve([]);
      });
  });
}

function getPlafondValue(plafondId) {
  const context = 'Function getPlafondValue';
  return new Promise((resolve, reject) => {
    //resolve(0);

    let host =
      process.env.HostPayments + process.env.PathPlafond + `/${plafondId}`;

    axios
      .get(host)
      .then((response) => {
        if (response.data) {
          let plafondInfo = response.data;
          resolve(plafondInfo);
        } else {
          resolve(null);
        }
      })
      .catch((error) => {
        console.error(`[${context}] Error `, error.message);
        resolve(0);
      });
  });
}

function removePlafond(evId) {
  var context = 'Function removePlafond';

  let data = {
    evId: evId,
  };
  let host = process.env.HostPayments + process.env.PathDeletePlafond;

  axios
    .delete(host, { data })
    .then((result) => {
      console.log('Contract removed');
    })
    .catch((error) => {
      console.error(`[${context}] Error `, error.message);
    });
}

function getArrayOfFleetId(fleetArray) {
  const context = '[ fleet getArrayOfFleetId ]';
  try {
    if (!fleetArray || !Array.isArray(fleetArray)) {
      console.log(
        `[${context}] Error - fleetArray is not an array or doesn't exist`,
        fleetArray,
      );
      return false;
    }

    let fleetIds = [];
    for (let fleet of fleetArray) {
      fleetIds.push(fleet._id);
    }
    return fleetIds;
  } catch (error) {
    console.error(`[${context}] Error `, error.message);
    return false;
  }
}

module.exports = router;
