require('dotenv-safe').load();
const http = require('http');
const httpProxy = require('express-http-proxy');
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser'); // Parse of coockies on the requests
const logger = require('morgan'); // Logger package to know what is happennig with api gateway
const helmet = require('helmet'); // Package that offers some security to api gateway
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const UUID = require('uuid-js');
const Process = require('process');
const moment = require('moment');

const swaggerUi = require("swagger-ui-express");
const swaggerDoc = require("./apiDocumentation.json");
const RequestHistory = require("./models/requestHistory");

const { aptAuthInterceptor, aptSecretKeyInterceptor, responseInterceptor } = require("./middlewares");
const createProxyRoute = require('./proxy/proxy');
const { languageClearCache } = require("evio-library-language").default;
const identityLibrary = require('evio-library-identity').default;

const app = express();

const port =
  process.env.NODE_ENV === 'production'
    ? process.env.PORT
    : process.env.PORT_DEV;

var apikey = '';

const customOutput =
  (err = false) =>
  (...args) => {
    const formattedArgs = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
      .join(' ');
    if (err) {
      process.stderr.write(`${formattedArgs}\n`);
      return;
    }
    process.stdout.write(`${formattedArgs}\n`);
  };
console.log = customOutput();
console.info = customOutput();
console.warn = customOutput();
console.error = customOutput(true);

app.use(cors());
app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));
app.use(cors());

// Retrieve secret key from Redis cache or AWS Secrets Manager
app.use('/apt/key', aptSecretKeyInterceptor);
// Decode apt authentication request to send generate request tokens
app.use('/apt/login', aptAuthInterceptor);

//added new interceptor to response
app.use(responseInterceptor);

app.use(hasValidApiToken);
logger.token('req-body', (req) => JSON.stringify(req.body) || '{}');
logger.token('res-size', (req, res) => res.get('Content-Length') || '0');
logger.token('req-headers', (req) => JSON.stringify(req.headers));
app.use(
  logger((tokens, req, res) => {
    const status = tokens.status(req, res);
    const responseTime = tokens['response-time'](req, res);
    const log = {
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: status ? parseInt(status) : 0,
      responseTime: responseTime ? parseFloat(responseTime) : 1,
      reqHeaders: JSON.parse(tokens['req-headers'](req)),
      reqBody: JSON.parse(tokens['req-body'](req)),
      resSize: `${tokens['res-size'](req, res)} bytes`,
      logType: 'httpRequest',
    };
    return JSON.stringify(log);
  }),
);
app.use(helmet());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: false, limit: '200mb' }));
app.use(cookieParser());

const mongoose = require('mongoose');
console.log('Environment', process.env.NODE_ENV);
switch (process.env.NODE_ENV) {
  case 'production':
    console.log('Initing production environment');
    break;
  case 'pre':
    console.log('Initing pre environment');
    app.use('/apiDocumentation', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    break;
  case 'development':
    app.use('/apiDocumentation', swaggerUi.serve, swaggerUi.setup(swaggerDoc));
    break;
  default:
    console.log('Unknown environment');
    break;
}

//mongoose.connect('mongodb://localhost:27017/logsDB')

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  keepAlive: true,
};

connectionDB();
async function connectionDB() {
  const connString = String(process.env.DB_URI).replace('{database}', 'logsDB');
  await mongoose
    .connect(connString, options)
    .then((connection) => {
      console.log(`Connected to ${connection.connections[0].name}`);
    })
    .catch((err) => {
      console.log(`[${connString}] Error`, err.message);
      Process.exit(0);
    });
}

