const express = require('express');
const router = express.Router();
const httpProxy = require('express-http-proxy');
const RequestHistory = require('../models/requestHistory');
const jwt = require('jsonwebtoken');
const UUID = require('uuid-js');
require("dotenv-safe").load();

//========== FUNCTIONS ==========

router.use(hasValidApiToken);

router.use('/', (req, res) => {
    const chargersServiceProxy = httpProxy('http://chargers:3002/', {
        forwardPath: req => `http://chargers:3002${req.originalUrl}`,
        proxyErrorHandler: (err, res, next) => {
            switch (err && err.code) {
                default: {

                    let updateLog = {
                        responseDate: Date.now(),
                        //responseBody: err.message,
                        responseCode: '500'
                    };
                    updateResponseLogs(req.headers['reqID'], updateLog);

                    console.log("[/locations] Error", err.message);
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
                    //responseBody: proxyResData.toString('utf8'),
                    responseCode: proxyRes.statusCode
                };
                updateResponseLogs(req.headers['reqID'], updateLog);
                resolve(proxyResData);
            });
        }
    });

    console.log(`http://chargers:3002${req.originalUrl}`);
    chargersServiceProxy(req, res, (err, result) => {
        if (err) {
            console.log("[/locations] Error", err.message);
            return res.status(500).send(err.message);
        }
        else
            console.log("[/locations] Result", result);
    });

});

function hasValidApiToken(req, res, next) {
    var context = "Function hasValidApiToken";
    try {
        console.log("Function hasValidApiToken openChargeMaps")
        let data = req.body;

        let apikey = req.headers['apikey'];
        var mobileBrand = req.headers['mobilebrand'];
        var mobileModel = req.headers['mobilemodel'];
        var mobileVersion = req.headers['mobileversion'];
        var evioAppVersion = req.headers['evioappversion'];

        if (apikey) {

            jwt.verify(apikey, process.env.TOKEN_SECRET, function (err, decoded) {
                if (err) {
                    console.log(`[${context} jwt verify] Error `, err.message);
                    return res.status(400).send({ auth: false, token: "", refreshToken: "", message: 'Failed to authenticate token.' + err });
                }
                else {
                    if (decoded.clientType !== 'OPEN_CHARGE_MAPS_WEB') {
                        return res.status(400).send({ auth: false,  message: 'Failed to authenticate token. API Key not valid.' });
                    } else {
                        var requestHistory = new RequestHistory();
                        var uuid4 = UUID.create();
                        req.headers['client'] = decoded.clientType;
                        requestHistory.clientType = decoded.clientType;
                        requestHistory.requestDate = new Date();
                        requestHistory.clientName = decoded.clientName;
                        requestHistory.mobileBrand = mobileBrand;
                        requestHistory.mobileModel = mobileModel;
                        requestHistory.mobileVersion = mobileVersion;
                        requestHistory.evioAppVersion = evioAppVersion;
                        requestHistory.data = data;
                        requestHistory.path = req.originalUrl;
                        requestHistory.reqID = uuid4.hex;
                        requestHistory.method = req.method;
                        req.headers['reqID'] = uuid4.hex;

                        RequestHistory.createRequestHistory(requestHistory, (err, result) => {
                            if (err) {
                                console.log(`[${context} createRequestHistory] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    next();
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_history_not_save', message: "Request history dont save" });
                                };
                            };
                        });   
                    }
                };

            });
        }
        else {
            
            return res.status(401).send({ auth: false, code: 'server_general_error', message: 'No apikey provided.' });
        };

    } catch (error) {
        console.log(`Catch [${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
};


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

};
module.exports = router;