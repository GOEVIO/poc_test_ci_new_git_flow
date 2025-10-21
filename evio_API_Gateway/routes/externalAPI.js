const express = require("express");
const router = express.Router();
const httpProxy = require("express-http-proxy");
const axios = require("axios");
const RequestHistory = require("../models/requestHistory");
const jwt = require("jsonwebtoken");
const UUID = require("uuid-js");
require("dotenv-safe").load();

const authorizationServiceProxy = "http://authorization:3001/api/checkauth/";

//========== FUNCTIONS ==========

router.use(hasValidApiToken);

var apikey;
function hasValidCredentials(req, res, next) {
  var context = "Function hasValidCredentials";
  try {
    var username = req.body.username;
    var password = req.body.password;

    if (!username)
      return res
        .status(400)
        .send({
          auth: false,
          code: "server_invalid_username",
          message: "Invalid username",
        });

    if (!password)
      return res
        .status(400)
        .send({
          auth: false,
          code: "server_invalid_password",
          message: "Invalid password",
        });

    // Call identity service
    next();
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

const authenticationServiceProxyExternalAPI = httpProxy(
  "http://identity:3003/",
  {
    forwardPath: () => "http://identity:3003/evioapi/authenticate",
  }
);

function isAuthenticated(req, res, next) {
  var context = "Function isAuthenticated";

  try {
    //console.log("1 B");
    if (
      req.originalUrl.includes("/evioapi/users/unsubscribe") ||
      req.originalUrl.includes("/evioapi/users/confirmChangeEmail") ||
      req.originalUrl === "/evioapi/authenticate" ||
      req.originalUrl === "/evioapi/authenticate/"
    ) {
      next();
    } else {
      // First request to authorization service to check if tokens are valids
      var token = req.headers["token"];
      let apiKey = req.headers["apikey"];

      if (!apiKey) {
        return res
          .status(400)
          .send({
            auth: false,
            code: "server_missing_header",
            message: "Missing apiKey",
          });
      }

      if (token) {
        const headers = {
          token: token,
          apikey: apiKey,
        };

        axios
          .get(authorizationServiceProxy, { headers })
          .then(function (response) {
            if (response.data.username === process.env.Admin) {
              req.headers["userid"] = response.data.id; //in headers we can't use camelcase, always lowercase
              if (response.data.requestUserId) {
                req.headers["requestuserid"] = response.data.requestUserId;
                if (response.data.AccountTypeMaster) {
                  req.headers["accounttype"] = response.data.AccountTypeMaster;
                } else {
                  if (
                    response.data.id === response.data.requestUserId ||
                    response.data.requestUserId ===
                      process.env.OperationsManagementID
                  ) {
                    req.headers["accounttype"] = process.env.AccountTypeMaster;
                  } else {
                    req.headers["accounttype"] = process.env.AccountTypeGuest;
                  }
                }
              } else {
                req.headers["requestuserid"] = response.data.id;
                req.headers["accounttype"] = process.env.AccountTypeMaster;
              }
              next();
            } else {
              verifyValidUserId(response.data.id)
                .then((result) => {
                  if (result) {
                    req.headers["userid"] = response.data.id; //in headers we can't use camelcase, always lowercase
                    req.headers["usertype"] = response.data.userType;
                    if (response.data.requestUserId) {
                      req.headers["requestuserid"] =
                        response.data.requestUserId;
                      if (response.data.AccountTypeMaster) {
                        req.headers["accounttype"] =
                          response.data.AccountTypeMaster;
                      } else {
                        if (
                          response.data.id === response.data.requestUserId ||
                          response.data.requestUserId ===
                            process.env.OperationsManagementID
                        ) {
                          req.headers["accounttype"] =
                            process.env.AccountTypeMaster;
                        } else {
                          req.headers["accounttype"] =
                            process.env.AccountTypeGuest;
                        }
                      }
                    } else {
                      req.headers["requestuserid"] = response.data.id;
                      req.headers["accounttype"] =
                        process.env.AccountTypeMaster;
                    }
                    //req.headers['client'] = decoded.clientType;
                    next();
                  } else {
                    res
                      .status(400)
                      .send({
                        auth: false,
                        code: "server_user_not_valid",
                        message: "User is not valid",
                      });
                  }
                })
                .catch(function (error) {
                  if (error.response) {
                    res.status(400).send(error.response.data);
                  } else if (error.auth === false) {
                    res.status(400).send(error);
                  } else {
                    console.log(
                      `[${context}][verifyValidUserId] Error `,
                      error.message
                    );
                    res
                      .status(500)
                      .send({ auth: false, message: error.message });
                  }
                });
            }
          })
          .catch(function (error) {
            if (error.response != undefined) {
              res.status(error.response.status).send(error.response.data);
            } else {
              console.error(
                `[${context}][${authorizationServiceProxy}] Error`,
                error.message
              );
              res.status(500).send({ auth: false, message: error.message });
            }
          });
      } else {
        console.log("1");
        res
          .status(401)
          .send({
            auth: false,
            code: "server_tokens_provided",
            message: "Tokens must be provided",
          });
      }
    }
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

function verifyValidUserId(userId) {
  var context = "Function verifyValidUserId";
  return new Promise((resolve, reject) => {
    try {
      var headers = {
        userid: userId,
      };
      var host = process.env.HostIdentity + process.env.PathValidateUser;
      axios
        .get(host, { headers })
        .then((result) => {
          //console.log("result.data", result.data);
          if (result.data.active) {
            resolve(true);
          } else {
            if (result.data.changedEmail) {
              reject({
                auth: false,
                code: "server_user_not_active",
                message: "Activate your account using the activation code.",
                changedEmail: true,
              });
            } else {
              resolve(false);
            }
          }
        })
        .catch((error) => {
          console.log(`[${context}] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.log(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function updateResponseLogs(reqID, updateInfo) {
  // TODO: handle logs correctly withou find and update
  // if (reqID !== null || reqID !== undefined) {
  //     RequestHistory.updateRequestHistory({ reqID: reqID }, { $set: updateInfo }, (err, result) => {
  //         if (err) {
  //             console.log(`[updateRequestHistory] Error `, err.message);
  //         }
  //         else {
  //             if (result) {
  //                 console.log("Log updated with success");
  //             }
  //             else {
  //                 console.log("Failed to update log");
  //             };
  //         };
  //     });
  // }
  // else {
  //     console.log("Log cannot be updated");
  // }
}

function hasValidApiToken(req, res, next) {
  var context = "Function hasValidApiToken";
  try {
    console.log("Function hasValidApiToken ext api");
    var data;
    if (
      req.method == "POST" &&
      (req.url == "/evioapi/authenticate" ||
        req.url == "/evioapi/authenticate/")
    ) {
      data = {
        username: req.body.username,
        internationalPrefix: req.body.internationalPrefix,
      };
    } else {
      data = req.body;
    }

    apikey = req.headers["apikey"];
    var mobileBrand = req.headers["mobilebrand"];
    var mobileModel = req.headers["mobilemodel"];
    var mobileVersion = req.headers["mobileversion"];
    var evioAppVersion = req.headers["evioappversion"];

    if (apikey) {
      jwt.verify(apikey, process.env.TOKEN_SECRET, function (err, decoded) {
        if (err) {
          if (err.name === "TokenExpiredError") {
            return res
              .status(401)
              .send({
                auth: false,
                token: "",
                refreshToken: "",
                code: "server_invalid_credentials",
                message: "Invalid credentials",
              });
          } else if (err.name === "JsonWebTokenError") {
            console.log(`[${context} jwt verify] Error `, err.message);
            return res
              .status(401)
              .send({
                auth: false,
                code: "server_invalid_apiKey",
                message: "Invalid apiKey",
              });
          } else {
            console.log(`[${context} jwt verify] Error`, err.message);
            return res
              .status(400)
              .send({
                auth: false,
                token: "",
                refreshToken: "",
                message: "Failed to authenticate token." + err,
              });
          }
        } else {
          if (
            req.originalUrl === "/evioapi/authenticate" || 
            req.originalUrl.includes("/evioapi/users/unsubscribe") ||
            req.originalUrl.includes("/evioapi/users/confirmChangeEmail")
          )
          req.headers.clientname = req.headers.clientname ?? decoded.clientName; // this is needed for this external endpoint since it was not required in the documentation
          var token = req.headers["token"];
          if (token) {
            if (
              req.url === "/extapi/private/logout" &&
              req.method === "PATCH"
            ) {
              next();
            } else {
              const headers = {
                token: token,
              };
              axios
                .get(authorizationServiceProxy, { headers })
                .then((response) => {
                  if (response.data.username === process.env.Admin) {
                    req.headers["userid"] = response.data.id; //in headers we can't use camelcase, always lowercase
                    req.headers["client"] = decoded.clientType;
                    if (response.data.requestUserId) {
                      req.headers["requestuserid"] =
                        response.data.requestUserId;
                      if (response.data.AccountTypeMaster) {
                        req.headers["accounttype"] =
                          response.data.AccountTypeMaster;
                      } else {
                        if (
                          response.data.id === response.data.requestUserId ||
                          response.data.requestUserId ===
                            process.env.OperationsManagementID
                        ) {
                          req.headers["accounttype"] =
                            process.env.AccountTypeMaster;
                        } else {
                          req.headers["accounttype"] =
                            process.env.AccountTypeGuest;
                        }
                      }
                    } else {
                      req.headers["requestuserid"] = response.data.id;
                      req.headers["accounttype"] =
                        process.env.AccountTypeMaster;
                    }
                    req.headers["usertype"] = response.data.userType
                      ? response.data.userType
                      : "admin";
                    var requestHistory = new RequestHistory();
                    var uuid4 = UUID.create();
                    requestHistory.clientType = decoded.clientType;
                    requestHistory.requestDate = new Date();
                    requestHistory.clientName = decoded.clientName;
                    requestHistory.requestDate = new Date();
                    requestHistory.path = req.url;
                    requestHistory.userId = req.headers["userid"];
                    requestHistory.requestUserId = req.headers["requestuserid"];
                    requestHistory.accountType = req.headers["accounttype"];
                    requestHistory.mobileBrand = mobileBrand;
                    requestHistory.mobileModel = mobileModel;
                    requestHistory.mobileVersion = mobileVersion;
                    requestHistory.evioAppVersion = evioAppVersion;
                    requestHistory.data = data;
                    requestHistory.reqID = uuid4.hex;
                    requestHistory.method = req.method;
                    req.headers["reqID"] = uuid4.hex;
                    RequestHistory.createRequestHistory(
                      requestHistory,
                      (err, result) => {
                        if (err) {
                          console.log(
                            `[${context} createRequestHistory] Error `,
                            err.message
                          );
                          return res.status(500).send(err.message);
                        } else {
                          if (result) {
                            next();
                          } else {
                            return res
                              .status(400)
                              .send({
                                auth: false,
                                code: "server_history_not_save",
                                message: "Request history dont save",
                              });
                          }
                        }
                      }
                    );
                    //next();
                  } else if (req.url === "/api/accountActivation") {
                    req.headers["userid"] = response.data.id; //in headers we can't use camelcase, always lowercase
                    req.headers["client"] = decoded.clientType;
                    if (response.data.requestUserId) {
                      req.headers["requestuserid"] =
                        response.data.requestUserId;
                      if (response.data.AccountTypeMaster) {
                        req.headers["accounttype"] =
                          response.data.AccountTypeMaster;
                      } else {
                        if (
                          response.data.id === response.data.requestUserId ||
                          response.data.requestUserId ===
                            process.env.OperationsManagementID
                        ) {
                          req.headers["accounttype"] =
                            process.env.AccountTypeMaster;
                        } else {
                          req.headers["accounttype"] =
                            process.env.AccountTypeGuest;
                        }
                      }
                    } else {
                      req.headers["requestuserid"] = response.data.id;
                      req.headers["accounttype"] =
                        process.env.AccountTypeMaster;
                    }
                    next();
                  } else {
                    verifyValidUserId(response.data.id)
                      .then((result) => {
                        if (result) {
                          req.headers["userid"] = response.data.id; //in headers we can't use camelcase, always lowercase
                          req.headers["client"] = decoded.clientType;
                          req.headers["usertype"] = response.data.userType;
                          if (response.data.requestUserId) {
                            req.headers["requestuserid"] =
                              response.data.requestUserId;
                            if (response.data.AccountTypeMaster) {
                              req.headers["accounttype"] =
                                response.data.AccountTypeMaster;
                            } else {
                              if (
                                response.data.id ===
                                  response.data.requestUserId ||
                                response.data.requestUserId ===
                                  process.env.OperationsManagementID
                              ) {
                                req.headers["accounttype"] =
                                  process.env.AccountTypeMaster;
                              } else {
                                req.headers["accounttype"] =
                                  process.env.AccountTypeGuest;
                              }
                            }
                          } else {
                            req.headers["requestuserid"] = response.data.id;
                            req.headers["accounttype"] =
                              process.env.AccountTypeMaster;
                          }
                          var requestHistory = new RequestHistory();
                          var uuid4 = UUID.create();
                          requestHistory.clientType = decoded.clientType;
                          requestHistory.requestDate = new Date();
                          requestHistory.clientName = decoded.clientName;
                          requestHistory.requestDate = new Date();
                          requestHistory.path = req.url;
                          requestHistory.userId = req.headers["userid"];
                          requestHistory.requestUserId =
                            req.headers["requestuserid"];
                          requestHistory.accountType =
                            req.headers["accounttype"];
                          requestHistory.mobileBrand = mobileBrand;
                          requestHistory.mobileModel = mobileModel;
                          requestHistory.mobileVersion = mobileVersion;
                          requestHistory.evioAppVersion = evioAppVersion;
                          requestHistory.data = data;
                          requestHistory.reqID = uuid4.hex;
                          requestHistory.method = req.method;
                          req.headers["reqID"] = uuid4.hex;

                          RequestHistory.createRequestHistory(
                            requestHistory,
                            (err, result) => {
                              if (err) {
                                console.log(
                                  `[${context} createRequestHistory] Error `,
                                  err.message
                                );
                                return res.status(500).send(err.message);
                              } else {
                                if (result) {
                                  next();
                                } else {
                                  return res
                                    .status(400)
                                    .send({
                                      auth: false,
                                      code: "server_history_not_save",
                                      message: "Request history dont save",
                                    });
                                }
                              }
                            }
                          );
                        } else {
                          res
                            .status(400)
                            .send({
                              auth: false,
                              code: "server_user_not_valid",
                              message: "User is not valid",
                            });
                        }
                      })
                      .catch(function (error) {
                        if (error.response) {
                          res.status(400).send(error.response.data);
                        } else if (error.auth === false) {
                          res.status(400).send(error);
                        } else {
                          console.log(
                            `[${context}][verifyValidUserId] Error `,
                            error.message
                          );
                          res
                            .status(500)
                            .send({ auth: false, message: error.message });
                        }
                      });
                  }
                })
                .catch((error) => {
                  if (error.response != undefined) {
                    res.status(error.response.status).send(error.response.data);
                  } else {
                    console.error(
                      `[${context}][${authorizationServiceProxy}] Error`,
                      error.message
                    );
                    res
                      .status(500)
                      .send({ auth: false, message: error.message });
                  }
                });
            }
          } else {
            //console.log("4");
            var requestHistory = new RequestHistory();
            var uuid4 = UUID.create();
            req.headers["client"] = decoded.clientType;
            requestHistory.clientType = decoded.clientType;
            requestHistory.requestDate = new Date();
            requestHistory.clientName = req.headers.clientname;
            requestHistory.mobileBrand = mobileBrand;
            requestHistory.mobileModel = mobileModel;
            requestHistory.mobileVersion = mobileVersion;
            requestHistory.evioAppVersion = evioAppVersion;
            requestHistory.data = data;
            requestHistory.path = req.url;
            requestHistory.reqID = uuid4.hex;
            requestHistory.method = req.method;
            req.headers["reqID"] = uuid4.hex;

            RequestHistory.createRequestHistory(
              requestHistory,
              (err, result) => {
                if (err) {
                  console.log(
                    `[${context} createRequestHistory] Error `,
                    err.message
                  );
                  return res.status(500).send(err.message);
                } else {
                  if (result) {
                    next();
                  } else {
                    return res
                      .status(400)
                      .send({
                        auth: false,
                        code: "server_history_not_save",
                        message: "Request history dont save",
                      });
                  }
                }
              }
            );
          }
        }
      });
    } else {
      return res
        .status(400)
        .send({
          auth: false,
          code: "server_missing_header",
          message: "Missing apiKey.",
        });
    }
  } catch (error) {
    console.log(`Catch [${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

function verifyVersionCompatibility(clientType, evioAppVersion, clientName) {
  var context = "Function verifyVersionCompatibility";
  return new Promise((resolve, reject) => {
    try {
      const params = {
        clientName: clientName,
        clientType: clientType,
        iOSVersion: evioAppVersion,
        androidVersion: evioAppVersion,
      };
      getVersionCompatibility(params)
        .then((result) => {
          if (result) {
            resolve(!result);
          } else {
            reject({
              auth: false,
              code: "server_need_update_app",
              message: "App need to be updated",
            });
          }
        })
        .catch((error) => {
          console.error(`[${context}] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

function getVersionCompatibility(params) {
  var context = "Function getVersionCompatibility";
  return new Promise((resolve, reject) => {
    try {
      var host = process.env.ConfigsHost + process.env.ConfigsPath;
      axios
        .get(host, { params })
        .then((result) => {
          resolve(result.data);
        })
        .catch((error) => {
          console.error(`[${context}] [${host}] Error `, error.message);
          reject(error);
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

router.use(isAuthenticated);
router.use("/authenticate", hasValidCredentials);
router.use("/authenticate", authenticationServiceProxyExternalAPI);

router.use(["/evs" , "/assets"], (req, res) => {
  const evsServiceProxy = httpProxy("http://evs:3006/", {
    preserveHostHdr: true,
    forwardPath: () => `http://evs:3006${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/evs] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evs:3006${req.originalUrl}`);
  evsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/evs] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/evs] Result", result);
  });
});

router.use("/chargers", (req, res) => {
  const chargersServiceProxy = httpProxy("http://chargers:3002/", {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/chargers] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/chargers] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/chargers] Result", result);
  });
});

router.use('/chargingstations', (req, res) => {
    const chargersServiceProxy = httpProxy('http://chargers:3002/', {
        forwardPath: req => `http://chargers:3002${req.originalUrl}`,
        proxyErrorHandler: (err, res, next) => {
            switch (err && err.code) {
                default: {

          console.log(
            "[/evioapi/chargingstations , /evioapi/solar, /evioapi/meter] Error",
            err.message
          );
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        "[/evioapi/chargers , /evioapi/solar, /evioapi/meter] Error",
        err.message
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        "[/evioapi/chargers , /evioapi/solar, /evioapi/meter] Result",
        result
      );
  });
});

router.use("/locations", (req, res) => {
  const locationsServiceProxy = httpProxy("http://public-network:3029/", {
    preserveHostHdr: true,
    forwardPath: () => `http://public-network:3029${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/locations] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-network:3029${req.originalUrl}`);
  locationsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/locations] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/locations] Result", result);
  });
});

router.use("/switchboard", (req, res) => {
  const chargersServiceProxy = httpProxy("http://chargers:3002/", {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.error("[/evioapi/switchboard] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.error("[/evioapi/switchboard] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/switchboard] Result", result);
  });
});

router.use("/infrastructures", (req, res) => {
  const chargersServiceProxy = httpProxy("http://chargers:3002/", {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/chargingstations] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/chargers] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/chargers] Result", result);
  });
});

router.use("/chargingsessions/active", (req, res) => {
  const chargersServiceProxy = httpProxy("http://chargers:3002/", {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/chargingsessions/active] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/chargingsessions/active/] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/chargingsessions/active/] Result", result);
  });
});

router.use("/chargingsessions/history", (req, res) => {
  const chargersServiceProxy = httpProxy("http://statitics-v2:3031/", {
    forwardPath: (req) => `http://statitics-v2:3031${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/chargingsessions/history] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://statitics-v2:3031${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/chargingsessions/history] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/chargingsessions/history] Result", result);
  });
});

router.use("/evioapi/chargingstations/energy", (req, res) => {
  const chargersServiceProxy = httpProxy("http://chargers:3002/", {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/chargingsessions/active] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });
  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/chargingsessions/active/] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/chargingsessions/active/] Result", result);
  });
});

router.use('/users/unsubscribe/marketing/:hash', (req, res) => {
  const unsubscribeMarketingProxy = httpProxy('http://identity:3003/', {
    forwardPath: (req) => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/api/public/users/unsubscribe/marketing/:hash] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  })

  console.log(`http://identity:3003${req.originalUrl}`);
  unsubscribeMarketingProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/public/users/unsubscribe/marketing/:hash] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/api/public/users/unsubscribe/marketing/:hash] Result", result);
  });
})

router.use('/users/confirmChangeEmail', (req, res) => {
  const proxy = httpProxy('http://identity:3003/', {
    forwardPath: (req) => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/users/confirmChangeEmail] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: 'Updated failed',
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          //responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  })

  console.log(`http://identity:3003${req.originalUrl}`);
  proxy(req, res, (err, result) => {
    if (err) {
      console.log(`[/evioapi/users/confirmChangeEmail] Error ${JSON.stringify(err)}`);
      return res.status(500).send(err.message);
    } else console.log(`[/evioapi/users/confirmChangeEmail] Error ${JSON.stringify(err)}`);
  });
})

router.use("/invoices", (req, res) => {
  const locationsServiceProxy = httpProxy("http://billing-v2:3007/", {
    preserveHostHdr: true,
    forwardPath: () => `http://billing-v2:3007${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/evioapi/invoices] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        } else {
          resolve();
        }
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers["reqID"], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing-v2:3007${req.originalUrl}`);
  locationsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/evioapi/invoices] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/evioapi/invoices] Result", result);
  });
});

module.exports = router;