function hasValidApiToken(req, res, next) {
  var context = 'Function hasValidApiToken';
  try {
    apikey = req.headers['apikey'];
    var mobileBrand = req.headers['mobilebrand'];
    var mobileModel = req.headers['mobilemodel'];
    var mobileVersion = req.headers['mobileversion'];
    var evioAppVersion = req.headers['evioappversion'];

    if (
      req.method == "POST" &&
      (req.url == "/api/authenticate" ||
        req.url == "/api/authenticate/" ||
        req.url == "/api/private/users/company" ||
        req.url == "/api/private/users/wl" ||
        req.url == "/api/wl/authenticate" ||
        req.url == "/api/wl/authenticate/")
    ) {
      var data = {
        username: req.body.username,
        internationalPrefix: req.body.internationalPrefix,
      };
    } else if (
      req.method == 'POST' &&
      (req.url == '/api/goCharge/authenticate' ||
        req.url == '/api/goCharge/authenticate/')
    ) {
      var data = req.body;
    } else {
      var data = req.body;
    }

    console.log('Req Method and URL ', req.method, req.url);
    if (req.url.includes('apiDocumentation')) {
      if (
        req.host.includes('172.16.102.31') ||
        req.host.includes('172.16.102.37') ||
        req.host.includes('localhost')
      ) {
        next();
      } else {
        return res.status(404).send();
      }
    } else if (
      req.url.includes('/api/private/controlcenter') ||
      req.url.includes('/ocpi/cpo/') ||
      req.url.includes('mobie') ||
      req.url.includes('/api/public/wallet/enableBalanceClearance')
    ) {
      next();
    } else if (req.url === '/api/generateApikey') {
      if (apikey) {
        jwt.verify(apikey, process.env.TOKEN_SECRET, function (err, decoded) {
          if (err) {
            if (err.name === 'TokenExpiredError') {
              return res.status(401).send({
                auth: false,
                token: '',
                refreshToken: '',
                code: 'server_invalid_credentials',
                message: 'Invalid credentials',
              });
            } else if (err.name === 'JsonWebTokenError') {
              console.log(`[${context} jwt verify] Error `, err.message);
              return res.status(401).send({
                auth: false,
                code: 'server_invalid_apiKey',
                message: 'Invalid apiKey',
              });
            } else {
              console.log(`[${context} jwt verify] Error `, err.message);
              return res.status(400).send({
                auth: false,
                token: '',
                refreshToken: '',
                message: 'Failed to authenticate token. ' + err,
              });
            }
          }

          //console.log("decoded", decoded);
          if (
            decoded.clientType !== 'EXTERNAL_API' &&
            decoded.clientType !== 'OPEN_CHARGE_MAPS_WEB'
          ) {
            var clientType = req.body.clientType;
            var clientName = req.body.clientName;
            var expiresIn;

            var validate = new Date(req.body.validateDate);
            var dateNow = new Date();

            var diff = moment(validate, 'DD/MM/YYYY HH:mm:ss').diff(
              moment(dateNow, 'DD/MM/YYYY HH:mm:ss'),
            );
            var days = moment.duration(diff).asDays();
            //console.log(parseInt(days));

            if (req.body.validateDate) {
              if (parseInt(days) > 0) {
                expiresIn = days + 'd';
              } else {
                let hour = moment.duration(diff).asHours();
                //console.log(parseInt(hour));
                expiresIn = hour + 'h';
              }
            } else {
              expiresIn = process.env.TOKEN_LIFE_APIKEY;
            }

            const apikey = jwt.sign(
              { clientType, clientName },
              process.env.TOKEN_SECRET,
              { expiresIn: expiresIn },
            );

            saveAPIKey(clientType, clientName, validate, apikey)
              .then(() => {
                return res.status(200).send({ auth: true, apikey: apikey });
              })
              .catch((err) => {});
          } else {
            return res.status(400).send({
              auth: false,
              code: 'server_not_authorized_access_externalAPI',
              message: 'Not authorized to access',
            });
          }
        });
      } else {
        return res.status(401).send({
          auth: false,
          code: 'server_general_error',
          message: 'No apikey provided.',
        });
      }
    } else if (req.url.includes('/api/public/language/v2')) {
      if (apikey) {
        jwt.verify(apikey, process.env.TOKEN_SECRET, function (err, decoded) {
          if (err) {
            if (err.name === 'TokenExpiredError') {
              return res.status(401).send({
                auth: false,
                token: '',
                refreshToken: '',
                code: 'server_invalid_credentials',
                message: 'Invalid credentials',
              });
            } else if (err.name === 'JsonWebTokenError') {
              console.log(`[${context} jwt verify] Error `, err.message);
              return res.status(401).send({
                auth: false,
                code: 'server_invalid_apiKey',
                message: 'Invalid apiKey',
              });
            } else {
              console.log(`[${context} jwt verify] Error `, err.message);
              return res.status(400).send({
                auth: false,
                token: '',
                refreshToken: '',
                message: 'Failed to authenticate token. ' + err,
              });
            }
          }
          req.headers['client'] = decoded.clientType;
          req.headers['clientname'] = decoded.clientName;

          console.log(decoded);
          next();
        });
      } else {
        return res.status(401).send({
          auth: false,
          code: 'server_general_error',
          message: 'No apikey provided.',
        });
      }
    } else {
      //console.log(`[${context}] apikey `, apikey);
      if (apikey) {
        // FIXME: Remove ignoreExpiration as soon as possible
        const rawDecoded = jwt.decode(apikey, { complete: true });
        const additionalConfigs =
          rawDecoded.payload?.clientName === 'ACP' ||
          rawDecoded.payload?.clientName === 'KINTO'
            ? { ignoreExpiration: true }
            : {};

        jwt.verify(
          apikey,
          process.env.TOKEN_SECRET,
          additionalConfigs,
          function (err, decoded) {
            if (err) {
              if (err.name === 'TokenExpiredError') {
                return res.status(401).send({
                  auth: false,
                  token: '',
                  refreshToken: '',
                  code: 'server_invalid_credentials',
                  message: 'Invalid credentials',
                });
              } else if (err.name === 'JsonWebTokenError') {
                console.log(`[${context} jwt verify] Error `, err.message);
                return res.status(401).send({
                  auth: false,
                  code: 'server_invalid_apiKey',
                  message: 'Invalid apiKey',
                });
              } else {
                console.log(`[${context} jwt verify] Error `, err.message);
                return res.status(400).send({
                  auth: false,
                  token: '',
                  refreshToken: '',
                  message: 'Failed to authenticate token. ' + err,
                });
              }
            } else {
              // APT Authentication
              if (decoded.clientType === "APT") {
                const isValid = identityLibrary.checkAuthToken(apikey);

                if (isValid) {
                  req.headers["client"] = decoded.clientType;
                  req.headers["clientname"] = decoded.clientName;
                  req.headers["userid"] = req.headers["requestuserid"] = decoded.userId;
                  req.headers["accounttype"] = decoded.accountType;
                  next();
                }

                return res.status(401).send({
                  auth: false,
                  code: "server_user_not_valid",
                  message: "User is not valid",
                });
              }

              if (
                decoded.clientType !== 'EXTERNAL_API' &&
                decoded.clientType !== 'OPEN_CHARGE_MAPS_WEB'
              ) {
                var token = req.headers['token'];
                var refreshtoken = req.headers['refreshtoken'];
                const selectedUserId = req.headers['selecteduserid'];

                verifyVersionCompatibility(
                  decoded.clientType,
                  evioAppVersion,
                  decoded.clientName,
                )
                  .then(() => {
                    if (token && refreshtoken) {
                      if (
                        req.url === '/api/private/logout' &&
                        req.method === 'PATCH'
                      ) {
                        next();
                      } else {
                        try {
                          jwt.verify(token, process.env.TOKEN_SECRET);
                        } catch (err) {
                          return res.status(401).send({
                            auth: false,
                            code: 'server_user_not_valid',
                            message: 'User is not valid',
                          });
                        }

                        const headers = {
                          token: token,
                          refreshtoken: refreshtoken,
                        };
                        axios
                          .get(authorizationServiceProxy, { headers })
                          .then((response) => {
                            if (response.data.username === process.env.Admin) {
                              req.headers['userid'] =
                                selectedUserId ?? response.data.id; //in headers we can't use camelcase, always lowercase
                              req.headers['client'] = decoded.clientType;
                              req.headers['clientname'] = decoded.clientName;
                              if (response.data.requestUserId) {
                                req.headers['requestuserid'] =
                                  response.data.requestUserId;
                                if (response.data.AccountTypeMaster) {
                                  req.headers['accounttype'] =
                                    response.data.AccountTypeMaster;
                                } else {
                                  if (
                                    response.data.id ===
                                      response.data.requestUserId ||
                                    response.data.requestUserId ===
                                      process.env.OperationsManagementID
                                  ) {
                                    req.headers['accounttype'] =
                                      process.env.AccountTypeMaster;
                                  } else {
                                    req.headers['accounttype'] =
                                      process.env.AccountTypeGuest;
                                  }
                                }
                              } else {
                                req.headers['requestuserid'] = response.data.id;
                                req.headers['accounttype'] =
                                  process.env.AccountTypeMaster;
                              }
                              req.headers['usertype'] = response.data.userType
                                ? response.data.userType
                                : 'admin';
                              var requestHistory = new RequestHistory();
                              var uuid4 = UUID.create();
                              requestHistory.clientType = decoded.clientType;
                              requestHistory.requestDate = new Date();
                              requestHistory.clientName = decoded.clientName;
                              requestHistory.requestDate = new Date();
                              requestHistory.requestHeaders = req.headers;
                              requestHistory.path = req.url;
                              requestHistory.userId = req.headers['userid'];
                              requestHistory.requestUserId =
                                req.headers['requestuserid'];
                              requestHistory.accountType =
                                req.headers['accounttype'];
                              requestHistory.mobileBrand = mobileBrand;
                              requestHistory.mobileModel = mobileModel;
                              requestHistory.mobileVersion = mobileVersion;
                              requestHistory.evioAppVersion = evioAppVersion;
                              requestHistory.data = data;
                              requestHistory.reqID = uuid4.hex;
                              requestHistory.method = req.method;
                              req.headers['reqID'] = uuid4.hex;
                              RequestHistory.createRequestHistory(
                                requestHistory,
                                (err, result) => {
                                  if (err) {
                                    console.log(
                                      `[${context} createRequestHistory] Error `,
                                      err.message,
                                    );
                                    return res.status(500).send(err.message);
                                  } else {
                                    if (result) {
                                      next();
                                    } else {
                                      return res.status(400).send({
                                        auth: false,
                                        code: 'server_history_not_save',
                                        message: 'Request history dont save',
                                      });
                                    }
                                  }
                                },
                              );
                              //next();
                            } else if (req.url === '/api/accountActivation') {
                              req.headers['userid'] = response.data.id; //in headers we can't use camelcase, always lowercase
                              req.headers['client'] = decoded.clientType;
                              req.headers['clientname'] = decoded.clientName;
                              if (response.data.requestUserId) {
                                req.headers['requestuserid'] =
                                  response.data.requestUserId;
                                if (response.data.AccountTypeMaster) {
                                  req.headers['accounttype'] =
                                    response.data.AccountTypeMaster;
                                } else {
                                  if (
                                    response.data.id ===
                                      response.data.requestUserId ||
                                    response.data.requestUserId ===
                                      process.env.OperationsManagementID
                                  ) {
                                    req.headers['accounttype'] =
                                      process.env.AccountTypeMaster;
                                  } else {
                                    req.headers['accounttype'] =
                                      process.env.AccountTypeGuest;
                                  }
                                }
                              } else {
                                req.headers['requestuserid'] = response.data.id;
                                req.headers['accounttype'] =
                                  process.env.AccountTypeMaster;
                              }
                              next();
                            } else {
                              verifyValidUserId(
                                response.data.id,
                                decoded.clientType,
                                selectedUserId,
                              )
                                .then((result) => {
                                  // console.log(`[${context}] result`, result);
                                  if (result) {
                                    req.headers['userid'] =
                                      selectedUserId ?? response.data.id; //in headers we can't use camelcase, always lowercase
                                    req.headers['client'] = decoded.clientType;
                                    req.headers['clientname'] =
                                      decoded.clientName;
                                    if (response.data.requestUserId) {
                                      req.headers['requestuserid'] =
                                        response.data.requestUserId;
                                      if (response.data.AccountTypeMaster) {
                                        req.headers['accounttype'] =
                                          response.data.AccountTypeMaster;
                                      } else {
                                        if (
                                          response.data.id ===
                                            response.data.requestUserId ||
                                          response.data.requestUserId ===
                                            process.env.OperationsManagementID
                                        ) {
                                          req.headers['accounttype'] =
                                            process.env.AccountTypeMaster;
                                        } else {
                                          req.headers['accounttype'] =
                                            process.env.AccountTypeGuest;
                                        }
                                      }
                                    } else {
                                      req.headers['requestuserid'] =
                                        response.data.id;
                                      req.headers['accounttype'] =
                                        process.env.AccountTypeMaster;
                                    }
                                    req.headers['usertype'] =
                                      response.data.userType;
                                    var requestHistory = new RequestHistory();
                                    var uuid4 = UUID.create();
                                    requestHistory.clientType =
                                      decoded.clientType;
                                    requestHistory.requestDate = new Date();
                                    requestHistory.clientName =
                                      decoded.clientName;
                                    requestHistory.requestDate = new Date();
                                    requestHistory.requestHeaders = req.headers;
                                    requestHistory.path = req.url;
                                    requestHistory.userId =
                                      req.headers['userid'];
                                    requestHistory.requestUserId =
                                      req.headers['requestuserid'];
                                    requestHistory.accountType =
                                      req.headers['accounttype'];
                                    requestHistory.mobileBrand = mobileBrand;
                                    requestHistory.mobileModel = mobileModel;
                                    requestHistory.mobileVersion =
                                      mobileVersion;
                                    requestHistory.evioAppVersion =
                                      evioAppVersion;
                                    requestHistory.data = data;
                                    requestHistory.reqID = uuid4.hex;
                                    requestHistory.method = req.method;
                                    req.headers['reqID'] = uuid4.hex;

                                    RequestHistory.createRequestHistory(
                                      requestHistory,
                                      (err, result) => {
                                        if (err) {
                                          console.log(
                                            `[${context} createRequestHistory] Error `,
                                            err.message,
                                          );
                                          return res
                                            .status(500)
                                            .send(err.message);
                                        } else {
                                          if (result) {
                                            next();
                                          } else {
                                            return res.status(400).send({
                                              auth: false,
                                              code: 'server_history_not_save',
                                              message:
                                                'Request history dont save',
                                            });
                                          }
                                        }
                                      },
                                    );
                                  } else {
                                    console.log(
                                      `[${context}]server_user_not_valid`,
                                    );
                                    res.status(400).send({
                                      auth: false,
                                      code: 'server_user_not_valid',
                                      message: 'User is not valid',
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
                                      error.message,
                                    );
                                    res.status(500).send({
                                      auth: false,
                                      message: error.message,
                                    });
                                  }
                                });
                            }
                          })
                          .catch((error) => {
                            if (error.response != undefined) {
                              res
                                .status(error.response.status)
                                .send(error.response.data);
                            } else {
                              console.error(
                                `[${context}][${authorizationServiceProxy}] Error`,
                                error.message,
                              );
                              res
                                .status(500)
                                .send({ auth: false, message: error.message });
                            }
                          });
                      }
                    } else {
                      var requestHistory = new RequestHistory();
                      var uuid4 = UUID.create();
                      req.headers['client'] = decoded.clientType;
                      req.headers['clientname'] = decoded.clientName;
                      requestHistory.clientType = decoded.clientType;
                      requestHistory.requestDate = new Date();
                      requestHistory.requestHeaders = req.headers;
                      requestHistory.clientName = decoded.clientName;
                      requestHistory.mobileBrand = mobileBrand;
                      requestHistory.mobileModel = mobileModel;
                      requestHistory.mobileVersion = mobileVersion;
                      requestHistory.evioAppVersion = evioAppVersion;
                      requestHistory.data = data;
                      requestHistory.path = req.url;
                      requestHistory.reqID = uuid4.hex;
                      requestHistory.method = req.method;
                      req.headers['reqID'] = uuid4.hex;

                      RequestHistory.createRequestHistory(
                        requestHistory,
                        (err, result) => {
                          if (err) {
                            console.log(
                              `[${context} createRequestHistory] Error `,
                              err.message,
                            );
                            return res.status(500).send(err.message);
                          } else {
                            if (result) {
                              next();
                            } else {
                              return res.status(400).send({
                                auth: false,
                                code: 'server_history_not_save',
                                message: 'Request history dont save',
                              });
                            }
                          }
                        },
                      );
                    }
                  })
                  .catch((error) => {
                    if (error.auth !== undefined) {
                      return res.status(400).send(error);
                    } else {
                      console.log(
                        `Catch [${context}][verifyVersionCompatibility] Error `,
                        error.message,
                      );
                      return res.status(500).send(error.message);
                    }
                  });
              } else if (
                decoded.clientType === 'EXTERNAL_API' &&
                req.url.includes('evioapi')
              ) {
                next();
              } else if (
                decoded.clientType === 'OPEN_CHARGE_MAPS_WEB' &&
                req.url.includes('/locations')
              ) {
                next();
              } else {
                return res.status(400).send({
                  auth: false,
                  code: 'server_not_authorized_access_externalAPI',
                  message: 'Not authorized to access',
                });
              }
            }
          },
        );
      } else {
        return res.status(401).send({
          auth: false,
          code: 'server_general_error',
          message: 'No apikey provided.',
        });
      }
    }
  } catch (error) {
    console.log(`Catch [${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

function verifyValidUserId(userId, clientType, selectedUserId) {
  const context = 'Function verifyValidUserId';
  return new Promise((resolve, reject) => {
    try {
      let headers = {
        userid: userId,
        client: clientType,
      };

      if (selectedUserId) {
        headers.selecteduserid = selectedUserId;
      }

      let host = process.env.HostIdentity + process.env.PathValidateUser;
      axios
        .get(host, { headers })
        .then((result) => {
          //console.log("result.data", result.data);
          if (result.data.active) {
            /*if (result.data.blocked) {
                             resolve(false)
                         } else {*/
            resolve(true);
            //}
          } else {
            if (result.data.changedEmail) {
              reject({
                auth: false,
                code: 'server_user_not_active',
                message: 'Activate your account using the activation code.',
                changedEmail: true,
              });
            } else {
              resolve(false);
            }
          }
        })
        .catch((error) => {
          if (error.response) {
            console.error(`[${context}] Error `, error.response.data);
            reject(error.response.data);
          } else {
            console.error(`[${context}] Error `, error.message);
            reject(error);
          }
        });
    } catch (error) {
      console.error(`[${context}] Error `, error.message);
      reject(error);
    }
  });
}

async function isAdmin(req, res, next) {
  var context = 'Function isAdmin';

  try {
    apikey = req.headers['token'];
    const decoded = jwt.verify(apikey, process.env.TOKEN_SECRET);

    if (decoded.accessType === 'admin') {
      next();
    } else {
      res.status(401).send({
        auth: false,
        code: 'server_user_not_admin',
        message: 'User is not admin',
      });
    }
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

async function isAuthenticated(req, res, next) {
  var context = 'Function isAuthenticated';
  try {
    apikey = req.headers['apikey'];

    // FIXME: Remove skipExpiration as soon as possible

    const rawDecoded = jwt.decode(apikey, { complete: true });
    const additionalConfigs =
      rawDecoded.payload?.clientName === 'ACP' ||
      rawDecoded.payload?.clientName === 'KINTO'
        ? { ignoreExpiration: true }
        : {};

    let decoded = jwt.verify(
      apikey,
      process.env.TOKEN_SECRET,
      additionalConfigs,
    );

    //console.log("decoded", decoded);

    if (
      ((req.originalUrl === "/api/private/users/company" ||
        req.originalUrl === "/api/private/users/wl") &&
        req.method === "POST") ||
      (req.originalUrl === "/api/private/logout" && req.method === "PATCH") ||
      (req.originalUrl === "/api/private/config/customization" &&
        req.method === "GET") ||
      (req.originalUrl === "/api/private/config/customization/" &&
        req.method === "GET")
    ) {
      next();
    } else if (
      req.originalUrl.includes('/api/private/controlcenter') ||
      req.url.includes('/ocpi/cpo/')
    ) {
      next();
    } else {
      // First request to authorization service to check if tokens are valids
      var token = req.headers['token'];
      var refreshtoken = req.headers['refreshtoken'];
      const selectedUserId = req.headers['selecteduserid'];

      if (token && refreshtoken) {
        const headers = {
          token: token,
          refreshtoken: refreshtoken,
          apikey: req.headers.apikey,
        };

        axios
          .get(authorizationServiceProxy, { headers })
          .then(function (response) {
            if (response.data.username === process.env.Admin) {
              req.headers['userid'] = response.data.id; //in headers we can't use camelcase, always lowercase
              if (response.data.requestUserId) {
                req.headers['requestuserid'] = response.data.requestUserId;
                if (response.data.AccountTypeMaster) {
                  req.headers['accounttype'] = response.data.AccountTypeMaster;
                } else {
                  if (
                    response.data.id === response.data.requestUserId ||
                    response.data.requestUserId ===
                      process.env.OperationsManagementID
                  ) {
                    req.headers['accounttype'] = process.env.AccountTypeMaster;
                  } else {
                    req.headers['accounttype'] = process.env.AccountTypeGuest;
                  }
                }
              } else {
                req.headers['requestuserid'] = response.data.id;
                req.headers['accounttype'] = process.env.AccountTypeMaster;
              }
              next();
            } else {
              verifyValidUserId(
                response.data.id,
                decoded.clientType,
                selectedUserId,
              )
                .then((result) => {
                  if (result) {
                    req.headers['userid'] = selectedUserId ?? response.data.id; //in headers we can't use camelcase, always lowercase
                    req.headers['usertype'] = response.data.userType;
                    if (response.data.requestUserId) {
                      req.headers['requestuserid'] =
                        response.data.requestUserId;
                      if (response.data.AccountTypeMaster) {
                        req.headers['accounttype'] =
                          response.data.AccountTypeMaster;
                      } else {
                        if (
                          response.data.id === response.data.requestUserId ||
                          response.data.requestUserId ===
                            process.env.OperationsManagementID
                        ) {
                          req.headers['accounttype'] =
                            process.env.AccountTypeMaster;
                        } else {
                          req.headers['accounttype'] =
                            process.env.AccountTypeGuest;
                        }
                      }
                    } else {
                      req.headers['requestuserid'] = response.data.id;
                      req.headers['accounttype'] =
                        process.env.AccountTypeMaster;
                    }

                    next();
                  } else {
                    console.log(`[${context}]server_user_not_valid`);
                    res.status(400).send({
                      auth: false,
                      code: 'server_user_not_valid',
                      message: 'User is not valid',
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
                      error.message,
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
                error.message,
              );
              res.status(500).send({ auth: false, message: error.message });
            }
          });
      } else {
        console.log('2');
        res.status(401).send({
          auth: false,
          code: 'server_tokens_provided',
          message: 'Tokens must be provided',
        });
      }
    }
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

function hasValidCredentials(req, res, next) {
  var context = 'Function hasValidCredentials';
  try {
    var username = req.body.username;
    var password = req.body.password;

    if (!username)
      return res.status(400).send({
        auth: false,
        code: 'server_invalid_username',
        message: 'Invalid username',
      });

    if (!password)
      return res.status(400).send({
        auth: false,
        code: 'server_invalid_password',
        message: 'Invalid password',
      });

    // Call identity service
    next();
  } catch (error) {
    console.log(`[${context}] Error `, error.message);
    return res.status(500).send(error.message);
  }
}

function verifyVersionCompatibility(clientType, evioAppVersion, clientName) {
  var context = 'Function verifyVersionCompatibility';
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
              code: 'server_need_update_app',
              message: 'App need to be updated',
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
  var context = 'Function getVersionCompatibility';
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

const authorizationServiceProxy = 'http://authorization:3001/api/checkauth/';

const impersonateUserServiceProxy = httpProxy('http://identity:3003/', {
  forwardPath: () => 'http://identity:3003/api/authenticate/selectAccount',
});

app.use('/evioapi', require('./routes/externalAPI'));
//app.use(require('./routes/externalAPI'));
app.use('/locations', require('./routes/openChargeMaps'));

app.use('/api/private/', isAuthenticated);

app.use(
  '/api/authenticate/selectAccount',
  isAuthenticated,
  isAdmin,
  impersonateUserServiceProxy,
);

app.use(
  ['/api/authenticate', '/api/wl/authenticate', '/api/company/authenticate'],
  hasValidCredentials,
  (req, res) => {
    const identityServiceProxy = httpProxy('http://identity:3003/', {
      forwardPath: () => `http://identity:3003/api/authenticate`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    });

    identityServiceProxy(req, res, (err, result) => {
      if (err) {
        console.log('[/api/authenticate] Error', err.message);
        return res.status(500).send(err.message);
      } else console.log('[/api/authenticate] Result', result);
    });
  },
);

app.use('/api/goCharge/authenticate', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003/api/goCharge/authenticate`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/goCharge/authenticat] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/goCharge/authenticat] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/goCharge/authenticat] Result', result);
  });
});

app.use('/api/hyundai/authenticate', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003/api/hyundai/authenticate`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/hyundai/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/hyundai/authenticate] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/hyundai/authenticate] Result', result);
  });
});

app.use('/api/recover_password', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003/api/recover_password`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/recover_password] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/recover_password] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/recover_password] Result', result);
  });
});

app.use('/api/company/recover_password', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003/api/company/recover_password`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/company/recover_password] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/company/recover_password] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/company/recover_password] Result', result);
  });
});

app.use('/api/opManagement/authenticate', hasValidCredentials, (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003/api/opManagement/authenticate`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/opManagement/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/opManagement/authenticate] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/opManagement/authenticate] Result', result);
  });
});

app.use('/api/adminUser/authenticate', hasValidCredentials, (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003/api/adminUser/authenticate`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/adminUser/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/adminUser/authenticate] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/adminUser/authenticate] Result', result);
  });
});

app.use('/api/private/users', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/users] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/users] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/users] Result', result);
  });
});

app.use('/api/private/drivers', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/drivers] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/drivers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/drivers] Result', result);
  });
});

app.use('/api/private/groupDrivers', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/groupDrivers] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/groupDrivers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/groupDrivers] Result', result);
  });
});

app.use('/api/private/guestUsers', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/guestUsers] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/guestUsers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/guestUsers] Result', result);
  });
});

app.use('/api/private/groupCSUsers', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/groupCSUsers] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/groupCSUsers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/groupCSUsers] Result', result);
  });
});

app.use("/api/private/chargers/V2/salesTariff", (req, res) => {
  const chargerTariffProxy = httpProxy("http://tariffs:3009/", {
      forwardPath: () => `http://tariffs:3009${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      let updateLog = {
        responseDate: Date.now(),
        responseCode: "500",
      };
      updateResponseLogs(req.headers["reqID"], updateLog);
      console.log("[/api/private/chargers/V2/salesTariff] Error", err.message);
      next(err);
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return Promise.resolve();
    },
    userResDecorator: (proxyRes, proxyResData) => {
      let updateLog = {
        responseDate: Date.now(),
        responseCode: proxyRes.statusCode,
      };
      updateResponseLogs(req.headers["reqID"], updateLog);
      return Promise.resolve(proxyResData);
    },
  });

  console.log(`http://tariffs:3009${req.originalUrl}`);
  chargerTariffProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/api/private/chargers/V2/salesTariff] Proxy Error", err.message);
      return res.status(500).send(err.message);
    }
  });
});

app.use("/api/private/chargers/V2/groupCSUsers", (req, res) => {
  const identityServiceProxy = httpProxy("http://identity:3003/", {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log("[/api/private/chargers/v2/groupCSUsers] Error", err.message);
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

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/api/private/chargers/v2/groupCSUsers] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/api/private/chargers/v2/groupCSUsers] Result", result);
  });
});

app.use("/api/private/contracts", (req, res) => {
  const identityServiceProxy = httpProxy("http://identity:3003/", {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/contracts] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/contracts] Result', result);
  });
});

app.use('/api/private/updateMobieAppUserToken', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/updateMobieAppUserToken] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/updateMobieAppUserToken] Result', result);
  });
});

app.use('/api/private/createMobieRFIDToken', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/createMobieRFIDToken] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/createMobieRFIDToken] Result', result);
  });
});

app.use('/api/private/cemeTariff', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/cemeTariff] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/cemeTariff] Result', result);
  });
});

app.use('/api/private/listCEME', (req, res) => {
  const publicTariffsServiceProxy = httpProxy('http://public-tariffs:3027/', {
    forwardPath: () => `http://public-tariffs:3027${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-tariffs:3027${req.originalUrl}`);
  publicTariffsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/listCEME] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/listCEME] Result', result);
  });
});

app.use('/api/private/schedulesCEME', (req, res) => {
  const publicTariffsServiceProxy = httpProxy('http://public-tariffs:3027/', {
    forwardPath: () => `http://public-tariffs:3027${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-tariffs:3027${req.originalUrl}`);
  publicTariffsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/schedulesCEME] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/schedulesCEME] Result', result);
  });
});

app.use('/api/private/tariffCEME', (req, res) => {
  const publicTariffsServiceProxy = httpProxy('http://public-tariffs:3027/', {
    forwardPath: () => `http://public-tariffs:3027${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-tariffs:3027${req.originalUrl}`);
  publicTariffsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/tariffCEME] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/tariffCEME] Result', result);
  });
});

app.use('/api/private/tariffsOPC', (req, res) => {
  const publicTariffsServiceProxy = httpProxy('http://public-tariffs:3027/', {
    forwardPath: () => `http://public-tariffs:3027${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-tariffs:3027${req.originalUrl}`);
  publicTariffsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/tariffsOPC] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/tariffsOPC] Result', result);
  });
});

app.use('/api/private/tariffTar', (req, res) => {
  const publicTariffsServiceProxy = httpProxy('http://public-tariffs:3027/', {
    forwardPath: () => `http://public-tariffs:3027${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-tariffs:3027${req.originalUrl}`);
  publicTariffsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/tariffTar] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/tariffTar] Result', result);
  });
});

app.use('/api/private/healthCheck/dockerList', (req, res) => {
  const healthCheckServiceProxy = httpProxy(
    'http://job-check-healthcheck:3023/',
    {
      forwardPath: () => `http://job-check-healthcheck:3023${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://job-check-healthcheck:3023${req.originalUrl}`);
  healthCheckServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/healthCheck/dockerList] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/healthCheck/dockerList] Result', result);
  });
});

app.use('/api/private/evs', (req, res) => {
  const evsServiceProxy = httpProxy('http://evs:3006/', {
    forwardPath: () => `http://evs:3006${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evs:3006${req.originalUrl}`);
  evsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/evs] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/evs] Result', result);
  });
});

app.use('/api/private/ev', (req, res) => {
  const evsServiceProxy = httpProxy('http://evs:3006/', {
    forwardPath: () => `http://evs:3006${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evs:3006${req.originalUrl}`);
  evsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/ev] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/ev] Result', result);
  });
});

app.use('/api/ev/session/kms', (req, res) => {
  const evsServiceProxy = httpProxy('http://evs:3006/', {
    forwardPath: () => `http://evs:3006${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evs:3006${req.originalUrl}`);
  evsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/fleets] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/fleets] Result', result);
  });
});

app.use('/api/private/fleets', (req, res) => {
  const evsServiceProxy = httpProxy('http://evs:3006/', {
    forwardPath: () => `http://evs:3006${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evs:3006${req.originalUrl}`);
  evsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/fleets] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/fleets] Result', result);
  });
});

app.use('/api/private/apt/', (req, res) => {
  const paymentsRegex = /^\/api\/private\/apt\/[^/]+\/payments\/[^/]+/;
  const isPaymentsRoute = paymentsRegex.test(req.originalUrl);

  const proxyOptions = {
    forwardPath: () => `http://apt:6001${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          console.log("[/api/private/apt/] Error", err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        resolve();
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        resolve(proxyResData);
      });
    },
  };

  if (isPaymentsRoute) {
    proxyOptions.timeout = 150_000;
  }

  const aptServiceProxy = httpProxy("http://apt:6001/", proxyOptions);

  console.log(`http://apt:6001${req.originalUrl}`);
  aptServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/api/private/apt] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/api/private/apt] Result", result);
  });
});

app.use("/api/private/chargers/operator", (req, res) => {
  const chargersServiceProxy = httpProxy("http://chargers:3002/", {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/chargers/operator] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargers/operator] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargers/operator] Result', result);
  });
});

app.use('/api/private/chargers', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargers] Result', result);
  });
});

app.use('/api/private/switchboards', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/switchboards] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/switchboards] Result', result);
  });
});

app.use('/api/private/chargers/translation', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });
  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargers/translation] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargers/translation] Result', result);
  });
});

app.use('/api/private/chargers/locations', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });
  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargers/locations] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargers/locations] Result', result);
  });
});

app.use('/api/private/notifymeHistory', (req, res) => {
  const chargersServiceProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/notifymeHistory] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/notifymeHistory] Result', result);
  });
});

app.use('/api/private/mailNotification', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://notifications:3008/',
    {
      forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/private/mailNotification] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://notifications:3008${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/mailNotification] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/mailNotification] Result', result);
  });
});

app.use('/api/private/connectionstation/ocppj/logs', (req, res) => {
  const connectionStationServiceProxy = httpProxy('http://ocpp-j-16:3018/', {
    forwardPath: (req) => '/api/private/connectionstation/ocppj/logs',
  });

  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.error('[/api/private/connectionstation/ocppj/logs] Error', err);
      return res.status(500).send(err.message);
    }
    console.log('[/api/private/connectionstation/ocppj/logs] Result', result);
  });
});

app.use([
  "/api/private/connectionstation",
  "/api/private/v2/connectionstation"
], (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/connectionstation] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/connectionstation] Result', result);
  });
});

app.use('/api/public/connectionstation', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/connectionstation] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/connectionstation] Result', result);
  });
});

app.use('/api/public/connectionstation/chargers', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/public/connectionstation/chargers] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/public/connectionstation/chargers] Result', result);
  });
});

app.use('/api/private/connectionstation/chargers', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
            next(err);
          }
        }
      },
      skipToNextHandlerFilter: (proxyRes) => {
        return new Promise(function (resolve, reject) {
          if (proxyRes.statusCode === 304) {
            let updateLog = {
              responseDate: Date.now(),
              //esponseBody: 'Updated failed',
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/connectionstation/chargers] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/private/connectionstation/chargers] Result', result);
  });
});

app.use('/api/public/connectionstation/opManagement', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/public/connectionstation/opManagement] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/public/connectionstation/opManagement] Result',
        result,
      );
  });
});

app.use('/api/private/connectionstation/opManagement', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/public/connectionstation/opManagement] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/public/connectionstation/opManagement] Result',
        result,
      );
  });
});

app.use('/api/private/evio_device/transactionFailed', (req, res) => {
  const evioDeviceServiceProxy = httpProxy('http://sonoff-client:3010/', {
    forwardPath: (req) => `http://sonoff-client:3010${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://sonoff-client:3010${req.originalUrl}`);
  evioDeviceServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/evio_device/transactionFailed] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/evio_device/transactionFailed] Result',
        result,
      );
  });
});

app.use('/api/private/evio_box', (req, res) => {
  const evioDeviceServiceProxy = httpProxy('http://evio-box:3007/', {
    forwardPath: (req) => `http://evio-box:3007${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evio-box:3007${req.originalUrl}`);
  evioDeviceServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/evio_box] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/evio_box] Result', result);
  });
});

app.use('/api/private/groups', (req, res) => {
  const groupsServiceProxy = httpProxy('http://groups:3007/', {
    forwardPath: (req) => `http://groups:3007${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://groups:3007${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/groups] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/groups] Result', result);
  });
});

app.use('/api/accountActivation', (req, res) => {
  const groupsServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: (req) => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/accountActivation] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/accountActivation] Result', result);
  });
});

app.use('/api/private/smsNotifications', (req, res) => {
  const groupsServiceProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/smsNotifications] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/smsNotifications] Result', result);
  });
});

app.use('/api/public/smsNotifications', (req, res) => {
  const groupsServiceProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/smsNotifications] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/smsNotifications] Result', result);
  });
});

app.use('/api/private/notifications', (req, res) => {
  const groupsServiceProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/notifications] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/notifications] Result', result);
  });
});

app.use('/api/private/salesTariff', (req, res) => {
  const groupsServiceProxy = httpProxy('http://tariffs:3009/', {
    forwardPath: (req) => `http://tariffs:3009${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://tariffs:3009${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/api/private/salesTariff] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/api/private/salesTariff] Result", result);
  });
});

app.use("/api/private/tariffTesla", (req, res) => {
  const groupsServiceProxy = httpProxy("http://tariffs:3009/", {
    forwardPath: (req) => `http://tariffs:3009${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://tariffs:3009${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/tariffTesla] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/tariffTesla] Result', result);
  });
});

app.use('/api/private/chargingSession', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargingSession] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargingSession] Result', result);
  });
});

app.use('/api/private/comissionClient', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/comissionClient] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/comissionClient] Result', result);
  });
});

app.use('/api/private/comissionEVIO', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/comissionEVIO] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/comissionEVIO] Result', result);
  });
});

app.use('/api/private/infrastructure', (req, res) => {
  const infrastructureServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  infrastructureServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/infrastructure] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/infrastructure] Result', result);
  });
});

app.use('/api/private/chargingSession/myActiveSessions', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/chargingSession/myActiveSessions] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/chargingSession/myActiveSessions] Result',
        result,
      );
  });
});

app.use('/api/private/questions', (req, res) => {
  const questionsServiceProxy = httpProxy('http://questions:3013/', {
    forwardPath: (req) => `http://questions:3013${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://questions:3013${req.originalUrl}`);
  questionsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/questions] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/questions] Result', result);
  });
});

app.use('/api/public/questions', (req, res) => {
  const questionsServiceProxy = httpProxy('http://questions:3013/', {
    forwardPath: (req) => `http://questions:3013${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://questions:3013${req.originalUrl}`);
  questionsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/questions] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/questions] Result', result);
  });
});

app.use('/api/private/chargerTypes', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargerTypes] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargerTypes] Result', result);
  });
});

app.use('/api/private/chargerTypes/read', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargerTypes/read] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargerTypes/read] Result', result);
  });
});

app.use('/api/private/chargingSchedule', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargingSchedule] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargingSchedule] Result', result);
  });
});

app.use('/api/public/chargers', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/chargers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/chargers] Result', result);
  });
});

app.use('/api/private/hostIssues', (req, res) => {
  const chargersServiceProxy = httpProxy('http://issues-management:3014/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://issues-management:3014${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/hostIssues] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/hostIssues] Result', result);
  });
});

app.use('/api/private/chargersEvio', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/chargersEvio] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/chargersEvio] Result', result);
  });
});

createProxyRoute(app, '/api/public/language', 'http://language:3005');
createProxyRoute(
  app,
  '/api/private/user/preferences/language',
  'http://identity:3003',
);

app.post('/api/language/clearCache', async (req, res) => {
  try {
    await languageClearCache();
    res.status(200).send({ message: 'Cache cleared' });
  } catch (error) {
    console.error('Error clearing cache', error);
    res.status(500).send({ message: 'Error clearing cache' });
  }
});

app.use('/api/private/qrCode', (req, res) => {
  const mobieServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  mobieServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/qrCode] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/qrCode] Result', result);
  });
});

app.use('/api/private/openChargeMap', (req, res) => {
  const chargersServiceProxy = httpProxy('http://open-charger-map:3021/', {
    forwardPath: (req) => `http://open-charger-map:3021${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://open-charger-map:3021${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/openChargeMap] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/openChargeMap] Result', result);
  });
});

app.use('/api/public/openChargeMap', (req, res) => {
  const chargersServiceProxy = httpProxy('http://open-charger-map:3021/', {
    forwardPath: (req) => `http://open-charger-map:3021${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://open-charger-map:3021${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/openChargeMap] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/openChargeMap] Result', result);
  });
});

app.use('/api/private/evioIssues', (req, res) => {
  const issuesManagementServiceProxy = httpProxy(
    'http://issues-management:3014/',
    {
      forwardPath: (req) => `http://issues-management:3014${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://issues-management:3014${req.originalUrl}`);
  issuesManagementServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/evioIssues] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/evioIssues] Result', result);
  });
});

app.use('/api/private/booking', (req, res) => {
  const bookingServiceProxy = httpProxy('http://booking:3015/', {
    forwardPath: (req) => `http://booking:3015${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://booking:3015${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/booking] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/booking] Result', result);
  });
});

app.use('/api/private/automaticBooking', (req, res) => {
  const bookingServiceProxy = httpProxy('http://booking:3015/', {
    forwardPath: (req) => `http://booking:3015${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://booking:3015${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/automaticBooking] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/automaticBooking] Result', result);
  });
});

app.use('/api/public/connectionstation/siemens_protocol', (req, res) => {
  const chargersServiceProxy = httpProxy('http://siemens-connection:3012/', {
    forwardPath: (req) => `http://siemens-connection:3012${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://siemens-connection:3012${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/public/connectionstation/siemens_protocol] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[//api/public/connectionstation/siemens_protocol] Result',
        result,
      );
  });
});

app.use('/api/private/payments', (req, res) => {
  const version = req.originalUrl.includes('v2') ? true : false;

  if (version) {
    paymentsv2(req, res);
    return;
  }

  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/payments] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/payments] Result', result);
  });
});

const paymentsv2 = (req, res) => {
  const paymentsV2ServiceProxy = httpProxy('http://payments-v2:6002/', {
    forwardPath: (req) => `http://payments-v2:6002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments-v2:6002${req.originalUrl}`);
  paymentsV2ServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/payments/v2] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/payments/v2] Result', result);
  });
};

app.use('/api/private/paymentsLusoPay', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/paymentsLusoPay] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/paymentsLusoPay] Result', result);
  });
});

app.use('/api/private/paymentsAdyen', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/paymentsAdyen] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/paymentsAdyen] Result', result);
  });
});

app.use('/api/private/paymentMethods', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/paymentMethods] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/paymentMethods] Result', result);
  });
});

app.use('/api/private/wallet', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/wallet] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/wallet] Result', result);
  });
});

app.use('/api/public/wallet', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/wallet] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/wallet] Result', result);
  });
});

app.use('/api/private/transactions', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/transactions] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/transactions] Result', result);
  });
});

app.use('/api/private/customer', (req, res) => {
  const bookingServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/customer] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/customer] Result', result);
  });
});

app.use('/api/private/managementPOIs', (req, res) => {
  const chargersServiceProxy = httpProxy('http://chargers:3002/', {
    forwardPath: (req) => `http://chargers:3002${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://chargers:3002${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/managementPOIs] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/managementPOIs] Result', result);
  });
});

app.use('/api/private/insights', (req, res) => {
  const chargersServiceProxy = httpProxy('http://statistics:3026/', {
    forwardPath: (req) => `http://statistics:3026${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://statistics:3026${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/insights] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/insights] Result', result);
  });
});

app.use('/api/private/history', (req, res) => {
  const chargersServiceProxy = httpProxy('http://statistics:3026/', {
    forwardPath: (req) => `http://statistics:3026${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log("[/api/private/history'] Error", err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://statistics:3026${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/history] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/history] Result', result);
  });
});

app.use('/api/private/insights_v2', (req, res) => {
  const chargersServiceProxy = httpProxy('http://statitics-v2:3031/', {
    forwardPath: (req) => `http://statitics-v2:3031${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/insights_v2] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://statitics-v2:3031${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/insights_v2] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/insights_v2] Result', result);
  });
});

app.use('/api/private/controlcenter/fileHandlerNGNIX', (req, res) => {
  const chargersServiceProxy = httpProxy('http://control-center:3040/', {
    forwardPath: (req) => `http://control-center:3040${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log(
            '[/api/private/controlcenter/fileHandlerNGNIX] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://control-center:3040/${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/controlcenter/fileHandlerNGNIX] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/controlcenter/fileHandlerNGNIX] Result',
        result,
      );
  });
});

app.use('/api/private/history_v2', (req, res) => {
  const chargersServiceProxy = httpProxy('http://statitics-v2:3031/', {
    forwardPath: (req) => `http://statitics-v2:3031${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/history_v2] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://statitics-v2:3031${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/history_v2] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/history_v2] Result', result);
  });
});

app.use('/api/private/reports', (req, res) => {
  const chargersServiceProxy = httpProxy('http://statitics-v2:3031/', {
    forwardPath: (req) => `http://statitics-v2:3031${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/reports] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://statitics-v2:3031${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/reports] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/reports] Result', result);
  });
});

app.use('/api/private/proxy', (req, res) => {
  const chargersServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/proxy] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/proxy] Result', result);
  });
});

app.use('/api/private/publicNetwork/details', (req, res) => {
  const publicNetworkServiceProxy = httpProxy('http://public-network:3029/', {
    forwardPath: (req) => `http://public-network:3029${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-network:3029${req.originalUrl}`);
  publicNetworkServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/publicNetwork/details] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/publicNetwork/details] Result', result);
  });
});

app.use('/api/private/publicNetwork/managementPOIs', (req, res) => {
  const publicNetworkServiceProxy = httpProxy('http://public-network:3029/', {
    forwardPath: (req) => `http://public-network:3029${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-network:3029${req.originalUrl}`);
  publicNetworkServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/publicNetwork/managementPOIs] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/private/publicNetwork/managementPOIs] Result', result);
  });
});

app.use(["/api/private/publicNetwork", "/api/private/operators"], (req, res) => {
  const publicNetworkServiceProxy = httpProxy("http://public-network:3029/", {
    forwardPath: (req) => `http://public-network:3029${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-network:3029${req.originalUrl}`);
  publicNetworkServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/publicNetwork] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/publicNetwork] Result', result);
  });
});

app.use('/api/private/evsdb/brands', (req, res) => {
  const evDatabaseServiceProxy = httpProxy('http://ev-database:3025/', {
    forwardPath: (req) => `http://ev-database:3025${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ev-database:3025${req.originalUrl}`);
  evDatabaseServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/evsdb/brands] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/evsdb/brands] Result', result);
  });
});

app.use('/api/private/evsdb/models', (req, res) => {
  const evDatabaseServiceProxy = httpProxy('http://ev-database:3025/', {
    forwardPath: (req) => `http://ev-database:3025${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ev-database:3025${req.originalUrl}`);
  evDatabaseServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/evsdb/models] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/evsdb/models] Result', result);
  });
});

app.use('/api/private/evsdb/versions', (req, res) => {
  const evDatabaseServiceProxy = httpProxy('http://ev-database:3025/', {
    forwardPath: (req) => `http://ev-database:3025${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ev-database:3025${req.originalUrl}`);
  evDatabaseServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/evsdb/versions] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/evsdb/versions] Result', result);
  });
});

app.use('/api/private/config/appVersions', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/appVersions] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/appVersions] Result', result);
  });
});

app.use('/api/private/config/getAPIKey', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/config/getAPIKey] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/getAPIKey] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/getAPIKey] Result', result);
  });
});

app.use('/api/private/config/customization', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/config/customization] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/customization] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/customization] Result', result);
  });
});

app.use('/api/private/config/timeToValidatePayment', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/config/timeToValidatePayment] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/private/config/timeToValidatePayment] Result', result);
  });
});

app.use('/api/private/config/managementPOIs', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/managementPOIs] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/managementPOIs] Result', result);
  });
});

app.use('/api/private/config/messages', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/messages] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/messages] Result', result);
  });
});

app.use('/api/private/config', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config] Result', result);
  });
});

app.use(
  '/api/private/cpModelsWithNoAvailableStatusNotification',
  (req, res) => {
    const configServiceProxy = httpProxy('http://configs:3028/', {
      forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    });

    console.log(`http://configs:3028${req.originalUrl}`);
    configServiceProxy(req, res, (err, result) => {
      if (err) {
        console.log(
          '[/api/private/cpModelsWithNoAvailableStatusNotification] Error',
          err.message,
        );
        return res.status(500).send(err.message);
      } else
        console.log(
          '[/api/private/cpModelsWithNoAvailableStatusNotification] Result',
          result,
        );
    });
  },
);

app.use('/api/private/appVersions', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/appVersions] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/appVersions] Result', result);
  });
});

app.use('/api/private/config/mailNotification', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/mailNotification] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/mailNotification] Result', result);
  });
});

app.use('/api/private/config/openChargeMap', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/openChargeMap] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/openChargeMap] Result', result);
  });
});

app.use('/api/private/versionCompatibility', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/versionCompatibility] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/versionCompatibility] Result', result);
  });
});

app.use('/api/private/config/siemensSession', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/siemensSession] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/siemensSession] Result', result);
  });
});

app.use('/api/private/notificationsSettings', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/notificationsSettings] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/notificationsSettings] Result', result);
  });
});

app.use('/api/private/checkUserNotificationSettings', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log(
            '[/api/private/checkUserNotificationSettings] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/checkUserNotificationSettings] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/checkUserNotificationSettings] Result',
        result,
      );
  });
});

app.use('/api/private/connectionstation/landingPage', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/connectionstation/landingPage] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/connectionstation/landingPage] Result',
        result,
      );
  });
});

app.use('/api/public/connectionstation/landingPage', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://connection-station-management:3004/',
    {
      forwardPath: (req) =>
        `http://connection-station-management:3004${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/api/authenticate] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    },
  );

  console.log(`http://connection-station-management:3004${req.originalUrl}`);
  connectionStationServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/public/connectionstation/landingPage] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/public/connectionstation/landingPage] Result', result);
  });
});

app.use('/api/private/firebase/token', (req, res) => {
  let host;
  if (req.headers['clientname'] === 'EVIO') {
    host = 'http://notifications:3008';
  } else {
    host = 'http://notifications-firebase-wl:3032';
  }

  const firebaseProxy = httpProxy(host, {
    forwardPath: (req) => `${host}${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`${host}${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/firebase/token] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/firebase/token] Result', result);
  });
});

app.use('/api/private/firebase/start', (req, res) => {
  let host;
  if (req.headers['clientname'] === 'EVIO') {
    host = 'http://notifications:3008';
  } else {
    host = 'http://notifications-firebase-wl:3032';
  }

  const firebaseProxy = httpProxy(host, {
    forwardPath: (req) => `${host}${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`${host}${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/firebase/start] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/firebase/start] Result', result);
  });
});

app.use('/api/private/firebase/stop', (req, res) => {
  let host;
  if (req.headers['clientname'] === 'EVIO') {
    host = 'http://notifications:3008';
  } else {
    host = 'http://notifications-firebase-wl:3032';
  }
  const firebaseProxy = httpProxy(host, {
    forwardPath: (req) => `${host}${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`${host}${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/firebase/stop] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/firebase/stop] Result', result);
  });
});

app.use('/api/private/firebase/data', (req, res) => {
  let host;
  if (req.headers['clientname'] === 'EVIO') {
    host = 'http://notifications:3008';
  } else {
    host = 'http://notifications-firebase-wl:3032';
  }
  const firebaseProxy = httpProxy(host, {
    forwardPath: (req) => `${host}${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`${host}${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/firebase/data] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/firebase/data] Result', result);
  });
});

app.use('/api/public/firebase/token', (req, res) => {
  let host;
  if (req.headers['clientname'] === 'EVIO') {
    host = 'http://notifications:3008';
  } else {
    host = 'http://notifications-firebase-wl:3032';
  }
  const firebaseProxy = httpProxy(host, {
    forwardPath: (req) => `${host}${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`${host}${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/firebase/token] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/firebase/token] Result', result);
  });
});

app.use('/api/private/billingProfile', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/billingProfile] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/billingProfile] Result', result);
  });
});

app.use('/api/private/cards', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/cards] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/cards] Result', result);
  });
});

app.use('/api/private/config/fees', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/config/fees] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/config/fees] Result', result);
  });
});

app.use('/api/private/config/energyConsumptionEndOfCharging', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/config/energyConsumptionEndOfCharging] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/config/energyConsumptionEndOfCharging] Result',
        result,
      );
  });
});

app.use('/api/private/support', (req, res) => {
  const groupsServiceProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/support] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/support] Result', result);
  });
});

app.use('/api/public/support', (req, res) => {
  const groupsServiceProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/support] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/support] Result', result);
  });
});

app.use('/api/private/createBillingDocument', (req, res) => {
  const identityServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/createBillingDocument] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/createBillingDocument] Result', result);
  });
});

app.use('/api/private/getBillingDocument', (req, res) => {
  const identityServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/getBillingDocument] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/getBillingDocument] Result', result);
  });
});

app.use('/api/private/createTopUpEmail', (req, res) => {
  const identityServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/createTopUpEmail] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/createTopUpEmail] Result', result);
  });
});

app.use('/api/public/contract', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/public/contract] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/public/contract] Result', result);
  });
});

app.use('/api/private/firebase/sendNotificationToUsers', (req, res) => {
  let host;
  if (req.headers['clientname'] === 'EVIO') {
    host = 'http://notifications:3008';
  } else {
    host = 'http://notifications-firebase-wl:3032';
  }

  const chargersServiceProxy = httpProxy(host, {
    forwardPath: (req) => `${host}${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`${host}${req.originalUrl}`);
  chargersServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/firebase/sendNotificationToUsers] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/firebase/sendNotificationToUsers] Result',
        result,
      );
  });
});

app.use('/api/private/setupNotifications', (req, res) => {
  const configServiceProxy = httpProxy('http://configs:3028/', {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/setupNotifications] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/setupNotifications] Result', result);
  });
});

app.use('/api/private/checkFailedEmails', (req, res) => {
  const identityServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/checkFailedEmails] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/checkFailedEmails] Result', result);
  });
});

app.use('/api/private/user/revertRequestDeleteAccount', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`http://identity:3003${req.originalUrl} Error`, err.message);
      return res.status(500).send(err.message);
    } else console.log(`http://identity:3003${req.originalUrl} Result`, result);
  });
});

app.use('/api/private/user/deleteUser', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`http://identity:3003${req.originalUrl} Error`, err.message);
      return res.status(500).send(err.message);
    } else console.log(`http://identity:3003${req.originalUrl} Result`, result);
  });
});

app.use('/api/private/user/processAfter30DaysDeleteAccount', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`http://identity:3003${req.originalUrl} Error`, err.message);
      return res.status(500).send(err.message);
    } else console.log(`http://identity:3003${req.originalUrl} Result`, result);
  });
});

app.use('/api/private/createMobiEBillingDocument', (req, res) => {
  const identityServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/createMobiEBillingDocument] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/private/createMobiEBillingDocument] Result', result);
  });
});

app.use('/api/private/logout', (req, res) => {
  const identityServiceProxy = httpProxy('http://authorization:3001/', {
    forwardPath: () => `http://authorization:3001${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://authorization:3001${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/logout] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/logoutt] Result', result);
  });
});

app.use('/api/private/usersPackages', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/usersPackages] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/usersPackages] Result', result);
  });
});

app.use('/api/private/imagesDependencies', (req, res) => {
  const publicNetworkServiceProxy = httpProxy('http://public-network:3029/', {
    forwardPath: (req) => `http://public-network:3029${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-network:3029${req.originalUrl}`);
  publicNetworkServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/imagesDependencies] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/imagesDependencies] Result', result);
  });
});

app.use('/api/private/notifyUsers', (req, res) => {
  const firebaseProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/notifyUsers] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/notifyUsers] Result', result);
  });
});

app.use('/private/oicp/subscription', (req, res) => {
  const oicpServiceProxy = httpProxy('http://oicp:3034/', {
    forwardPath: () => `http://oicp:3034${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/private/oicp/subscription] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://oicp:3034${req.originalUrl}`);
  oicpServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/private/oicp/subscription] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/private/oicp/subscription] Result', result);
  });
});

// Just for ChargerNotification after that is to be eliminated
//app.use('/api/oicp/notificationmgmt/v11/charging-notifications', (req, res) => {
app.use(
  '/api/oicp/charging/v21/operators/DE*ICE/authorize/start',
  (req, res) => {
    const oicpServiceProxy = httpProxy('http://oicp:3034/', {
      forwardPath: () => `http://oicp:3034${req.originalUrl}`,
      proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
          default: {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: err.message,
              responseCode: '500',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);

            console.log('[/private/oicp/subscription] Error', err.message);
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
              responseCode: '304',
            };
            updateResponseLogs(req.headers['reqID'], updateLog);
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
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve(proxyResData);
        });
      },
    });

    console.log(`http://oicp:3034${req.originalUrl}`);
    oicpServiceProxy(req, res, (err, result) => {
      if (err) {
        console.log('[/private/oicp/subscription] Error', err.message);
        return res.status(500).send(err.message);
      } else console.log('[/private/oicp/subscription] Result', result);
    });
  },
);

app.use('/api/private/otherEvs', (req, res) => {
  const evsServiceProxy = httpProxy('http://evs:3006/', {
    forwardPath: () => `http://evs:3006${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/otherEvs] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://evs:3006${req.originalUrl}`);
  evsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/otherEvs] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/otherEvs] Result', result);
  });
});

app.use('/api/private/cdrs/runFirstTime', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () => `http://ocpi-22:3019${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/cdrs/runFirstTime] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ocpi-22:3019${req.originalUrl}`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/cdrs/runFirstTime] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/cdrs/runFirstTime] Result', result);
  });
});

app.use('/api/private/ocpiCache', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () => `http://ocpi-22:3019${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/cdrs/runFirstTime] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ocpi-22:3019${req.originalUrl}`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/cdrs/runFirstTime] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/cdrs/runFirstTime] Result', result);
  });
});

app.use('/api/private/ocpi/statistics/runFirstTime', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () =>
      `http://ocpi-22:3019/api/private/statistics/runFirstTime`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log(
            '[/api/private/statistics/runFirstTime] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ocpi-22:3019/api/private/statistics/runFirstTime`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/statistics/runFirstTime] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/statistics/runFirstTime] Result', result);
  });
});

app.use('/api/private/ocpi/chargingSession/runFirstTime', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () =>
      `http://ocpi-22:3019/api/private/chargingSession/runFirstTime`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
          console.log(
            '[/api/private/statistics/runFirstTime] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });
  console.log(`http://ocpi-22:3019/api/private/chargingSession/runFirstTime`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/ocpi/chargingSession/runFirstTime] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/ocpi/chargingSession/runFirstTime] Result',
        result,
      );
  });
});

app.use('/api/private/ocpi/chargingSession/newRunFirstTime', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () =>
      `http://ocpi-22:3019/api/private/chargingSession/newRunFirstTime`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
          console.log(
            '[/api/private/statistics/runFirstTime] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });
  console.log(
    `http://ocpi-22:3019/api/private/chargingSession/newRunFirstTime`,
  );
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/ocpi/chargingSession/runFirstTime] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/ocpi/chargingSession/runFirstTime] Result',
        result,
      );
  });
});

app.use('/api/private/ocpi/reports', (req, res) => {
  const bookingServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: (req) => `http://ocpi-22:3019${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  bookingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/payments] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/payments] Result', result);
  });
});

app.use('/api/public/ocpi/cpoTariffsPrices', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () =>
      `http://ocpi-22:3019/api/private/tariffs/opcTariffsPrices`,

    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log(
            '[/api/private/tariffs/opcTariffsPrices] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ocpi-22:3019/api/private/tariffs/opcTariffsPrices`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/ocpi/chargingSession/runFirstTime] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log(
        '[/api/private/ocpi/chargingSession/runFirstTime] Result',
        result,
      );
  });
});

app.use('/api/private/notifyUsersByMail', (req, res) => {
  const firebaseProxy = httpProxy('http://notifications:3008/', {
    forwardPath: (req) => `http://notifications:3008${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/notifyUsersByMail] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://notifications:3008${req.originalUrl}`);
  firebaseProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/notifyUsersByMail] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/notifyUsersByMail] Result', result);
  });
});

/*
app.use('/api/private/ocpi/chargingSession/runFirstTime', (req, res) => {
    const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
        forwardPath: () => `http://ocpi-22:3019/api/private/chargingSession/runFirstTime`,
        proxyErrorHandler: (err, res, next) => {
            switch (err && err.code) {
                default: {

                    let updateLog = {
                        responseDate: Date.now(),
                        responseBody: err.message,
                        responseCode: '500'
                    };
                    updateResponseLogs(req.headers['reqID'], updateLog);
                    console.log("[/api/private/statistics/runFirstTime] Error", err.message);
                    next(err);
                }
            }
        },
        skipToNextHandlerFilter: (proxyRes) => {
            return new Promise(function (resolve, reject) {
                if (proxyRes.statusCode === 304) {

                    let updateLog = {
                        responseDate: Date.now(),
                        responseBody: 'Updated failed',
                        responseCode: '304'
                    };
                    updateResponseLogs(req.headers['reqID'], updateLog);
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
                    responseBody: proxyResData.toString('utf8'),
                    responseCode: proxyRes.statusCode
                };
                updateResponseLogs(req.headers['reqID'], updateLog);
                resolve(proxyResData);
            });
        }
    });

});
*/

app.use('/api/private/billing', (req, res) => {
  const billingServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/billing] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  billingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/billing] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/billing] Result', result);
  });
});
//});

app.use('/api/private/roamingPlanTariff', (req, res) => {
  const publicTariffsServiceProxy = httpProxy('http://public-tariffs:3027/', {
    forwardPath: () => `http://public-tariffs:3027${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/roamingPlanTariff] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://public-tariffs:3027${req.originalUrl}`);
  publicTariffsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/roamingPlanTariff] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/roamingPlanTariff] Result', result);
  });
});

app.use('/api/private/purchaseTariff', (req, res) => {
  const groupsServiceProxy = httpProxy('http://tariffs:3009/', {
    forwardPath: (req) => `http://tariffs:3009${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/purchaseTariff] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseBody: 'Updated failed',
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
          responseBody: proxyResData.toString('utf8'),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://tariffs:3009${req.originalUrl}`);
  groupsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/purchaseTariff] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/purchaseTariff] Result', result);
  });
});

app.use('/api/private/createGireveBillingDocument', (req, res) => {
  const billingServiceProxy = httpProxy('http://billing:3030/', {
    forwardPath: () => `http://billing:3030${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://billing:3030${req.originalUrl}`);
  billingServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(
        '[/api/private/createGireveBillingDocument] Error',
        err.message,
      );
      return res.status(500).send(err.message);
    } else
      console.log('[/api/private/createGireveBillingDocument] Result', result);
  });
});

app.use('/api/private/plafond', (req, res) => {
  const paymentsServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  paymentsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/plafond] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/plafond] Result', result);
  });
});

app.use('/api/private/paymentPeriods', (req, res) => {
  const paymentsServiceProxy = httpProxy('http://payments:3017/', {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/paymentPeriods] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://payments:3017${req.originalUrl}`);
  paymentsServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/paymentPeriods] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/paymentPeriods] Result', result);
  });
});

app.use('/api/private/controlcenter', (req, res) => {
  const controlCenterProxy = httpProxy('http://control-center:3040/', {
    forwardPath: (req) => `http://control-center:3040${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/controlcenter] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://control-center:3040${req.originalUrl}`);
  controlCenterProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/controlcenter] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/controlcenter] Result', result);
  });
});

app.use('/api/private/controlcenter/charger/systemLog/filters', (req, res) => {
  const connectionStationServiceProxy = httpProxy(
    'http://control_center:3040',
    {
      forwardPath: (req) => {
        const queryString = req.url.split('?')[1];
        return (
          '/api/private/controlcenter/charger/systemLog/filters' +
          (queryString ? '?' + queryString : '')
        );
      },
    },
  );

  connectionStationServiceProxy(req, res, (err) => {
    if (err) {
      console.error(
        '[/api/private/controlcenter/charger/systemLog/filters] Error:',
        err,
      );
      return res.status(500).send(err.message);
    }
    console.log(
      '[/api/private/controlcenter/charger/systemLog/filters] Result',
      res,
    );
  });
});

app.use('/api/private/scSibsCards', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/scSibsCards] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/scSibsCards] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/scSibsCards] Result', result);
  });
});

app.use('/api/private/hySibsCards', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/hySibsCards] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/hySibsCards] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/hySibsCards] Result', result);
  });
});

app.use('/api/private/scCetelemCards', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/scSibsCards] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/scCetelemCards] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/scCetelemCards] Result', result);
  });
});

app.use('/api/private/toProcessCards', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/private/toProcessCards] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/toProcessCards] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/toProcessCards] Result', result);
  });
});

app.use('/api/public/ocpi/detailedTariffs', (req, res) => {
  const ocpiServiceProxy = httpProxy('http://ocpi-22:3019/', {
    forwardPath: () =>
      `http://ocpi-22:3019/api/private/tariffs/detailedTariffs`,

    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log(
            '[/api/private/tariffs/detailedTariffs] Error',
            err.message,
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://ocpi-22:3019/api/private/tariffs/detailedTariffs`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/tariffs/detailedTariffs] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/tariffs/detailedTariffs] Result', result);
  });
});

app.use('/ocpi/cpo/', (req, res) => {
  const controlCenterProxy = httpProxy('http://control-center:3040/', {
    forwardPath: (req) => `http://control-center:3040${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/ocpi/cpo/] Error', err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          let updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://control-center:3040${req.originalUrl}`);
  controlCenterProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/ocpi/cpo/] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/ocpi/cpo/] Result', result);
  });
});

app.use('/api/private/countryKeyboard', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);

          console.log('[/api/authenticate] Error', err.message);
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
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
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
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log('[/api/private/countryKeyboard] Error', err.message);
      return res.status(500).send(err.message);
    } else console.log('[/api/private/countryKeyboard] Result', result);
  });
});

app.use('/api/private/rules', (req, res) => {
  const identityServiceProxy = httpProxy('http://identity:3003/', {
    forwardPath: () => `http://identity:3003${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: '500',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
          console.log(`[${req.originalUrl}] Error`, err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: '304',
          };
          updateResponseLogs(req.headers['reqID'], updateLog);
          resolve();
        }
        resolve();
      });
    },
    userResDecorator: function (proxyRes, proxyResData) {
      return new Promise(function (resolve) {
        let updateLog = {
          responseDate: Date.now(),
          responseCode: proxyRes.statusCode,
        };
        updateResponseLogs(req.headers['reqID'], updateLog);
        resolve(proxyResData);
      });
    },
  });

  console.log(`http://identity:3003${req.originalUrl}`);
  identityServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`[${req.originalUrl}] Error`, err.message);
      return res.status(500).send(err.message);
    }
    console.log(`[${req.originalUrl}] Result`, result);
  });
});

// TODO: move this to new API Gateway when it's ready
app.use("/api/private/v2/charger/command/:hwId/:action/:actionParameter", (req, res) => {
  proxyToEvioPlatform(req, res);
});

app.use("/api/private/v2/charger/command/:hwId/:action", (req, res) => {
  proxyToEvioPlatform(req, res);
});

function proxyToEvioPlatform(req, res) {
  const evioPlatformServiceProxy = httpProxy("http://evio-platform:3100/", {
    forwardPath: () => `http://evio-platform:3100${req.originalUrl.replace("/api/private", "")}`,
    proxyErrorHandler: (err, res, next) => {
      const updateLog = {
        responseDate: Date.now(),
        responseCode: "500",
      };
      updateResponseLogs(req.headers["reqID"], updateLog);
      console.log(`[${req.originalUrl}] Error`, err.message);
      next(err);
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve) {
        if (proxyRes.statusCode === 304) {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
        }
        resolve();
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

  evioPlatformServiceProxy(req, res);
}


// TODO: move this to new API Gateway when it's ready, this is temporary for now
app.use("/api/private/platform", (req, res) => {
  const evioPlatformServiceProxy = httpProxy("http://charging-platform:3101/", {
    forwardPath: () => `http://charging-platform:3101${req.originalUrl.replace("/api/private/platform", "")}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          console.log(`[${req.originalUrl}] Error`, err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        }
        resolve();
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

  console.log(`http://charging-platform:3101${req.originalUrl}`);
  evioPlatformServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`[${req.originalUrl}] Error`, err.message);
      return res.status(500).send(err.message);
    }
    console.log(`[${req.originalUrl}] Result`, result);
  });
});

app.use("/api/lusoPay/notificationsMBWay", (req, res) => {
  const paymentServiceProxy = httpProxy("http://payments:3017/", {
    forwardPath: (req) => `http://payments:3017${req.originalUrl}`,
    proxyErrorHandler: async (err, res, next)  => {
      switch (err && err.code) {
        default: {
          const payload = {...req.query, ip: req.ip}
          await sendMessage({ method: 'notificationsMBWay', payload }, 'payments_key');
          console.log("[/api/lusoPay/notificationsMBWay] Error", err.message);
          return res.status(200).send();
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

  console.log(`http://payments:3017${req.originalUrl}`);
  paymentServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log("[/api/private/paymentsLusoPay] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/api/private/paymentsLusoPay] Result", result);
  });
});

// TODO: move this to new API Gateway when it's ready, this is temporary for now
app.use("/api/private/v2/assets", (req, res) => {
  const evioPlatformServiceProxy = httpProxy("http://assets:3103/", {
    forwardPath: () => `http://assets:3103${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          console.log(`[${req.originalUrl}] Error`, err.message);
          next(err);
        }
      }
    },
    skipToNextHandlerFilter: (proxyRes) => {
      return new Promise(function (resolve, reject) {
        if (proxyRes.statusCode === 304) {
          const updateLog = {
            responseDate: Date.now(),
            responseCode: "304",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          resolve();
        }
        resolve();
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

  console.log(`http://assets:3103${req.originalUrl}`);
  evioPlatformServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`[${req.originalUrl}] Error`, err.message);
      return res.status(500).send(err.message);
    }
    console.log(`[${req.originalUrl}] Result`, result);
  });
});

app.use("/api/private/configs/coordinates-config", (req, res) => {
  const configServiceProxy = httpProxy("http://configs:3028/", {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);
          console.log(`[${req.originalUrl}] Error`, err.message);
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
  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`[${req.originalUrl}] Error`, err.message);
      return res.status(500).send(err.message);
    } else console.log(`[${req.originalUrl}] Result`, result);
  });
});

app.use([
  "/api/private/configs/validation-cdr-config",
  "/api/private/country-code-by-name/:countryName",
  "/api/private/country-code/:country",
  "/api/private/countries",
  "/api/private/configs/charger-preauthorization",
], (req, res) => {
  const configServiceProxy = httpProxy("http://configs:3028/", {
    forwardPath: (req) => `http://configs:3028${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log(`[${req.originalUrl}] Error`, err.message);
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

  console.log(`http://configs:3028${req.originalUrl}`);
  configServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`[${req.originalUrl}] Error`, err.message);
      return res.status(500).send(err.message);
    } else console.log(`[${req.originalUrl}] Result`, result);
  });
});

app.use("/api/private/ocpi/sessions/v2/status", (req, res) => {
  const ocpiServiceProxy = httpProxy("http://ocpi-22:3019/", {
    forwardPath: () =>
      `http://ocpi-22:3019${req.originalUrl}`,
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        default: {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: err.message,
            responseCode: "500",
          };
          updateResponseLogs(req.headers["reqID"], updateLog);

          console.log(`[${req.originalUrl}] Error`, err.message);
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

  console.log(`http://ocpi-22:3019${req.originalUrl}`);
  ocpiServiceProxy(req, res, (err, result) => {
    if (err) {
      console.log(`[${req.originalUrl}] Error`, err.message);
      return res.status(500).send(err.message);
    } else console.log(`[${req.originalUrl}] Result`, result);
  });
});

app.use("/credit-notes", (req, res) => {
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

          console.log("[/credit-notes] Error", err.message);
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
      console.log("[/credit-notes] Error", err.message);
      return res.status(500).send(err.message);
    } else console.log("[/credit-notes] Result", result);
  });
});

app.get("/", (req, res) => {
  res.send("Initializing API Gateway!");
});

app.get('/api/private/healthCheck', (req, res) => {
  return res.status(200).send('OK');
});

function saveAPIKey(clientType, clientName, validate, apikey) {
  let context = 'Funciton addAPIKey';
  return new Promise((resolve, reject) => {
    let host = process.env.ConfigsHost + process.env.PathConfigSaveAPIKey;
    let data = {
      apiKey: apikey,
      validateDate: validate,
      clientType: clientType,
      clientName: clientName,
    };

    axios
      .post(host, data)
      .then(() => {
        resolve();
      })
      .catch((err) => {
        console.log(`[${context}]Error `, err.message);
        reject(err);
      });
  });
}

var server = http.createServer(app);

server.listen(port, () => {
  console.log(`Running on port ${port}`);
});
