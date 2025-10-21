require("dotenv-safe").load();
const http = require('http');
const express = require('express')
const app = express()
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const axios = require("axios");
const Filter = require('./models/filters');
const request = require('request');
const moment = require('moment');
const morgan = require('morgan');
const WLKeysMapping = require('./utils/WLKeysMapping.json');
const DataPlugStatusChanger = require('./models/dataPlugStatusChange')
const { getCode } = require('country-list');
const {
    handleChargerRequest,
    handleSupportChargerRequest,
    handleRankingsRequest,
    handleCompareRequest,
    handleMapRequest
  } = require("./handlers/chargersHandlers");
const {mapChargerSummary, mapChargerDetails} = require('./mappers/chargersMapper');
const { calcTotalCost, queryCreation, getChargerOffset } = require('./utils/utils');
const { getDetailsPublicNetWork, connectChargerType } = require('./services/publicNetworkService');
const { getPrivateDetailsEVIONetWork } = require('./services/chargerService');
const { getEVByEvId } = require("./apis/ev");
const { getOpcTariffsPrices } = require('./services/ocpiService');
const timeZoneMoment = require("moment-timezone");
const NodeCache = require("node-cache");
const toggle = require('evio-toggle').default;
const { SessionsService } = require("evio-library-ocpi");

const ConfigsService = require('./services/configsService');

const mobieScheduleTime = require("./models/schedulesCEME.json");
const Constants = require('./utils/constants');

const Sentry = require("@sentry/node");

const { findGroupDriversOthersEVS } = require('evio-library-identity').default;
const { findEVSLandingPage } = require('evio-library-evs').default;
const { retrieveWalletByUserId, calculateUserDebt } = require('evio-library-payments').default;
const { Enums, ErrorHandlerCommon  } = require('evio-library-commons').default;
const { StatusCodeHttp } = Enums;

const { FileTransaction } = require('evio-library-language');
const { handleSessionAction } = require('./handlers/session-handler');

const customOutput = (err=false)=>(...args) => {
    const formattedArgs = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    if (err){
        process.stderr.write(`${formattedArgs}\n`);
        return;
    }
    process.stdout.write(`${formattedArgs}\n`);
};
console.log=customOutput();
console.info=customOutput();
console.warn=customOutput();
console.error=customOutput(true);

if (Constants.environment !== 'development') {
    // eslint-disable-next-line global-require
    require('./middlewares/sentry')(app);
}

const { registerMetric } = require('./services/sentryMetric');

const myCache = new NodeCache({
    stdTTL: 500, // the standard ttl as number in seconds for every generated cache element.
    checkperiod: 300, // The period in seconds, as a number, check all elements and delete the expired ones.
    useClones: false, // if true you'll get a copy of the cached variable. If false you'll save and get just the reference.
});

console.log("Environment", process.env.NODE_ENV);
const port = process.env.NODE_ENV === 'production' ? process.env.PORT : process.env.PORT_DEV;

switch (process.env.NODE_ENV) {
    case 'production':
        console.log("Initing production environment")
        break;
    case 'development':
        console.log("Initing dev environment")
        break;
    case 'pre-production':
        console.log("Initing pre environment")
        break;
    default:
        console.log("Unknown environment")
        break;
}

const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// const { PromiseProvider } = require('mongoose');
// const { param } = require('./routines/chargingSessionMonitoring');
// const { getMaxListeners } = require('./models/filters');
// const { Console } = require('console');
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true
};

connectionDB()
async function connectionDB() {
    const connString = String(process.env.DB_URI).replace('{database}', 'connectionStationDB');
    await mongoose.connect(connString, options)
        .then(connection => {
            console.log(`Connected to ${connection.connections[0].name}`);
        })
        .catch(err => {
            console.log(err)
        })
};


morgan.token('req-body', req => JSON.stringify(req.body) || '{}');
morgan.token('res-size', (req, res) => res.get('Content-Length') || '0');
morgan.token('req-headers', req => JSON.stringify(req.headers));
app.use(
  morgan((tokens, req, res) => {
    const status = tokens.status(req, res);
    const responseTime = tokens['response-time'](req, res);
    const log = {
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: status ? parseInt(status, 10) : 0,
      responseTime: responseTime ? parseFloat(responseTime) : 1,
      reqHeaders: JSON.parse(tokens['req-headers'](req)),
      reqBody: JSON.parse(tokens['req-body'](req)),
      resSize: `${tokens['res-size'](req, res)} bytes`,
      logType: 'httpRequest',
    };
    return JSON.stringify(log);
  })
);

app.use(bodyParser.json({ limit: '1000kb' }))
app.use(bodyParser.urlencoded({ extended: true, limit: '1000kb' }));
app.use(cors());

app.use(helmet());
app.use(express.json({ limit: '1000kb' }));
app.use(express.urlencoded({ extended: false, limit: '1000kb' }));
app.use(cookieParser());

app.use(require('./routines/chargingSessionMonitoring'));
app.use(require('./routes/monthlyBilling'));
app.use(require('./routes/periodBilling'));
app.use(require('./routes/periodPayments'));
app.use(require('./routes/dataPlugStatusChange'));

app.get('/', (req, res) => {
    res.send('Connection Station initialized!');
});

// var jsonData = require('./chargersType.json');

//========== POST ==========

app.post('/api/private/connectionstation/chargerSummary', async (req, res) => {
    return handleChargerRequest(mapChargerSummary, req, res);
});

app.post('/api/private/connectionstation/chargerDetailsV2', async (req, res) => {
    return handleChargerRequest(mapChargerDetails, req, res);
});

app.post('/api/public/connectionstation/chargerSummary', async (req, res) => {
    return handleChargerRequest(mapChargerSummary, req, res);
});

app.post('/api/public/connectionstation/chargerDetailsV2', async (req, res) => {
    return handleChargerRequest(mapChargerDetails, req, res);
});

app.post('/api/private/connectionstation', async (req, res) => handleSessionAction(req, res, false));
app.post('/api/private/v2/connectionstation', async (req, res) => handleSessionAction(req, res, true));


app.post('/api/public/connectionstation/maps', (req, res) => handleMapRequest(req, res));

app.post('/api/private/connectionstation/rankings', (req, res) => handleRankingsRequest(req, res, myCache));

app.post('/api/private/connectionstation/compare', (req, res) => handleCompareRequest(req, res, myCache));

//Post to get connection to a private chargers (When user have login)

app.post('/api/private/connectionstation/chargers', async (req, res, next) => {
    const context = "POST /api/private/connectionstation/chargers";
    try {
        console.log(`Start of ${context}`)

        let host = process.env.ChargersServiceProxy + process.env.ChargerPrivateServiceProxy;
        let publicHost = process.env.PublicChargersHost + process.env.PublicGetChargerPathPrivate;
        let params = req.query;
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];

        if (params.countryCode == undefined || params.countryCode.length == 0) {
            params.countryCode = ["PT", "ES"];
        };

        let data = {};
        let dataPublic = {};

        if (Object.keys(req.body).length == 0) {
            data = req.body;
            await getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId);
        } else {
            let filter = new Filter(req.body);

            //console.log("filter.stations.length ", filter)

            let tariffType;
            if (filter.tariffType) {
                console.log("filter.stations.length ", filter.tariffType)
                tariffType = filter.tariffType;
            };

            if (filter.stations.length === 0) {
                data = await queryCreation(filter);
                dataPublic = await queryCreation(filter);

                // console.log("data", data)
                // console.log("dataPublic", dataPublic)

                if (dataPublic.rating != undefined) {
                    delete dataPublic.rating;
                };
                if (dataPublic.vehiclesType != undefined) {
                    delete dataPublic.vehiclesType;
                };

                data.tariffType = tariffType ? tariffType : ""
                dataPublic.tariffType = tariffType ? tariffType : ""

                await getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter);
            } else {

                //let result = await verifyStations(filter, userId);

                data = await queryCreation(filter);
                dataPublic = await queryCreation(filter);

                data.stations = filter.stations;
                dataPublic.stations = filter.stations;

                if (tariffType) {
                    data.tariffType = tariffType;
                    dataPublic.tariffType = tariffType;
                }

                console.log("data 1 ", data);
                console.log("dataPublic 1 ", dataPublic);

                if (dataPublic.rating != undefined) {
                    delete dataPublic.rating;
                };
                if (dataPublic.vehiclesType != undefined) {
                    delete dataPublic.vehiclesType;
                };

                await getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter);

            };
        };

    } catch (error) {
        if (error.auth === false) {

            return res.status(400).send(error);

        } else {

            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);

        };
    };
});
app.post('/api/private/connectionstation/maps', (req, res) => handleMapRequest(req, res));

//Post to get connection all chargers operations management (When user not have login)
app.post('/api/public/connectionstation/opManagement', async (req, res, next) => {
    var context = "POST /api/public/connectionstation/opManagement";
    try {

        var host = process.env.ChargersServiceProxy + process.env.ChargerPublicOPM;
        var publicHost = process.env.PublicChargersHost + process.env.PublicGetChargerPath;

        var params = req.query;
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];

        if (params.countryCode == undefined || params.countryCode.length == 0) {
            params.countryCode = ["PT", "ES"];
        };
        var data = {};
        var dataPublic = {};

        if (Object.keys(req.body).length == 0) {
            data = req.body;
            getAllChargers(host, publicHost, params, data, dataPublic, res, clientName);
        }
        else {
            var filter = new Filter(req.body);
            if (filter.stations.length === 0) {
                let data = queryCreation(filter);
                let dataPublic = queryCreation(filter);

                if (dataPublic.rating != undefined) {
                    delete dataPublic.rating;
                };
                if (dataPublic.vehiclesType != undefined) {
                    delete dataPublic.vehiclesType;
                };

                getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter);
            }
            else {
                var result = verifyStations(filter, userId, clientName);
                data = result.data;
                dataPublic = result.dataPublic;

                if (dataPublic.rating != undefined) {
                    delete dataPublic.rating;
                };
                if (dataPublic.vehiclesType != undefined) {
                    delete dataPublic.vehiclesType;
                };

                if (result.type === process.env.StationsEVIO)
                    getEvioChargers(host, params, data, res, userId, filter, clientName);
                else if (result.type === process.env.StationsPublic || result.type === process.env.StationsTesla)
                    getPublicChargers(publicHost, params, dataPublic, res, clientName, userId, filter);
                else
                    getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter);
            };
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Post to get connection all chargers operations management (When user have login)
app.post('/api/private/connectionstation/opManagement', async (req, res, next) => {
    var context = "POST /api/private/connectionstation/opManagement";
    try {

        var host = process.env.ChargersServiceProxy + process.env.ChargersPrivateOPM;
        var publicHost = process.env.PublicChargersHost + process.env.PublicGetChargerPathPrivate;
        var params = req.query;
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];

        if (params.countryCode == undefined || params.countryCode.length == 0) {
            params.countryCode = ["PT", "ES"];
        };
        var data = {};
        var dataPublic = {};

        if (Object.keys(req.body).length == 0) {
            data = req.body;
            getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId);
        }
        else {
            var filter = new Filter(req.body);

            if (filter.stations.length === 0) {
                let data =  queryCreation(filter);
                let dataPublic =  queryCreation(filter);

                if (dataPublic.rating != undefined) {
                    delete dataPublic.rating;
                };
                if (dataPublic.vehiclesType != undefined) {
                    delete dataPublic.vehiclesType;
                };

                getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter);
            }
            else {

                var result = verifyStations(filter, userId, clientName);
                data = result.data;
                dataPublic = result.dataPublic;

                if (dataPublic.rating != undefined) {
                    delete dataPublic.rating;
                };
                if (dataPublic.vehiclesType != undefined) {
                    delete dataPublic.vehiclesType;
                };

                if (result.type === process.env.StationsEVIO)
                    getEvioChargers(host, params, data, res, userId, filter, clientName);
                else if (result.type === process.env.StationsPublic || result.type === process.env.StationsTesla)
                    getPublicChargers(publicHost, params, dataPublic, res, clientName, userId, filter);
                else
                    getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter);
            };
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Post to create a host issue
app.post('/api/private/connectionstation/hostIssues', (req, res, next) => {
    var context = "POST /api/private/connectionstation/hostIssues";
    try {

        var userId = req.headers['userid'];
        var hostIssue = req.body;

        var publicNetworkChargerType = process.env.PublicNetworkChargerType;

        publicNetworkChargerType = publicNetworkChargerType.split(',');

        var found = publicNetworkChargerType.find(type => {
            return type === hostIssue.chargerType;
        });

        if (found) {
            //TODO
            //Call endpoit MobiE
            return res.status(400).send({ auth: false, code: 'server_chargerType_not_supported', message: "Charger type not supported" });
        }
        else {
            hostIssuesEVIO(hostIssue, userId)
                .then((result) => {
                    return res.status(200).send(result);
                })
                .catch((error) => {
                    if (error.response) {
                        return res.status(400).send(error.response.data);
                    }
                    else {
                        console.log(`[${context}] Error `, error.message);
                        return res.status(500).send(error);
                    };
                });

        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

app.post('/api/private/connectionstation/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/connectionstation/runFirstTime";
    try {
        /*
        addEVOwnerToSession()
            .then((result) => {
                return res.status(200).send("OK");
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            })
        */
        updateAddressModel();

        return res.status(200).send("ok");
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

app.post('/api/private/connectionstation/monthlyBilling', async (req, res, next) => {
    let context = "POST /api/private/connectionstation/monthlyBilling";
    try {

        let data = req.body;

        validateBillingProfile(data.userId)
            .then(async (result) => {
                if (result) {
                    let sessionsEVIO = await monthlyBillingEVIO(data);
                    let sessionsOCPI = await monthlyBillingOCPI(data);
                    //let sessionsEVIO = null;
                    //let sessionsOCPI = null;

                    //console.log("sessionsEVIO",sessionsEVIO);
                    //console.log("sessionsOCPI",sessionsOCPI);

                    let body;
                    let sessionsIds;
                    let invoiceEVIO;
                    let finalInvoice;
                    let totalPrice;

                    if (sessionsEVIO && sessionsOCPI) {

                        //console.log("sessionsOCPI", sessionsOCPI);
                        body = sessionsOCPI.body;
                        sessionsIds = sessionsEVIO.sessionsId.concat(sessionsOCPI.sessionIds);

                        invoiceEVIO = await drawInvoiceEVIO(sessionsEVIO, data.userId);

                        finalInvoice = await joinInvoiceEVIOOCPI(body, invoiceEVIO);

                        totalPrice = finalInvoice.attach.overview.footer;

                        //console.log("finalInvoice", finalInvoice.attach.overview.footer);

                    } else if (sessionsEVIO) {

                        sessionsIds = sessionsEVIO.sessionsId;

                        finalInvoice = await drawInvoiceEVIO(sessionsEVIO, data.userId);

                        finalInvoice.invoice.lines = await adjustLines(finalInvoice.invoice.lines);

                        totalPrice = finalInvoice.attach.overview.footer;


                    } else if (sessionsOCPI) {

                        sessionsIds = sessionsOCPI.sessionIds;

                        finalInvoice = sessionsOCPI.body;

                        finalInvoice.invoice.lines = await adjustLines(finalInvoice.invoice.lines);

                        totalPrice = finalInvoice.attach.overview.footer;

                    } else {

                        return res.status(400).send({ auth: false, code: 'server_no_sessions', message: 'No sessions to bill' });

                    };

                    makePaymentMonthly(totalPrice, data.userId, sessionsIds)
                        .then((paymentMonthly) => {


                            finalInvoice.invoice.paymentId = paymentMonthly._id;

                            sendToBilling(finalInvoice, data.userId, sessionsIds, data)
                                .then((response) => {

                                    return res.status(200).send(finalInvoice);

                                })
                                .catch((error) => {

                                    if (error.response) {

                                        console.log(`[${context}][sendToBilling] Error `, error.response.data.message);
                                        return res.status(400).send(error.response.data);

                                    }
                                    else {

                                        console.log(`[${context}][sendToBilling] Error `, error.message);
                                        return res.status(500).send(error.message);

                                    };

                                });

                        })
                        .catch((error) => {
                            console.log(`[${context}][makePaymentMonthly] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                } else {

                    //messageResponse = { auth: false, code: 'server_billingProfile_required', message: 'Billing Profile is required', redirect: "billing" };

                    res.status(400).send({ auth: false, code: 'server_billingProfile_required', message: 'Billing Profile is required', redirect: "billing" });
                    return res;

                };
            })
            .catch((error) => {
                console.log(`[${context}][validateBillingProfile] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
app.get('/api/private/healthCheck', (req, res) => {
    return res.status(200).send('OK');
});

app.options('/api/private/proxy', (req, res) =>
    res.status(200).send("Feel free to send the real request now :)")
);

app.get('/api/private/proxy', (req, res) => {
    var context = "GET /api/private/proxy";
    try {
        var received = req.query;

        switch (received.type) {
            case process.env.MAPBOX:
                var host = received.url + `&access_token=${process.env.MAPBOX_TOKEN}`;
                getProxy(host, res);
                break;
            case process.env.MAPGOOGLE:
                var host = received.url + `&key=${process.env.MAPS_APIKEY}`;
                getProxy(host, res);
                break;
            default:
                return res.status(400).send({ auth: false, code: 'server_action_not_supported', message: 'Action not supported' });
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get charger details (EVIO or MobiE) (When user not have login)
app.get('/api/public/connectionstation/chargerDetails', (req, res) => {
    var context = "GET /api/public/connectionstation/chargerDetails";
    try {
        var query = req.query;

        if (!query.chargerType) {
            return res.status(400).send({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });
        };

        if (!query._id) {

            return res.status(400).send({ auth: false, code: "server_id_required", message: "Id is required" });
        };

        var publicNetworkChargerType = process.env.PublicNetworkChargerType;

        publicNetworkChargerType = publicNetworkChargerType.split(',');

        var found = publicNetworkChargerType.find(type => {
            return type === query.chargerType;
        });

        if (found/*query.chargerType === process.env.OCMCharger || query.chargerType === process.env.MobieCharger || query.chargerType === process.env.TeslaCharger*/) {
            getDetailsPublicNetWork(query, req.headers)
                .then((chargerFound) => {
                    return res.status(200).send(chargerFound);
                })
                .catch((error) => {
                    if (error.auth != undefined) {
                        return res.status(400).send(error);
                    }
                    else {
                        console.log(`[${context}][getChargerDetailsPublicNetWork] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });
        }
        else {
             getPublicDetailsEVIONetWork(query, req.headers)
                .then((chargerFound) => {
                    return res.status(200).send(chargerFound);
                })
                .catch((error) => {
                    if (error.auth != undefined) {
                        return res.status(400).send(error);
                    }
                    else {
                        console.log(`[${context}][getChargerDetailsEVIONetWork] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });
        };


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get charger details (EVIO or MobiE) (When user have login)
app.get('/api/private/connectionstation/chargerDetails', async (req, res) => {
    var context = "GET /api/private/connectionstation/chargerDetails";
    try {

        var query = req.query;

        if (!query.chargerType) {
            return res.status(400).send({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });
        };

        if (!query._id) {
            return res.status(400).send({ auth: false, code: "server_id_required", message: "Id is required" });
        };

        var publicNetworkChargerType = process.env.PublicNetworkChargerType;

        publicNetworkChargerType = publicNetworkChargerType.split(',');

        var found = publicNetworkChargerType.find(type => {
            return type === query.chargerType;
        });

        const featureFlagUserDeletionStatusEnabled = await toggle.isEnable('connection_station_user_deletion_status');

        let userDeletionStatus = null;
        if (featureFlagUserDeletionStatusEnabled) {
            const [user, debtValue] = await Promise.all([
                getUserAccount(req.headers.userid),
                calculateUserDebt(req.headers.userid)
            ]);

            if (!user) {
                return res.status(404).json({
                    auth: false,
                    code: "server_user_not_found",
                    message: "User not found"
                });
            }

            userDeletionStatus = {
                accountDeletionRequested: user.accountDeletionRequested,
                blocked: user.blocked || false,
                ...(debtValue?.value > 0 && {
                    debtValue: {
                        value: debtValue.value,
                        currency: debtValue.currency
                    }
                })
            };
        }

        if (found/*query.chargerType === process.env.OCMCharger || query.chargerType === process.env.MobieCharger || query.chargerType === process.env.TeslaCharger*/) {
            getDetailsPublicNetWork(query, req.headers)
                .then((chargerFound) => {
                    return res.status(200).send({
                        ...chargerFound,
                        userDeletionStatus
                    });
                })
                .catch((error) => {
                    if (error.auth != undefined) {
                        return res.status(400).send(error);
                    }
                    else {
                        console.log(`[${context}][getChargerDetailsEVIONetWork] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });
        }
        else {
            getPrivateDetailsEVIONetWork(query, req.headers)
                .then((chargerFound) => {
                    return res.status(200).send({
                        ...chargerFound,
                        userDeletionStatus
                    });
                })
                .catch((error) => {
                    if (error.auth != undefined) {
                        return res.status(400).send(error);
                    }
                    else {
                        console.log(`[${context}][getChargerDetailsEVIONetWork] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });
        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

app.get('/api/private/connectionstation/landingPage', async (req, res) => {
    const context = "GET /api/private/connectionstation/landingPage";
    const startDate = new moment();
    const sendMetricToSentry = () => {
        const endDate = new moment();
        const totalTimeInMillis = endDate.diff(startDate);
        console.log(`${context} Processing time: ${totalTimeInMillis} ms`);
        registerMetric('get_userlogged_in_landingpage_processing_time', totalTimeInMillis, 'ms');
    };

    try {

        const { language, component, userid: userId, client: clientType, evioappversion: evioAppVersion, clientname: clientName } = req.headers;

        console.log("Start", new Date());
        //EVs
        let evs = await getEvLandingPage(userId);
        console.log(`[${context}] ${evs?.length} EVs retrieved successfully for userId=${userId}`);

        //Configs
        let needUpdatePromise = verifyVersionCompatibility(clientType, evioAppVersion, clientName);
        let messagesPromise = getMessages(req.query);
        let appConfigurationPromise = ConfigsService.getAppConfiguration(clientName);

        //Chargers
        let myActiveSessionsPromise = getMyActiveSessions(userId);

        //Languages
        const translation = await verifyLanguage({clientName, languageCode: req.query.languageCode, component, language});

        //Tariffs
        let tariffTeslaPromise = getTeslaTariff();

        //Identitys
        let identitysPromise = getIdentitysLandingPage(userId, evs);
        //let cemeTariffPromise = getCEMETariff(userId);

        //Payments
        let wallet = await getWallet(userId);

        //Public Tariffs
        let CEMEPromise = getCEMEEVIOLandingPage([process.env.NetworkGireve], clientName, userId);


        console.log("END ", new Date());
        Promise.all([needUpdatePromise, myActiveSessionsPromise, identitysPromise, messagesPromise, CEMEPromise, tariffTeslaPromise, appConfigurationPromise])
            .then((response) => {

                console.log("Start response ", new Date());
                let needUpdate = response[0];
                let myActiveSessions = response[1];
                let userAccount = response[2].userAccount;
                let myContracts = response[2].myContracts;
                let contractsFleets = response[2].contractsFleets;
                let cemeTariff = response[2].CEMETariff;
                let messages = response[3];
                let CEME = response[4];
                let tariffTesla = response[5];
                let appConfiguration = response[6];
                let myBookings = []

                console.log(`${context} contractsFleets: ${JSON.stringify(contractsFleets)}`);

                let contracts = myContracts.concat(contractsFleets).map(contract => ({
                    ...contract,
                    userIdWillPay: getUserIdWillPay(contract, evs, userId),
                }));
                
                let needChangePassword;
                if (userAccount.needChangePassword) {
                    needChangePassword = true;
                }
                else {
                    needChangePassword = false;
                };

                let sendFrontEnd = {
                    needUpdate: needUpdate,
                    language: translation,
                    userAccount: userAccount,
                    evs: evs,
                    contracts: contracts,
                    cemeTariff: cemeTariff,
                    myActiveSessions: myActiveSessions,
                    myBookings: myBookings,
                    wallet: wallet,
                    messages: messages,
                    CEME: CEME,
                    tariffTesla: tariffTesla,
                    needChangePassword: needChangePassword,
                    landindPage: "",
                    mapsConfiguration: appConfiguration
                };

                console.log("Response ", new Date())
                sendMetricToSentry();
                return res.status(200).send(sendFrontEnd);

            })
            .catch((error) => {
                sendMetricToSentry();

                if (error.status === 400) {
                    return res.status(400).send(error.data);
                }
                else {
                    console.log(`[${context}] Error `, error);
                    return res.status(500).send(error.message);
                };

            });

    } catch (error) {
        sendMetricToSentry();

        if (error.status === 400) {
            return res.status(400).send(error.data);
        }
        else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };

    };
});

//Endpoint to get landingPage to mobile apps (When user not have login)
app.get('/api/public/connectionstation/landingPage', async (req, res) => {
    const context = "GET /api/public/connectionstation/landingPage";
    const startDate = new moment();
    const sendMetricToSentry = () => {
        const endDate = new moment();
        const totalTimeInMillis = endDate.diff(startDate);
        console.log(`${context} Processing time: ${totalTimeInMillis} ms`);
        registerMetric('get_user_not_logged_landingpage_processing_time', totalTimeInMillis, 'ms');
    };

    try {
        const { language, component, client: clientType, evioappversion: evioAppVersion, clientname: clientName } = req.headers;
        const { languageCode } = req.query;


        let needUpdate = await verifyVersionCompatibility(clientType, evioAppVersion, clientName);
        
        //Languages
        let translation = await verifyLanguage({clientName, languageCode: languageCode, component, language});

        let messages = await getMessages(req.query);
        let CEME = await getCEMEEVIOADHOC(clientName);
        let tariffTesla = await getTeslaTariff();
        let tariffRoamingInfo = await getRoamingTariffs([process.env.NetworkGireve, process.env.NetworkHubject]);

        CEME.tariffRoamingInfo = tariffRoamingInfo;
        //console.log("tariffRoamingInfo", tariffRoamingInfo);

        let sendFrontEnd = {
            needUpdate: needUpdate,
            language: translation,
            messages: messages,
            CEME: CEME,
            tariffTesla: tariffTesla,
            landindPage: ""
        };

        sendMetricToSentry();
        return res.status(200).send(sendFrontEnd);

    } catch (error) {
        sendMetricToSentry();

        if (error.status === 400) {
            return res.status(400).send(error.data);
        }
        else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };
});

//Endpoint to get My active sessions (EVIO and MobiE)
app.get('/api/private/connectionstation/myActiveSessions', async (req, res) => {
    var context = "GET /api/private/connectionstation/myActiveSessions";
    const startDate = new moment();
    const sendMetricToSentry = () => {
        const endDate = new moment();
        const totalTimeInMillis = endDate.diff(startDate);
        console.log(`${context} Processing time: ${totalTimeInMillis} ms`);
        registerMetric('get_my_active_sessions_processing_time', totalTimeInMillis, 'ms');
    };

    try {

        var userId = req.headers['userid'];

        let myActiveSessions = await getMyActiveSessions(userId);

        sendMetricToSentry();
        return res.status(200).send(myActiveSessions);

    } catch (error) {
        sendMetricToSentry();

        if (error.status === 400) {
            return res.status(400).send(error.data);
        }
        else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };
});

//Endpoint to get session on my chargers (EVIO)
app.get('/api/private/connectionstation/activeSessionsMyChargers', async (req, res) => {
    var context = "GET /api/private/connectionstation/activeSessionsMyChargers";
    try {

        var userId = req.headers['userid'];
        let activeSessionsMyChargers = await getActiveSessionsMyChargers(userId);

        return res.status(200).send(activeSessionsMyChargers);

    } catch (error) {
        if (error.status === 400) {
            return res.status(400).send(error.data);
        }
        else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };
});

//Endpoint to get summary of an session (EVIO and MobiE)
app.get('/api/private/connectionstation/summary', async (req, res) => {
    const context = "GET /api/private/connectionstation/summary";
    try {

        let userId = req.headers['userid'];
        let query = req.query;

        let publicNetworkChargerType = process.env.PublicNetworkChargerType;

        publicNetworkChargerType = publicNetworkChargerType.split(',');

        let found = publicNetworkChargerType.find(type => {
            return type === query.chargerType;
        });

        //console.log("found", found);
        if (found/*query.chargerType === process.env.OCMCharger || query.chargerType === process.env.MobieCharger || query.chargerType === process.env.TeslaCharger*/) {

            let headers = {
                userid: userId
            };

            let params = {
                _id: query._id
            };
            let host = process.env.HostChargingSessionMobie + process.env.PathChargingSessionInfoMobie

            axios.get(host, { headers, params })
                .then(async (result) => {
                    const history = await getHistory(result.data?.chargingSession);
                    if (history?.sessionBillingInfo) {
                        result.data.chargingSession.sessionBillingInfo = history.sessionBillingInfo;
                    }
                    return res.status(200).send(result.data);

                })
                .catch((error) => {
                    if (error.response) {
                        return res.status(400).send(error.response.data);
                    }
                    else {
                        console.log(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });

        }
        else {

            let headers = {
                userid: userId
            };

            let params = {
                _id: query._id
            };

            let host = process.env.ChargersServiceProxy + process.env.ChargerSessionsSummaryEVIONetwork;

            axios.get(host, { headers, params })
                .then(async (result) => {

                    const history = await getHistory(result.data.chargingSession);
                    result.data.chargingSession.sessionBillingInfo = history.sessionBillingInfo;
                    return res.status(200).send(result.data);

                })
                .catch((error) => {
                    if (error.response) {
                        return res.status(400).send(error.response.data);
                    }
                    else {
                        console.log(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });

        };

    } catch (error) {
        if (error.response) {
            return res.status(400).send(error.response.data);
        }
        else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };
});

//Endpoint to get check session (EVIO and MobiE)
app.get('/api/private/connectionstation/checkSession', async (req, res) => {
    var context = "GET /api/private/connectionstation/checkSession";
    try {

        var userId = req.headers['userid'];
        var query = req.query;

        var publicNetworkChargerType = process.env.PublicNetworkChargerType;

        publicNetworkChargerType = publicNetworkChargerType.split(',');

        var found = publicNetworkChargerType.find(type => {
            return type === query.chargerType;
        });

        if (found) {
            await SessionsService.validationSessionTime(query._id, 'OCPI');
            getSessionMobiE(query._id)
                .then(response => {
                    return res.status(200).send(response);
                })
                .catch(error => {
                    if (error.response) {
                        console.log(`[${context}][getSessionMobiE][400] Error `, error.response);
                        return res.status(400).send(error.response);
                    }
                    else {
                        console.log(`[${context}][getSessionMobiE][500] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });
        }
        else {
            await SessionsService.validationSessionTime(query._id, 'OCPP');
            getSessionEVIO(query._id)
                .then(response => {
                    return res.status(200).send(response);
                })
                .catch(error => {
                    if (error.response) {
                        console.log(`[${context}][getSessionEVIO][400] Error `, error.response);
                        return res.status(400).send(error.response);
                    }
                    else {
                        console.log(`[${context}][getSessionEVIO][500] Error `, error.message);
                        return res.status(500).send(error.message);
                    };
                });
        };

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

app.get('/api/private/connectionstation/getKPIs', async (req, res) => {
    var context = "GET /api/private/connectionstation/getKPIs";
    try {

        let clientType = req.headers['client'];

        if (clientType !== 'operationsManagement' && clientType !== 'Postman') {
            return res.status(400).send({ auth: false, code: 'server_not_authorized_access', message: 'You are not authorized to access, Only operation management' });
        };

        let kpisChargers = await getKPIsChargers();
        let kpisUsers = await getKPIsUsers();

        let response = Object.assign(kpisUsers, kpisChargers);

        return res.status(200).send(response);

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

app.get('/api/private/connectionstation/chargerSupport', async (req, res) => {
    return handleSupportChargerRequest(req, res);
});

//========== PTU ==========
//Endpoint to save rating of an session (EVIO and MobiE)
app.put('/api/private/connectionstation/rating', async (req, res) => {
    var context = "PUT /api/private/connectionstation/rating";
    try {

        var session = req.body;

        validateRatingSession(session)
            .then(() => {

                var publicNetworkChargerType = process.env.PublicNetworkChargerType;

                publicNetworkChargerType = publicNetworkChargerType.split(',');

                var found = publicNetworkChargerType.find(type => {
                    return type === session.chargerType;
                });

                if (found/*query.chargerType === process.env.OCMCharger || query.chargerType === process.env.MobieCharger || query.chargerType === process.env.TeslaCharger*/) {

                    var data = session
                    var host = process.env.HostChargingSessionMobie + process.env.PathChargingSessionRatingMobie

                    axios.put(host, data)
                        .then((result) => {

                            return res.status(200).send(result.data);

                        })
                        .catch((error) => {
                            if (error.response) {
                                return res.status(400).send(error.response.data);
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            };
                        });
                }
                else {

                    var host = process.env.ChargersServiceProxy + process.env.PathChargingSessionRatingEVIO;
                    var data = session;
                    axios.put(host, data)
                        .then((result) => {
                            return res.status(200).send(result.data);
                        })
                        .catch((error) => {
                            if (error.response) {
                                return res.status(400).send(error.response.data);
                            }
                            else {
                                console.log(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            };
                        });

                };

            })
            .catch(error => {
                console.log(`[${context}][validateRatingSession] Error `, error.message);
                return res.status(400).send(error);
            });


    } catch (error) {
        if (error.status === 400) {
            return res.status(400).send(error.data);
        }
        else {
            console.log(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    };
});

//========== FUNCTIONS ==========
async function getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter) {
    const context = "Function getAllChargers";
    const startDate = new moment();
    const sendMetricToSentry = () => {
        const endDate = new moment();
        const totalTimeInMillis = endDate.diff(startDate);
        console.log(`${context} Processing time: ${totalTimeInMillis} ms`);
        registerMetric('post_connectionstation_chargers_processing_time', totalTimeInMillis, 'ms');
    };

    try {

        let headers;
        if (userId == undefined) {
            headers = {
                clientname: clientName
            };
        } else {
            headers = {
                userId: userId,
                clientname: clientName
            };
        };

        //console.log("EVIO HOST", host);
        let result = await axios.get(host, { headers, params, data }, { timeout: 5 });

        console.log("EVIO  ", result.data.length)

        //console.log("publicHost", publicHost);
        let value = await connectChargerType(publicHost, headers, params, dataPublic);

        console.log("Public   ", value.length)
        let chargers = result.data.concat(value);

        //when tariff saved on plug remove //
        if (chargers.length === 0) {
            sendMetricToSentry();
            return res.status(200).send(chargers);
        } else {
            if (filter && filter.priceRange && !filter.contractId && !filter.evId) {
                console.log("1")
                if (filter.priceRange.min != -1 && filter.priceRange.max != -1) {
                    let newChargers = await filterPrice(chargers, filter.priceRange, clientName);
                    return res.status(200).send(newChargers);
                } else if (filter.priceRange.min != -1 && filter.priceRange.max == -1) {
                    filter.priceRange.max = filter.priceRange.min
                    let newChargers = await filterPrice(chargers, filter.priceRange, clientName);
                    sendMetricToSentry();
                    return res.status(200).send(newChargers);
                } else {
                    sendMetricToSentry();
                    return res.status(200).send(chargers);
                };

            } else if (filter && filter.priceRange && filter.contractId && filter.evId) {
                console.log("2")
                if (filter.priceRange.min != -1 && filter.priceRange.max != -1) {

                    let newChargers = await priceSimulation(chargers, filter.contractId, filter.evId, filter.priceRange, params);
                    let responseChargers = await sortChargers(filter.filterBy, newChargers, res)
                    sendMetricToSentry();
                    return res.status(200).send(responseChargers);
                    //return res.status(200).send(newChargers);

                } else if (filter.priceRange.min != -1 && filter.priceRange.max == -1) {

                    filter.priceRange.max = filter.priceRange.min
                    let newChargers = await priceSimulation(chargers, filter.contractId, filter.evId, filter.priceRange, params);
                    let responseChargers = await sortChargers(filter.filterBy, newChargers, res)
                    sendMetricToSentry();
                    return res.status(200).send(responseChargers);
                    //return res.status(200).send(newChargers);

                } else {

                    let newChargers = await priceSimulation(chargers, filter.contractId, filter.evId, null, params);
                    let responseChargers = await sortChargers(filter.filterBy, newChargers, res)
                    sendMetricToSentry();
                    return res.status(200).send(responseChargers);
                    //return res.status(200).send(newChargers);

                };

            } else if (filter && filter.contractId && filter.evId) {

                console.log("3", filter.filterBy)
                let newChargers = await priceSimulation(chargers, filter.contractId, filter.evId, null, params);
                let responseChargers = await sortChargers(filter.filterBy, newChargers, res)
                sendMetricToSentry();
                return res.status(200).send(responseChargers);

            } else {
                console.log("4")
                sendMetricToSentry();
                return res.status(200).send(chargers);
            };
        };

    } catch (error) {
        sendMetricToSentry();
        console.log(`[${context}] Error`, error.message);
        return res.status(500).send(error);
    };
};

function getEvioChargers(host, params, data, res, userId, filter, clientName) {
    var context = "Function getEvioChargers";
    try {
        if (userId == undefined) {
            var headers = {

            };
        }
        else {
            var headers = {
                userId: userId
            };
        };
        axios.get(host, { headers, params, data }, { timeout: 5 })
            .then(async (result) => {
                //TODO Price Range
                //when tariff saved on plug remove //
                if (filter != undefined && filter.priceRange != undefined) {
                    if (filter.priceRange.min != -1 && filter.priceRange.max != -1) {
                        //return res.status(200).send(result.data);
                        let newChargers = await filterPrice(result.data, filter.priceRange, clientName);
                        //return res.status(200).send(chargers);

                        return res.status(200).send(newChargers);
                    } else if (filter.priceRange.min != -1 && filter.priceRange.max == -1) {

                        filter.priceRange.max = filter.priceRange.min
                        let newChargers = await filterPrice(result.data, filter.priceRange, clientName);

                        return res.status(200).send(newChargers);
                    } else {

                        //return res.status(200).send(chargers);

                        return res.status(200).send(result.data);
                    };
                }
                else {
                    return res.status(200).send(result.data);
                };
            })
            .catch((error) => {
                if (error.response) {
                    console.log(`[${context}][get][.catch] Error`, error.response.data);
                    var err = error.response.data;
                    return res.status(500).send(err);
                }
                else {
                    console.log(`[${context}][get][.catch] Error`, error.message);

                    return res.status(500).send(error.message);
                }
            });
    } catch (error) {
        console.log(`[${context}] Error`, error.message);
        return res.status(500).send(error);
    };
};

function getPublicChargers(publicHost, params, dataPublic, res, clientName, userId, filter) {
    var context = "Function getPublicChargers";
    try {
        var headers;
        if (userId == undefined) {
            headers = {
                clientname: clientName
            };
        } else {
            headers = {
                userId: userId,
                clientname: clientName
            };
        };
        connectChargerType(publicHost, headers, params, dataPublic)
            .then(async (chargersPlublic) => {
                //TODO Price Range
                //when tariff saved on plug remove //
                if (filter != undefined && filter.priceRange != undefined) {
                    if (filter.priceRange.min != -1 && filter.priceRange.max != -1) {
                        //return res.status(200).send(chargersPlublic);
                        let newChargers = await filterPrice(chargersPlublic, filter.priceRange, clientName);
                        //return res.status(200).send(chargers);
                        return res.status(200).send(newChargers);
                    } else if (filter.priceRange.min != -1 && filter.priceRange.max == -1) {

                        filter.priceRange.max = filter.priceRange.min
                        let newChargers = await filterPrice(chargersPlublic, filter.priceRange, clientName);

                        return res.status(200).send(newChargers);
                    } else {
                        return res.status(200).send(chargersPlublic);

                    };
                }
                else {
                    return res.status(200).send(chargersPlublic);
                };
            })
            .catch((error) => {
                console.log(`[${context}] [connectChargerTypeNew] Error`, error.message);
                return res.status(500).send(error);
            });
    } catch (error) {
        console.log(`[${context}] Error`, error.message);
        return res.status(500).send(error);
    };
};

function getProxy(host, res) {
    var context = "Function getProxy";
    try {

        request(host).pipe(res);
        /*
        axios.get(host, { headers })
            .then((result) => {

                var data = JSON.parse(JSON.stringify(result.data));
                return res.status(200).send(data);
            })
            .catch((error) => {
                console.log(`[${context}][${host}][.catch] Error`, error.response.data);
                return res.status(500).send(error.response.data);
            });
            */

    } catch (error) {
        console.log(`[${context}] Error`, error.message);
        return res.status(500).send(error);
    };
};


function getPublicDetailsEVIONetWork(query, data) {
    var context = "Function getPublicDetailsEVIONetWork";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.ChargersServiceProxy + process.env.ChargerDetailsPublicEVIONetWork;
            var params = {
                _id: query._id,
                active: true
            };

            let headers = {
                userid: data.userid ? data.userid : ''
            };

            console.log("host", host);
            console.log("params", params);
            console.log("headers", headers);

            axios.get(host, { headers, params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    if (error.response) {
                        console.log(`[${context}][$][.catch] Error`, error.response.data);
                        reject(error.response.data);
                    }
                    else {
                        console.log(`[${context}][$][.catch] Error`, error.message);
                        reject(error);
                    };
                })

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};



//Function to check if you have a new version of the app to update
function verifyVersionCompatibility(clientType, evioAppVersion, clientName) {
    var context = "Function verifyVersionCompatibility";
    return new Promise((resolve, reject) => {
        try {
            const params = {
                clientName: clientName,
                clientType: clientType,
                iOSVersion: evioAppVersion,
                androidVersion: evioAppVersion
            }
            console.log("params", params);
            getVersionCompatibility(params)
                .then((result) => {
                    resolve(!result);
                })
                .catch((error) => {
                    console.log(`[${context}][getVersionCompatibility] Error `, error.message);
                    resolve(false);
                    //reject(error);
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve(false);
            //reject(error);
        };
    });
};

function getVersionCompatibility(params) {
    var context = "Function getVersionCompatibility";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.ConfigsHost + process.env.ConfigsPath;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    if (error.response) {
                        console.log(`[${context}] [${host}] Error `, error.response.data);
                        reject(error.response.data.message);
                    }
                    else {
                        console.log(`[${context}] [${host}] Error `, error.message);
                        reject(error);
                    };
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to get may active sessions
function getMyActiveSessions(userId) {
    var context = "Function getMyActiveSessions";
    return new Promise(async (resolve, reject) => {
        try {
            var host = process.env.ChargersServiceProxy + process.env.ChargingSessionsMyActiveSessionsPath;

            var headers = {
                userid: userId
            };

            let myActiveSessionsEVIONetwork = await axios.get(host, { headers });
            let myActiveSessionsPublicNetwork = await getMyActiveSessionsPublicNetwork(headers);

            let myActiveSessions = myActiveSessionsEVIONetwork.data.concat(myActiveSessionsPublicNetwork);
            resolve(orderByCreation(myActiveSessions));

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error);
        };
    });
};

// it will order the session from more recent to oldest
function orderByCreation(listSessions) {
    const context = "app orderByCreation"
    try {
        if (listSessions.length <= 1) return listSessions

        return listSessions.sort(function (sessionA, sessionB) {
            let dateSessionA = sessionA.startDate ? sessionA.startDate : sessionA.start_date_time
            let dateSessionB = sessionB.startDate ? sessionB.startDate : sessionB.start_date_time
            return new Date(dateSessionB) - new Date(dateSessionA)
        })

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return listSessions
    }
}

//Function to get my bookings
function getMyBookings(userId) {
    var context = "Function getMyBookings";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.BookingHost + process.env.BookingMyBookingsPath;

            var headers = {
                userid: userId
            };

            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve([]);
                    //reject(error.response.data.message);

                });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error);

        };
    });
};

//Function to check the language and check for new translations
const verifyLanguage = async function (dataLanguage) {
    const context = "Function verifyLanguage";
    try {
        console.log(`[${context}] dataLanguage`, dataLanguage)
        if (!dataLanguage.languageCode && !dataLanguage.language)
            throw ErrorHandlerCommon.BadRequest({ auth: false, code: 'server_language_code_specified', message: 'Language code must be specified on translation search' }, context);

        if(!dataLanguage.component)
            throw ErrorHandlerCommon.BadRequest({ auth: false, code: 'server_component_specified', message: 'Component must be specified on translation search' }, context);


        const hash = await FileTransaction.retriveFileTransactionAsHash({
            component: dataLanguage.component, 
            project: dataLanguage.clientName, 
            language: dataLanguage.languageCode || dataLanguage.language
        });

        console.log(`[${context}] hash`, hash)
        return hash;
    } catch (error) {
        console.log(`[${context}] Error `, StatusCodeHttp.NOT_FOUND,  error);
        if(error.status === StatusCodeHttp.BAD_REQUEST || error.status === StatusCodeHttp.NOT_FOUND || error.statusCode === StatusCodeHttp.NOT_FOUND){
            throw error;
        }
       
        throw ErrorHandlerCommon.ServerError( { auth: false, code: 'server_internal_server_error', message: 'internal server error' }, context);
    }
};

//Function to get user account informations
function getUserAccount(userId) {
    var context = "Function getUserAccount";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.IdentityHost + process.env.UsersAccountsPath;
            var headers = {
                userid: userId
            };

            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve({});
                    //reject(error.message);

                });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve({});
            //reject(error.message);

        };
    });
};

function getIdentitysLandingPage(userId, evs) {
    var context = "Function getIdentitysLandingPage";
    return new Promise((resolve, reject) => {
        try {

            let lisOfEvs = [];

            //console.log("evs", evs.length)

            if (evs.length > 0) {

                Promise.all(
                    evs.map(ev => {
                        return new Promise((resolve, reject) => {

                            if (ev.userId != userId) {

                                lisOfEvs.push(ev._id);
                                resolve(true);

                            } else {
                                resolve(true);
                            };

                        })
                    })
                ).then(() => {

                    //console.log("lisOfEvs", lisOfEvs.length)
                    if (lisOfEvs.length > 0) {

                        var host = process.env.IdentityHost + process.env.PathIdentitysLandingPage;

                        var headers = {
                            userid: userId
                        };

                        var params = {
                            evsId: lisOfEvs
                        };

                        axios.get(host, { params, headers })
                            .then((result) => {
                                resolve(result.data);
                            })
                            .catch((error) => {
                                console.log(`[${context}] [${host}] Error `, error.message);
                                var response = {
                                    userAccount: {},
                                    myContracts: [],
                                    contractsFleets: [],
                                    CEMETariff: []
                                };
                                resolve(response);
                                //reject(error.message);
                            });

                    } else {

                        var host = process.env.IdentityHost + process.env.PathIdentitysLandingPage;

                        var headers = {
                            userid: userId
                        };

                        var params = {
                            evsId: []
                        };

                        axios.get(host, { params, headers })
                            .then((result) => {
                                resolve(result.data);
                            })
                            .catch((error) => {
                                console.log(`[${context}] [${host}] Error `, error.message);
                                var response = {
                                    userAccount: {},
                                    myContracts: [],
                                    contractsFleets: [],
                                    CEMETariff: []
                                };
                                resolve(response);
                                //reject(error.message);
                            });

                    };

                });

            } else {

                var host = process.env.IdentityHost + process.env.PathIdentitysLandingPage;

                var headers = {
                    userid: userId
                };

                var params = {
                    evsId: []
                };

                axios.get(host, { params, headers })
                    .then((result) => {
                        resolve(result.data);
                    })
                    .catch((error) => {
                        console.log(`[${context}] [${host}] Error `, error.message);
                        var response = {
                            userAccount: {},
                            myContracts: [],
                            contractsFleets: [],
                            CEMETariff: []
                        };
                        resolve(response);
                        //reject(error.message);
                    });

            };

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            var response = {
                userAccount: {},
                myContracts: [],
                contractsFleets: [],
                CEMETariff: []
            };
            resolve(response);
            //reject(error.message);

        };
    });
};

//Function to get user evs and that the user has access
function getEv(userId) {
    var context = "Function getEv";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.EVsHost + process.env.EVsPath;
            var headers = {
                userid: userId
            };

            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve([]);
                    //reject(error.message);

                });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error.message);

        };
    });
};

const getEvLandingPage = async(userId) => {
    const context = "Function getEvLandingPage";

    const fallbackResult = [];
    try {

        const fetchedGroups = await findGroupDriversOthersEVS(userId);
        const groupIds = fetchedGroups.map(group => group._id);
        console.log(`[${context}] [findGroupDriversOthersEVS] Fetched groups: ${groupIds.length}`);

        return await findEVSLandingPage(userId, groupIds);
    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);

        return fallbackResult;
    }
}

//Function to get User contracts
function getContracts(userId) {
    var context = "Function getContracts";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.IdentityHost + process.env.ContractsPath;
            var headers = {
                userid: userId
            };

            axios.get(host, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve([]);
                    //reject(error.message);
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error.message);
        };
    });
};

function getContractsFleet(userId, evs) {
    var context = "Function getContractsFleet";
    return new Promise((resolve, reject) => {
        try {

            let lisOfEvs = [];

            if (evs.length > 0) {
                Promise.all(
                    evs.map(ev => {
                        return new Promise((resolve, reject) => {
                            if (ev.userId != userId) {
                                lisOfEvs.push(ev._id);
                                resolve(true)
                            }
                            else {
                                resolve(true);
                            }

                        })
                    })
                ).then(() => {

                    if (lisOfEvs.length > 0) {
                        var host = process.env.IdentityHost + process.env.PathContractsIHaveAcess;

                        var headers = {
                            userid: userId
                        };

                        var params = {
                            evsId: lisOfEvs
                        };

                        axios.get(host, { params, headers })
                            .then((result) => {
                                resolve(result.data);
                            })
                            .catch((error) => {
                                console.log(`[${context}] [${host}] Error `, error.message);
                                resolve([]);
                                //reject(error.message);
                            });
                    }
                    else {
                        resolve([]);
                    }
                })
            }
            else {
                resolve([]);
            };

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error.message);
        };
    });
};

//Function to get CEME's tariffs
function getCEMETariff(userId) {
    var context = "Function getCEMETariff";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.IdentityHost + process.env.PathCEMETariff;
            var headers = {
                userid: userId
            };
            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve([]);
                    //reject(error.message);

                });
        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error.message);

        };
    });
};

/**
 * This function is used to get the wallet of a user as we made here
 * https://github.com/GOEVIO/backend/blob/development/evio_Payments_Microservice/routes/wallet.js#L655
 * @param userId
 * @returns {Promise<{[p: string]: *}|{amount: {currency: string, value: number}}>}
 */
const getWallet = async(userId) => {
    const context = "Function getWallet";
    const fallBack = {
        amount: {
            value: 0,
            currency: "EUR"
        }
    };

    try {
        
        const debtValue = await calculateUserDebt(userId);
        const isDebtValueVisible = await toggle.isEnable("identity_show_debt_value");

        const fetchedWallet = await retrieveWalletByUserId(userId);
        if (!fetchedWallet) {
            Sentry.captureMessage(`[${context}] Wallet not found for user ${userId}`);
        }

        return fetchedWallet ? {
            ...fetchedWallet,
            transactionsList: null,
            amount: { value: parseFloat(fetchedWallet?.amount?.value?.toFixed(2)) },
            ...(isDebtValueVisible && debtValue.value !== 0 && { debtValue })
        } : fallBack;
    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error while fetching user wallet, returning fallback`, error);

        return fallBack;
    }
}

// FIXME: seems that function is not used
function getTAR(params) {
    var context = "Function getTAR";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.PublicTariffHost + process.env.PathGetTar;
            axios.get(host, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}][axios.get] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to check for warning, stop and info messages
function getMessages(params) {
    var context = "Function getMessages";
    return new Promise((resolve, reject) => {

        try {

            var host = process.env.HostConifgs + process.env.PathGetMessages;

            axios.get(host)
                .then((result) => {

                    getTranslations(result.data, params)
                        .then((message) => {

                            resolve(message);

                        })
                        .catch((error) => {

                            console.log(`[${context}] [${host}] Error `, error.message);
                            resolve(
                                {
                                    warnings: {
                                        warningsMessage: [],
                                        warningActive: false
                                    },
                                    stop: {
                                        stopMessage: {},
                                        stopActive: false
                                    },
                                    info: {
                                        infoMessage: {},
                                        infoActive: false
                                    }
                                }
                            );
                            //reject(error.message);

                        });


                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve(
                        {
                            warnings: {
                                warningsMessage: [],
                                warningActive: false
                            },
                            stop: {
                                stopMessage: {},
                                stopActive: false
                            },
                            info: {
                                infoMessage: {},
                                infoActive: false
                            }
                        }
                    );
                    //reject(error.message);

                });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve(
                {
                    warnings: {
                        warningsMessage: [],
                        warningActive: false
                    },
                    stop: {
                        stopMessage: {},
                        stopActive: false
                    },
                    info: {
                        infoMessage: {},
                        infoActive: false
                    }
                }
            );
            //reject(error.message);

        };

    });
};

//Function to translate messages
function getTranslations(message, params) {
    var context = "Function getMessages";
    return new Promise((resolve, reject) => {

        try {

            var host = process.env.LanguageHost + process.env.LanguageGetKeys;

            axios.get(host, { params })
                .then((result) => {

                    var language = result.data;

                    if (message.warnings.warningActive) {

                        message.warnings.warningsMessage.map(warning => {

                            var msg = language[0].translations.find(translation => {
                                return translation.key == warning.message;
                            });

                            if (msg) {
                                warning.message = msg.value;
                            };

                        });

                    };

                    if (message.stop.stopActive) {

                        var msg = language[0].translations.find(translation => {
                            return translation.key == message.stop.stopMessage.message;
                        });

                        if (msg) {
                            message.stop.stopMessage.message = msg.value;
                        };

                    };

                    if (message.info.infoActive) {

                        message.info.infoMessage.infoMessage.map(info => {

                            var msg = language[0].translations.find(translation => {
                                return translation.key == info.message;
                            });

                            var title = language[0].translations.find(translation => {
                                return translation.key == info.title;
                            });

                            if (msg) {
                                info.message = msg.value;
                            };

                            if (title) {
                                info.title = title.value;
                            };

                        });

                    };

                    resolve(message);

                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve(
                        {
                            warnings: {
                                warningsMessage: [],
                                warningActive: false
                            },
                            stop: {
                                stopMessage: {},
                                stopActive: false
                            },
                            info: {
                                infoMessage: {},
                                infoActive: false
                            }
                        }
                    );
                    //reject(error.message);

                });
        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve(
                {
                    warnings: {
                        warningsMessage: [],
                        warningActive: false
                    },
                    stop: {
                        stopMessage: {},
                        stopActive: false
                    },
                    info: {
                        infoMessage: {},
                        infoActive: false
                    }
                }
            );
            //reject(error.message);

        };

    });
};

//Function to get my active session OCPI (MobiE)
function getMyActiveSessionsPublicNetwork(headers) {
    var context = "Function getMyActiveSessionsPublicNetwork";
    return new Promise((resolve, reject) => {

        try {

            var host = process.env.HostChargingSessionMobie + process.env.PathChargingSessionMyActiveSessionsMobie;

            axios.get(host, { headers })
                .then((result) => {
                    resolve(result.data)

                })
                .catch((error) => {

                    console.log(`[${context}][${host}] Error `, error.message);
                    //reject(error);
                    resolve([])

                });



        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve([])
            //reject(error);

        };

    });

};

//Function to get sessions my chargers
function getActiveSessionsMyChargers(userId) {
    var context = "Function getActiveSessionsMyChargers";
    return new Promise(async (resolve, reject) => {
        try {

            var host = process.env.ChargersServiceProxy + process.env.ChargingSessionsActiveSessionsMyChargersPath;

            var headers = {
                userid: userId
            };

            let activeSessionsMyChargersEVIONetwork = await axios.get(host, { headers });
            let activeSessionsMyChargersPublicNetwork = await getActiveSessionsMyChargersPublicNetwork(headers);

            let activeSessionsMyChargers = activeSessionsMyChargersEVIONetwork.data.concat(activeSessionsMyChargersPublicNetwork);

            resolve(activeSessionsMyChargers);

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error.message);
        };
    });
};

function getActiveSessionsMyChargersPublicNetwork(headers) {
    var context = "Function getMyActiveSessionsPublicNetwork";
    return new Promise((resolve, reject) => {

        try {

            resolve([]);
            //TODO

            /*
            var host = process.env.HostChargingSessionMobie + process.env.PathChargingSessionActiveSessionsMyChargersMobie;

            axios.get(host, { headers })
                .then((result) => {

                    //TODO

                })
                .catch((error) => {

                    console.log(`[${context}] Error `, error.message);
                   resolve([]);

                });
            */

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve([]);
        };

    });

};

function hostIssuesEVIO(hostIssue, userId) {
    var context = "Function hostIssuesEVIO";
    return new Promise(async (resolve, reject) => {
        try {

            var proxyCharger = process.env.ChargersServiceProxy + process.env.PathReportHostIssueEVIO;

            var data = hostIssue;

            var headers = {
                userid: userId
            };

            axios.post(proxyCharger, data, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.log(`[${context}][proxyCharger] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getCEMEEVIO(clientName) {
    const context = "Function getCEMEEVIO";
    return new Promise(async (resolve, reject) => {
        try {

            let proxy = process.env.HostPublicTariffs + process.env.PathGetTariffs;

            let params;

            switch (clientName) {
                case process.env.WhiteLabelGoCharge:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_goCharge"
                    };
                    break;
                case process.env.WhiteLabelHyundai:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_hyundai"
                    };
                    break;
                case process.env.WhiteLabelKLC:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_klc"
                    };
                    break;
                case process.env.WhiteLabelKinto:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_kinto"
                    };
                    break;
                default:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc"
                    };
                    break;
            };

            axios.get(proxy, { params })
                .then((result) => {
                    if (result.data)
                        resolve(result.data);
                    else
                        resolve({})
                })
                .catch((error) => {
                    console.log(`[${context}] [${proxy}] Error `, error.message);
                    //reject(error);
                    resolve({})
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            //reject(error);
            resolve({})
        };
    });
};

function getCEMEEVIOADHOC(clientName) {
    const context = "Function getCEMEEVIOADHOC";
    return new Promise(async (resolve, reject) => {
        try {

            let proxy = process.env.HostPublicTariffs + process.env.PathGetTariffs;

            let params;

            switch (clientName) {
                case process.env.WhiteLabelGoCharge:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_goCharge"
                    };
                    break;
                case process.env.WhiteLabelHyundai:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_hyundai"
                    };
                    break;
                case process.env.WhiteLabelKLC:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_klc"
                    };
                    break;
                case process.env.WhiteLabelKinto:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc_kinto"
                    };
                    break;
                default:
                    params = {
                        planName: "server_plan_EVIO_ad_hoc"
                    };
                    break;
            };

            axios.get(proxy, { params })
                .then((result) => {
                    if (result.data)
                        resolve(result.data);
                    else
                        resolve({})
                })
                .catch((error) => {
                    console.log(`[${context}] [${proxy}] Error `, error.message);
                    //reject(error);
                    resolve({})
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            //reject(error);
            resolve({})
        };
    });
};



/*
test()
async function test() {
    let dateNow = new Date();
    let finalDate = new Date(dateNow.getTime() + 2 * 60000);
    let date = dateNow;

    while (date < finalDate) {
        let ceme = await getCEMEEVIO();
        let charger = {
            voltageLevel: 'BTN'
        };


        let priceCEME = await getCEMEAndTARPrice(ceme, charger, date)

        console.log("priceCEME", priceCEME);
        date = new Date(date.getTime() + 1 * 60000);

    };
};
*/

function getCEMEAndTARPrice(ceme, charger, date) {
    var context = "Function getCEMEAndTARPrice";
    return new Promise(async (resolve, reject) => {
        try {

            let voltageLevel;

            if (charger.voltageLevel === "" || charger.voltageLevel === undefined) {
                voltageLevel = 'BTN';
            }
            else {
                voltageLevel = charger.voltageLevel;
            };

            // while (date < finalDate) {

            let validate;
            let tariffType;
            let CEMEPrice;
            let TARPrice;

            //Validate all weekDays and all seasons
            validate = ceme.schedule.schedules.filter(elem => {
                return (elem.weekDays === "all" && elem.season === "all");
            });

            if (validate.length > 0) {
                //all weekDays and all seasons

                //Get tariff type
                tariffType = await getTariffType(validate, date);

                //Get ceme price
                CEMEPrice = await getCEMEPrice(ceme.plan, tariffType);

                //Get Tar Price
                TARPrice = await getTARPrice(ceme.tar, tariffType, voltageLevel);

            }
            else {

                //Validate all weekDays and distinguished by season
                validate = ceme.schedule.schedules.filter(elem => {
                    return (elem.weekDays === "all" && elem.season !== "all");
                });

                if (validate.length > 0) {
                    //all weekDays and distinguished by season
                    //Get season
                    let season = await getSeason(date);

                    //Filter by season
                    validate = validate.filter(elem => {
                        return elem.season === season;
                    });

                    //Get tariff type
                    tariffType = await getTariffType(validate, date);

                    //Get ceme price
                    CEMEPrice = await getCEMEPrice(ceme.plan, tariffType);

                    //Get Tar Price
                    TARPrice = await getTARPrice(ceme.tar, tariffType, voltageLevel);

                }
                else {

                    //validation distinguished days of the week and all seasons
                    validate = ceme.schedule.schedules.filter(elem => {
                        return (elem.weekDays !== "all" && elem.season === "all");
                    });

                    if (validate.length > 0) {
                        //distinguished days of the week and all seasons
                        //Get week day
                        let weekDay = await getWeekDays(date);

                        //Filter by week day
                        validate = validate.filter(elem => {
                            return elem.weekDays === weekDay;
                        });

                        //Get tariff type
                        tariffType = await getTariffType(validate, date);

                        //Get ceme price
                        CEMEPrice = await getCEMEPrice(ceme.plan, tariffType);

                        //Get Tar Price
                        TARPrice = await getTARPrice(ceme.tar, tariffType, voltageLevel);


                    }
                    else {

                        // distinguished days of the week and distinguished by season
                        //validation distinguished days of the week and distinguished by season
                        validate = ceme.schedule.schedules.filter(elem => {
                            return (elem.weekDays !== "all" && elem.season !== "all");
                        });

                        //all weekDays and distinguished by season
                        //Get season
                        let season = await getSeason(date);

                        //Filter by season
                        validate = validate.filter(elem => {
                            return elem.season === season;
                        });

                        //Get week day
                        let weekDay = await getWeekDays(date);

                        //Filter by week day
                        validate = validate.filter(elem => {
                            return elem.weekDays === weekDay;
                        });

                        //Get tariff type
                        tariffType = await getTariffType(validate, date);

                        //Get ceme price
                        CEMEPrice = await getCEMEPrice(ceme.plan, tariffType);

                        //Get Tar Price
                        TARPrice = await getTARPrice(ceme.tar, tariffType, voltageLevel);

                    };

                };

            };
            /*
            console.log("CEMEPrice", CEMEPrice);
            console.log("TARPrice", TARPrice);
            console.log("Total", CEMEPrice + TARPrice);
            */
            resolve(CEMEPrice + TARPrice);

            /*
            cont++
            date = new Date(date.getTime() + 1 * 60000);

        };*/


        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve(0);
        };
    });
};

function getTariffType(validate, date) {
    var context = "Function getTariffType";
    return new Promise(async (resolve, reject) => {
        try {

            let tariffType = validate.find(elem => {

                let period = elem.period.split('-');
                let hour = date.getHours() + 'h' + date.getMinutes();
                let startHour = period[0];
                let endHour = period[1];

                if (startHour <= hour && endHour > hour) {
                    return elem;
                };

            });

            resolve(tariffType.tariffType);

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve("");
        };
    });
};

function getCEMEPrice(plan, tariffType) {
    var context = "Function getCEMEPrice";
    return new Promise(async (resolve, reject) => {
        try {

            let CEMEPrice = plan.tariff.find(elem => {
                return elem.tariffType === tariffType;
            });

            resolve(CEMEPrice.price);

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve(0);
        };
    });
};

function getTARPrice(tar, tariffType, voltageLevel) {
    var context = "Function getCEMEPrice";
    return new Promise(async (resolve, reject) => {
        try {

            let TARPrice = tar.tariff.find(elem => {
                return (elem.tariffType === tariffType && elem.voltageLevel === voltageLevel);
            });

            resolve(TARPrice.price);

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve(0);
        };
    });
};

function getSeason(date) {
    var context = "Function getSeason";
    return new Promise(async (resolve, reject) => {


        let timeZone = date.getTimezoneOffset();

        if (timeZone === 0) {
            resolve('winter');
        }
        else {
            resolve('summer');
        };

        /* on backend
        let month = date.getMonth();


        if (month >= 0 && month <= 1 || month >= 10 && month <= 11) {
            resolve('winter');
        }
        else if (month >= 3 && month <= 8) {
            resolve('summer');
        }
        else if (month === 2) {
            console.log("month", month);
            let day = date.getDay();
            console.log("day", day);

            if(day>=1&&day<=24){
                resolve('winter');
            }
            else{

            }
        }
        else if (month === 9) {

        }*/

    });
};

function getWeekDays(date) {
    var context = "Function getWeekDays";
    return new Promise(async (resolve, reject) => {

        let weekDay = date.getUTCDay();
        // console.log("weekDay", weekDay);

        if (weekDay === 0) {
            resolve("sunday");
        }
        else if (weekDay === 6) {
            resolve("saturday");
        }
        else {
            resolve("2ª-6ª");
        };

    });
};


function getSessionEVIO(sessionId) {
    var context = "Function getSessionEVIO";
    return new Promise(async (resolve, reject) => {
        let host = process.env.ChargersServiceProxy + process.env.PathChargingSessionEVIO;
        let params = {
            _id: sessionId
        };

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve({ chargingSession: [] });
            });
    });
};

function getSessionMobiE(sessionId) {
    var context = "Function getSessionMobiE";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostChargingSessionMobie + process.env.PathChargingSessionMobie;
        let params = {
            _id: sessionId
        };

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve({ chargingSession: [] });
            });
    });
};




function addEVOwnerToSession() {
    var context = "Function addEVOwnerToSession";
    return new Promise((resolve, reject) => {


        let evio = new Promise((resolve, reject) => {
            var host = process.env.ChargersServiceProxy + '/api/private/chargingSession/runFirstTime';
            axios.post(host, {})
                .then((result) => {
                    resolve();
                    //resolve(result.data);
                })
                .catch((error) => {
                    resolve();
                    //reject(error.response.data);
                });
        });


        let mobie = new Promise((resolve, reject) => {
            var host = process.env.HostChargingSessionMobie + '/api/private/chargingSession/runFirstTime';
            axios.post(host, {})
                .then((result) => {
                    resolve();
                    //resolve(result.data);
                })
                .catch((error) => {
                    resolve();
                    //reject(error.response.data);
                });
        });

        Promise.all([evio, mobie])
            .then(() => {

                resolve();

            })
            .catch((error) => {
                console.log(`[${context}]`, error.message);
                reject(error);
            });
    });
};

function getKPIsUsers() {
    var context = "Function getKPIsUsers";
    return new Promise(async (resolve, reject) => {

        let host = process.env.IdentityHost + process.env.PathUsersKPIs;

        axios.get(host)
            .then((result) => {

                //console.log("result", result.data);
                resolve(result.data)

            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve({ numberOfUsers: 0 })
            });
    });
};

function getKPIsChargers() {
    var context = "Function getKPIsChargers";
    return new Promise(async (resolve, reject) => {

        let EVIOKPIs = {};
        let MobiEKPIs = {};

        let chargersKPIsEVIO = new Promise((resolve, reject) => {
            var host = process.env.ChargersServiceProxy + process.env.PathChargersKPIs;
            axios.get(host, {})
                .then((result) => {
                    //console.log(result.data);
                    //resolve();
                    EVIOKPIs = result.data
                    resolve();
                })
                .catch((error) => {
                    console.log(`[${host}] Error `, error.message);
                    EVIOKPIs = {
                        numberOfChargers: 0,
                        chargers: [],
                        totalPower: 0,
                        timeCharged: 0,
                        totalNumberOfSessions: 0
                    }
                    resolve();
                    //reject(error.response.data);
                });
        });

        let chargersKPIsMobiE = new Promise((resolve, reject) => {
            var host = process.env.HostChargingSessionMobie + process.env.PathSessionsKPIs;
            axios.get(host, {})
                .then((result) => {
                    console.log(result.data);
                    //resolve();
                    MobiEKPIs = result.data
                    resolve();
                })
                .catch((error) => {
                    console.log(`[${host}] Error `, error.message);
                    MobiEKPIs = {
                        totalPower: 0,
                        timeCharged: 0,
                        totalNumberOfSessions: 0
                    }
                    resolve();
                    //reject(error.response.data);
                });
        });



        Promise.all([chargersKPIsEVIO, chargersKPIsMobiE])
            .then(() => {

                let response = {
                    numberOfChargers: EVIOKPIs.numberOfChargers,
                    chargers: EVIOKPIs.chargers,
                    totalPower: EVIOKPIs.totalPower + MobiEKPIs.totalPower,
                    averageChargingTime: (EVIOKPIs.timeCharged + MobiEKPIs.timeCharged) / (EVIOKPIs.totalNumberOfSessions + MobiEKPIs.totalNumberOfSessions),
                    totalNumberOfSessions: EVIOKPIs.totalNumberOfSessions + MobiEKPIs.totalNumberOfSessions
                };
                resolve(response);

            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve({
                    numberOfChargers: 0,
                    chargers: [],
                    totalPower: 0,
                    averageChargingTime: 0,
                    totalNumberOfSessions: 0
                })
            });

    });
};

function monthlyBillingEVIO(data) {
    var context = "Function monthlyBillingEVIO";
    return new Promise(async (resolve, reject) => {

        let host = process.env.ChargersServiceProxy + process.env.PathMonthlyBilling;

        axios.get(host, { data })
            .then((result) => {
                //console.log("Result", result.data.length);

                if (result.data.length > 0) {

                    let totalcost_excl_vat = 0;
                    let totalcost_incl_vat = 0;
                    let sessionsId = [];
                    let lisSessions = result.data;

                    Promise.all(
                        result.data.map(session => {
                            return new Promise((resolve, reject) => {

                                //console.log("Sessions", session);

                                totalcost_excl_vat += session.totalPrice.excl_vat;
                                totalcost_incl_vat += session.totalPrice.incl_vat;
                                let newSessions = {
                                    sessionId: session._id,
                                    chargerType: session.chargerType
                                }
                                sessionsId.push(newSessions);

                                resolve(true)

                            });
                        })
                    ).then((result) => {

                        resolve({
                            totalcost_excl_vat: Number(totalcost_excl_vat.toFixed(2)),
                            totalcost_incl_vat: Number(totalcost_incl_vat.toFixed(2)),
                            sessionsId: sessionsId,
                            lisSessions: lisSessions
                        })

                    }).catch((error) => {
                        console.log(`[${context}][] Error `, error.message);

                        resolve({
                            totalcost_excl_vat: 0,
                            totalcost_incl_vat: 0,
                            sessionsId: [],
                            lisSessions: []
                        })

                    });

                }
                else {

                    resolve(null);
                    /*resolve({
                            totalcost_excl_vat: 0,
                            totalcost_incl_vat: 0,
                            sessionsId: [],
                            lisSessions: [],
                        })*/

                }
                //resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}][${host}] Error `, error.message);
                resolve(null);
                /*resolve({
                    totalcost_excl_vat: 0,
                    totalcost_incl_vat: 0,
                    sessionsId: [],
                    lisSessions: [],
                })*/

            });

    });
};

function drawInvoiceEVIO(chargingSessionsEVIO, userId) {
    var context = "Function drawInvoiceEVIO";
    return new Promise(async (resolve, reject) => {

        //console.log("chargingSessionsEVIO", chargingSessionsEVIO);
        let invoice = {
            paymentId: "",
            header: {
                userId: userId
            },
            lines: []

        };

        let lines = [];

        var footer = {
            total_exc_vat: chargingSessionsEVIO.totalcost_excl_vat,
            total_inc_vat: chargingSessionsEVIO.totalcost_incl_vat
        };

        var others = 0;
        var activationFee = 0;
        var attachLines = [];
        //others += activationFee;


        var totalTime = 0;
        var numberSessions = chargingSessionsEVIO.lisSessions.length;
        var totalPower = 0;
        var vatPriceEvio_network = 0;
        var vatPriceEvio_services = 0;
        //console.log("footer", footer);

        Promise.all(chargingSessionsEVIO.lisSessions.map(session => {
            return new Promise(async (resolve, reject) => {

                let invoiceLine = await getInvoiceLines(session);

                lines.push(invoiceLine);

                totalTime += session.timeCharged;
                totalPower += session.totalPower;


                let evioTimeCost = 0;
                let evioEnergyCost = 0;
                let use_energy = 0;
                let use_time = 0;

                if (session.tariffId !== "-1") {
                    if (session.tariff.tariffType === process.env.TariffByPower) {
                        evioEnergyCost = session.tariff.tariff.chargingAmount.value;
                        if (session.costDetails)
                            use_energy = session.costDetails.costDuringCharge;
                    } else {
                        evioTimeCost = session.tariff.tariff.chargingAmount.value;
                        if (session.costDetails)
                            use_time = session.costDetails.costDuringCharge;
                    };
                };

                if (session.costDetails) {
                    activationFee += session.costDetails.activationFee;
                    others += (session.costDetails.parkingDuringCharging + session.costDetails.parkingAmount);
                };

                vatPriceEvio_network += ((use_energy + use_time) * session.fees.IVA);

                if (session.costDetails)
                    vatPriceEvio_services += ((session.costDetails.activationFee + session.costDetails.parkingDuringCharging + session.costDetails.parkingAmount) * session.fees.IVA)

                let totalPowerSession = 0;
                let timeChargedSession = 0;
                let activationFeeSession = 0;
                let parkingDuringChargingSession = 0;
                let parkingAmountSession = 0;

                if (session.costDetails) {
                    totalPowerSession = session.costDetails.totalPower;
                    timeChargedSession = session.costDetails.timeCharged;
                    activationFeeSession = session.costDetails.activationFee;
                    parkingDuringChargingSession = session.costDetails.parkingDuringCharging;
                    parkingAmountSession = session.costDetails.parkingAmount;
                } else {
                    totalPowerSession = session.totalPower;
                    timeChargedSession = session.timeCharged;
                }

                let city;

                if (session.address) {
                    city = session.address.city
                } else {
                    city = "-"
                }

                if(session.localStartDate) {
                    session.startDate = session.localStartDate
                }

                var attachLine = {
                    "date": moment(session.startDate).format("DD/MM/YYYY"),
                    "startTime": moment(session.startDate).format("HH:mm"),//.getTime().format("HH:mm"),
                    "duration": new Date(session.timeCharged * 1000).toISOString().substr(11, 5),
                    "city": city,
                    "network": "EVIO",
                    "hwId": session.hwId,
                    "totalPower": totalPowerSession / 1000,
                    "charging_duration": new Date(timeChargedSession * 1000).toISOString().substr(11, 5),
                    "use_energy": use_energy,
                    "use_time": use_time,
                    "opcFlatCost": activationFeeSession,
                    "charging_parking": parkingDuringChargingSession,
                    "charging_after_parking": parkingAmountSession,
                    "total_exc_vat": session.totalPrice.excl_vat,
                    "vat": session.fees.IVA,
                    "total_inc_vat": session.totalPrice.incl_vat,
                }

                attachLines.push(attachLine);

                resolve(true);

            });

        })).then(() => {

            invoice.lines = lines;
            others += activationFee;

            //var vatPrice = 0.23//get iva

            var body = {
                invoice: invoice,
                attach: {
                    overview: {
                        footer: footer,
                        lines:
                        {
                            //evio_services: { total_exc_vat: others, vat: Number((others * vatPrice).toFixed(2)) },//todo review
                            //evio_network: { total_exc_vat: chargingSessionsEVIO.totalcost_excl_vat - others, vat: Number(((chargingSessionsEVIO.totalcost_excl_vat - others) * vatPrice).toFixed(2)) },
                            evio_services: { total_exc_vat: others, vat: Number(vatPriceEvio_services.toFixed(2)) },//todo review
                            evio_network: { total_exc_vat: chargingSessionsEVIO.totalcost_excl_vat - others, vat: Number(vatPriceEvio_network.toFixed(2)) },
                            mobie_network: { total_exc_vat: 0, vat: 0 },
                            other_networks: { total_exc_vat: 0, vat: 0. }
                        }

                    },
                    chargingSessions: {
                        header: {
                            sessions: numberSessions,
                            totalTime: new Date(totalTime * 1000).toISOString().substr(11, 8),
                            totalEnergy: totalPower + " KWh"
                        },
                        lines: attachLines,
                        footer: footer
                    }
                }
            };

            resolve(body);

        })
    });
};

function joinInvoiceEVIOOCPI(body, invoiceEVIO) {
    var context = "Function joinInvoiceEVIOOCPI";
    return new Promise(async (resolve, reject) => {

        //console.log("body.invoice", body.invoice);
        //body.invoice.lines = body.invoice.lines.concat(invoiceEVIO.invoice.lines);

        body.invoice.lines = await adjustLines(body.invoice.lines.concat(invoiceEVIO.invoice.lines));
        //console.log("body.invoice 1", body.invoice);
        //console.log("body", body.attach);
        //console.log("invoiceEVIO", invoiceEVIO.attach);
        let totalEnergyOCPI = body.attach.chargingSessions.header.totalEnergy.split(" ");
        let totalEnergyEVIO = invoiceEVIO.attach.chargingSessions.header.totalEnergy.split(" ");
        let totalEnergy = Number(totalEnergyOCPI[0]) + Number(totalEnergyEVIO[0]);

        let totalTimeOCPI = Date.parse("1970-01-01T" + body.attach.chargingSessions.header.totalTime);
        let totalTimeEVIO = Date.parse("1970-01-01T" + invoiceEVIO.attach.chargingSessions.header.totalTime);
        let totalTime = new Date(totalTimeOCPI + totalTimeEVIO).toISOString().substr(11, 8);

        var finalInvoice = {
            invoice: body.invoice,
            attach: {
                overview: {
                    footer: {
                        total_exc_vat: body.attach.overview.footer.total_exc_vat + invoiceEVIO.attach.overview.footer.total_exc_vat,
                        total_inc_vat: body.attach.overview.footer.total_inc_vat + invoiceEVIO.attach.overview.footer.total_inc_vat
                    },
                    lines: {
                        evio_services: {
                            total_exc_vat: body.attach.overview.lines.evio_services.total_exc_vat + invoiceEVIO.attach.overview.lines.evio_services.total_exc_vat,
                            vat: body.attach.overview.lines.evio_services.vat
                        },
                        evio_network: {
                            total_exc_vat: invoiceEVIO.attach.overview.lines.evio_network.total_exc_vat,
                            vat: invoiceEVIO.attach.overview.lines.evio_network.vat
                        },
                        mobie_network: {
                            total_exc_vat: body.attach.overview.lines.mobie_network.total_exc_vat,
                            vat: body.attach.overview.lines.mobie_network.vat
                        },
                        other_networks: {
                            total_exc_vat: body.attach.overview.lines.other_networks.total_exc_vat,
                            vat: body.attach.overview.lines.other_networks.vat
                        }
                    }
                },
                chargingSessions: {
                    header: {
                        sessions: body.attach.chargingSessions.header.sessions + invoiceEVIO.attach.chargingSessions.header.sessions,
                        totalTime: totalTime,
                        totalEnergy: totalEnergy + " KWh",
                    },
                    lines: body.attach.chargingSessions.lines.concat(invoiceEVIO.attach.chargingSessions.lines),
                    footer: {
                        footer: {
                            total_exc_vat: body.attach.chargingSessions.footer.total_exc_vat + invoiceEVIO.attach.chargingSessions.footer.total_exc_vat,
                            total_inc_vat: body.attach.chargingSessions.footer.total_inc_vat + invoiceEVIO.attach.chargingSessions.footer.total_inc_vat
                        },
                    }
                }
            }
        }

        //console.log("finalInvoice", finalInvoice);

        resolve(finalInvoice);
    });
};

function getInvoiceLines(session) {
    var context = "Function getLines";
    return new Promise((resolve, reject) => {

        let quantity;
        if (session.tariffId !== "-1") {
            switch (session.tariff.tariff.chargingAmount.uom.toUpperCase()) {
                case 'S':
                    quantity = session.timeCharged;
                    break;
                case 'MIN':
                    quantity = session.timeCharged / 60;
                    break;
                case 'H':
                    quantity = session.timeCharged / 3600;
                    break;
                case 'KWH':
                    quantity = session.totalPower / 1000;
                    break;
                default:
                    quantity = session.timeCharged / 60;
                    break;
            };
            unitPrice = session.tariff.tariff.chargingAmount.value;
            uom = session.tariff.tariff.chargingAmount.uom

        } else {
            quantity = session.timeCharged / 60;
        }

        quantity = parseFloat(quantity.toFixed(2));

        let line = {
            code: "ISERV21014",
            description: "Serviços rede EVIO",
            unitPrice: unitPrice,
            uom: uom,
            quantity: quantity,
            vat: session.fees.IVA,
            discount: 0,
            total: 0
        };
        if (session?.fees?.IVA == 0) {
            line.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
        }

        //console.log("line", line);

        resolve([line]);


        //console.log("session", session);




    });
};

function adjustLines(lines) {
    var context = "Function adjustLines";
    return new Promise(async (resolve, reject) => {


        let newInvoiceLines = [];
        //console.log("newInvoiceLines", newInvoiceLines);
        await lines.forEach(async line => {
            //console.log("Line", line);
            await line.forEach(obj => {
                // console.log("obj", obj);

                let found = newInvoiceLines.indexOf(newInvoiceLines.find(newLine => {
                    return (newLine.code === obj.code && newLine.description === obj.description && newLine.unitPrice === obj.unitPrice && newLine.uom === obj.uom && newLine.vat === obj.vat && newLine.discount === obj.discount)
                }));

                if (found >= 0) {
                    newInvoiceLines[found].quantity += 1;
                }
                else {
                    newInvoiceLines.push(obj);
                }
            })
        });

        //console.log("newInvoiceLines 1", newInvoiceLines);
        resolve(newInvoiceLines);

    });
};

function monthlyBillingOCPI(data) {
    var context = "Function monthlyBillingOCPI";
    return new Promise(async (resolve, reject) => {

        /*
        var test = {
            "body": {
                "invoice": {
                    "paymentId": "",
                    "header": {
                        "userId": "60dc8529bd4f660013b171f9"
                    },
                    "lines": [
                        [
                            {
                                "code": "ISERV21001",
                                "description": "Energia consumida Fora do Vazio BT",
                                "unitPrice": 0.09,
                                "uom": "KWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21005",
                                "description": "Tarifas Acesso às Redes Fora do Vazio BT",
                                "unitPrice": 0.001,
                                "uom": "KWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21011",
                                "description": "Tarifas de utilização dos OPC por min",
                                "unitPrice": 0.123,
                                "uom": "min",
                                "quantity": 0.1,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21012",
                                "description": "IEC – Imposto Especial sobre o Consumo",
                                "unitPrice": 0.001,
                                "uom": "kWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            }
                        ],
                        [
                            {
                                "code": "ISERV21001",
                                "description": "Energia consumida Fora do Vazio BT",
                                "unitPrice": 0.09,
                                "uom": "KWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21005",
                                "description": "Tarifas Acesso às Redes Fora do Vazio BT",
                                "unitPrice": 0.001,
                                "uom": "KWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21011",
                                "description": "Tarifas de utilização dos OPC por min",
                                "unitPrice": 0.123,
                                "uom": "min",
                                "quantity": 0.1,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21012",
                                "description": "IEC – Imposto Especial sobre o Consumo",
                                "unitPrice": 0.001,
                                "uom": "kWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            }
                        ],
                        [
                            {
                                "code": "ISERV21001",
                                "description": "Energia consumida Fora do Vazio BT",
                                "unitPrice": 0.09,
                                "uom": "KWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21005",
                                "description": "Tarifas Acesso às Redes Fora do Vazio BT",
                                "unitPrice": 0.001,
                                "uom": "KWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21011",
                                "description": "Tarifas de utilização dos OPC por min",
                                "unitPrice": 0.123,
                                "uom": "min",
                                "quantity": 0.1,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            },
                            {
                                "code": "ISERV21012",
                                "description": "IEC – Imposto Especial sobre o Consumo",
                                "unitPrice": 0.001,
                                "uom": "kWh",
                                "quantity": 0.01,
                                "vat": 0.23,
                                "discount": 0,
                                "total": 0
                            }
                        ]
                    ]
                },
                "attach": {
                    "overview": {
                        "footer": {
                            "total_exc_vat": 0.03,
                            "total_inc_vat": 0.06
                        },
                        "lines": {
                            "evio_services": {
                                "total_exc_vat": 0,
                                "vat": 23
                            },
                            "evio_network": {
                                "total_exc_vat": 0,
                                "vat": 0
                            },
                            "mobie_network": {
                                "total_exc_vat": 0.03,
                                "vat": 23
                            },
                            "other_networks": {
                                "total_exc_vat": 0,
                                "vat": 23
                            }
                        }
                    },
                    "chargingSessions": {
                        "header": {
                            "sessions": 3,
                            "totalTime": "00:08:35",
                            "totalEnergy": "10 KWh"
                        },
                        "lines": [
                            {
                                "date": "12/07/2021",
                                "startTime": "10:36",
                                "duration": "00:05:33",
                                "hwId": "MTS-00006",
                                "network": "MobiE",
                                "totalPower": 0,
                                "energyCost": 0,
                                "tar": 0,
                                "opcTimeCost": 0.09,
                                "opcEnergyCost": 0,
                                "opcFlatCost": 0,
                                "others": 0,
                                "total_exc_vat": 0.01
                            },
                            {
                                "date": "12/07/2021",
                                "startTime": "14:51",
                                "duration": "00:02:11",
                                "hwId": "MTS-00006",
                                "network": "MobiE",
                                "totalPower": 0,
                                "energyCost": 0,
                                "tar": 0,
                                "opcTimeCost": 0.09,
                                "opcEnergyCost": 0,
                                "opcFlatCost": 0,
                                "others": 0,
                                "total_exc_vat": 0.01
                            },
                            {
                                "date": "12/07/2021",
                                "startTime": "22:50",
                                "duration": "00:00:50",
                                "hwId": "MTS-00006",
                                "network": "MobiE",
                                "totalPower": 0,
                                "energyCost": 0,
                                "tar": 0,
                                "opcTimeCost": 0.09,
                                "opcEnergyCost": 0,
                                "opcFlatCost": 0,
                                "others": 0,
                                "total_exc_vat": 0.01
                            }
                        ],
                        "footer": {
                            "total_exc_vat": 0.03,
                            "total_inc_vat": 0.06
                        }
                    }
                }
            },
            "sessionIds": [
                {
                    "sessionId": "60ec1b1c14f00e0012a0ee3e",
                    "chargerType": "004"
                },
                {
                    "sessionId": "60ec56d84c78dc00129aadbb",
                    "chargerType": "004"
                },
                {
                    "sessionId": "60ecc72d4c78dc00129ab26e",
                    "chargerType": "004"
                }
            ]
        }

        resolve(test);
        */


        let host = process.env.HostChargingSessionMobie + process.env.PathMonthlyBilling;

        axios.get(host, { data })
            .then((result) => {
                //console.log("Result", result.data.length);
                resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve(null);
            });



    });
};

function validateRatingSession(session) {
    return new Promise((resolve, reject) => {

        if (!session._id)
            reject({ auth: false, code: 'server_session_id_required', message: "Session Id required" });

        if (!session.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else
            resolve();

    });
};

function getRoamingPlanTariff(params) {
    var context = "Function getRoamingPlanTariff";
    return new Promise((resolve, reject) => {
        try {
            var serviceProxy = process.env.HostPublicTariffs + process.env.PathGetRoamingPlanTariff;

            axios.get(serviceProxy, { params })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve({ tariff: [] });
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve({ tariff: [] });
        };
    });
};




function getRoamingTariffs(internationalNetwork) {
    var context = "Function getRoamingTariffs";
    return new Promise((resolve, reject) => {

        let host = process.env.HostPublicTariffs + process.env.PathGetRoamingTariffs;

        let params = {
            roamingType: internationalNetwork
        };

        let data = {
            _id: 1,
            roamingType: 1,
            tariffs: 1
        };

        axios.get(host, { data, params })
            .then((result) => {

                //console.log("result", result.data);
                ///console.log(result.data.find(tariff => { return tariff.roamingType === process.env.NetworkGireve })._id)
                resolve(result.data);

            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                //reject(error);
                resolve([
                    {
                        roamingType: process.env.NetworkGireve,
                        _id: ""
                    },
                    {
                        roamingType: process.env.NetworkHubject,
                        _id: ""
                    }
                ]);
            });
    });
};

function getCEMEEVIOLandingPage_old(internationalNetwork, clientName) {
    const context = "Function getCEMEEVIOLandingPage_old";
    return new Promise((resolve, reject) => {

        let proxy = process.env.HostPublicTariffs + process.env.PathGetCEMELandingPage;

        let planName;

        switch (clientName) {
            case process.env.WhiteLabelGoCharge:
                planName = "server_plan_EVIO_ad_hoc_goCharge"
                break;
            case process.env.WhiteLabelHyundai:
                planName = "server_plan_EVIO_ad_hoc_hyundai"
                break;
            default:
                planName = "server_plan_EVIO_ad_hoc"
                break;
        };

        let params = {
            planName: planName,
            roamingType: internationalNetwork
        };

        axios.get(proxy, { params })
            .then((result) => {
                if (result.data)
                    resolve(result.data);
                else
                    resolve({})
            })
            .catch((error) => {
                console.log(`[${context}] [${proxy}] Error `, error.message);
                //reject(error);
                resolve({})
            });
    });
};

function getCEMEEVIOLandingPage(internationalNetwork, clientName, userId) {
    const context = "Function getCEMEEVIOLandingPage";
    return new Promise(async (resolve, reject) => {

        let proxy = process.env.HostPublicTariffs + process.env.PathGetCEMELandingPage;
        let planName;

        if (clientName === process.env.clientNameACP) {

            try {
                let user = await getUserAccount(userId);

                if (user.activePartner) {
                    planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}_discount`;
                } else {
                    planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}`;
                };

            } catch (error) {
                console.log(`[${context}] [${proxy}] Error `, error.message);
                planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}`
            };

        } else {
            planName = `server_plan_EVIO_ad_hoc_${WLKeysMapping[clientName]}`
        };

        let params = {
            planName: planName,
            roamingType: internationalNetwork
        };

        axios.get(proxy, { params })
            .then((result) => {
                if (result.data)
                    resolve(result.data);
                else
                    resolve({})
            })
            .catch((error) => {
                console.log(`[${context}] [${proxy}] Error `, error.message);
                //reject(error);
                resolve({})
            });
    });
};




function makePaymentMonthly(sessions, userId, listOfSessionsMonthly) {
    var context = "Function makePaymentMonthly";
    return new Promise((resolve, reject) => {

        let host = process.env.HostPayments + process.env.PathPaymentMonthly;

        let data = {
            userId: userId,
            listOfSessionsMonthly: listOfSessionsMonthly,
            //status: "20",
            totalPrice: {
                excl_vat: sessions.total_exc_vat,
                incl_vat: sessions.total_inc_vat
            },
            amount: {
                currency: "EUR",
                value: sessions.total_inc_vat
            },
            paymentMethod: "other"
        };

        axios.post(host, data)
            .then((response) => {

                resolve(response.data);

            })
            .catch(error => {
                console.log(`[${context}][.catch] Error `, error.message);
                reject(error);
            });


    });
};

function sendToBilling(data, userId, sessionsIds, date) {
    var context = "Function sendToBilling";
    return new Promise((resolve, reject) => {

        //console.log("sessionsIds", sessionsIds);

        let sessionsEVIO = getSessionsIds(sessionsIds.filter(session => {
            return session.chargerType !== "004" && session.chargerType !== "010" && session.chargerType !== Enums.ChargerTypes.Hubject
        }));

        let sessionsOCPI = getSessionsIds(sessionsIds.filter(session => {
            return session.chargerType === "004" || session.chargerType === "010" || session.chargerType === Enums.ChargerTypes.Hubject
        }));

        //console.log("sessionsEVIO", sessionsEVIO);

        //console.log("sessionsOCPI", sessionsOCPI);

        let host = process.env.HostBilling + process.env.PathGenerateMonthlyBilling;

        axios.post(host, data, { headers: { 'userid': userId, 'startDate': date.startDate, 'endDate': date.endDate } })
            .then((response) => {

                if (typeof response.data !== 'undefined') {

                    if (sessionsEVIO.length > 0)
                        updateMultiSessionEVIOB2B(sessionsEVIO, { invoiceId: response.data._id, status: true });
                    if (sessionsOCPI.length > 0)
                        updateMultiSessionOCPI2B(sessionsOCPI, { invoiceId: response.data._id, status: true });

                    resolve(response.data);
                }
                else {

                    if (sessionsEVIO.length > 0)
                        updateMultiSessionEVIOB2B(sessionsEVIO, { invoiceId: "", status: false });
                    if (sessionsOCPI.length > 0)
                        updateMultiSessionOCPI2B(sessionsOCPI, { invoiceId: "", status: false });

                    resolve(false);
                }

            }).catch((error) => {

                if (sessionsEVIO.length > 0)
                    updateMultiSessionEVIOB2B(sessionsEVIO, { invoiceId: "", status: false });
                if (sessionsOCPI.length > 0)
                    updateMultiSessionOCPI2B(sessionsOCPI, { invoiceId: "", status: false });

                if (error.response) {
                    console.log(`[${context}][400] Error `, error.response.data.message);
                    reject(error);
                }
                else {
                    console.log(`[${context}][500] Error `, error.message);
                    reject(error);
                };
            });

    });
};

function getSessionsIds(sessions) {
    var context = "Function getSessionsIds";
    let sessionsId = [];
    if (sessions.length > 0) {

        sessions.forEach(session => {
            sessionsId.push(session.sessionId)
        });
        //console.log("payment.listOfSessions", sessionsId.length)
        return sessionsId;

    }
    else {
        return sessionsId;
    }

};

function updateMultiSessionEVIOB2B(sessions, invoice) {
    var context = "Function updateMultiSessionEVIOB2B";
    try {

        let params = {
            _id: sessions
        };

        let data = {
            invoiceId: invoice.invoiceId,
            invoiceStatus: invoice.status
        };

        let proxyCharger = process.env.ChargersServiceProxy + process.env.PathUpdateSessionInvoice;

        axios.patch(proxyCharger, data, { params })
            .then((result) => {
                //console.log("Result: ", result.data);
                console.log("Invoice created")
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
            });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);

    };
};

function updateMultiSessionOCPI2B(sessions, invoice) {
    var context = "Function updateMultiSessionOCPI2B";
    try {

        //TODO
        let data = {
            invoiceId: invoice.invoiceId,
            invoiceStatus: invoice.status,
            sessionId: sessions
        };

        let host = process.env.HostChargingSessionMobie + process.env.PathInvoiceStatusMonthlyBilling;

        axios.put(host, data)
            .then((result) => {
                //console.log("Result: ", result.data);
                console.log("Invoice created")
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
            });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);

    };
};

function validateBillingProfile(userId) {
    var context = "Function getActiveSessionsMyChargers";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.IdentityHost + process.env.PathValidateBilling;
            var headers = {
                userid: userId
            };

            axios.get(proxy, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.log(`[${context}][${proxy}] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function priceSimulationEVIO(plug, timeCharger, consumo, charger) {
    const context = "Function priceSimulationEVIO";
    return new Promise(async (resolve, reject) => {

        let initialCost = 0;
        let costByPower = 0;
        let costByTime = 0;
        let cemePrice = 0;
        let costEVIOPower = 0;
        let costEVIOTime = 0;

        if (plug.tariff.length > 0) {

            if (plug.tariff[0].tariffId) {

                initialCost = plug.tariff[0].tariff.activationFee;


                if (plug.tariff[0].tariffType === process.env.TariffTypeEnergyBase) {


                    costEVIOPower = plug.tariff[0].tariff.chargingAmount.value;

                    let totalPrice = calcTotalCost(initialCost, costByTime, timeCharger, costByPower, consumo, cemePrice, costEVIOTime, costEVIOPower, charger.fees);

                    //console.log("totalPrice", totalPrice);
                    resolve(totalPrice)
                } else {

                    if (plug.tariff[0].tariff.chargingAmount.uom === 's') {
                        //Convert from €/s to €/min
                        costEVIOTime = plug.tariff[0].tariff.chargingAmount.value * 60;
                    }
                    else if (plug.tariff[0].tariff.chargingAmount.uom === 'h') {
                        //Convert from €/h to €/min
                        costEVIOTime = plug.tariff[0].tariff.chargingAmount.value / 60;
                    }
                    else {
                        //Value in €/min
                        costEVIOTime = plug.tariff[0].tariff.chargingAmount.value;
                    };

                    let totalPrice = calcTotalCost(initialCost, costByTime, timeCharger, costByPower, consumo, cemePrice, costEVIOTime, costEVIOPower, charger.fees);

                    //console.log("totalPrice", totalPrice);


                    resolve(totalPrice)

                };

            } else {
                resolve(0);
            };

        } else {
            resolve(0);
        };

    });
};

function priceSimulationTesla(plug, timeCharger) {
    const context = "Function priceSimulationTesla";
    return new Promise(async (resolve, reject) => {
        let tariffTesla = await getTeslaTariff();

        //Tesla Model S Performance
        let capTotalBateriaEV = 100.00;
        let capCarregamentoEV;
        if (plug.power >= 50) {
            // Fastcharge_Power_Max
            capCarregamentoEV = 200.00;
        }
        else {
            // Charge_Standard_Power
            capCarregamentoEV = 16.50;
        };


        let value1 = (plug.power >= capCarregamentoEV) ? capCarregamentoEV : Math.min(plug.power, capTotalBateriaEV);
        let value2 = Math.min(timeCharger, (plug.power >= capCarregamentoEV ? (capTotalBateriaEV / capCarregamentoEV) : (capTotalBateriaEV / plug.power)) * 60) / 60;

        let consumo = value1 * value2;
        let totalPrice = consumo * tariffTesla.value;
        resolve(totalPrice);
    });
};



async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await DataPlugStatusChanger.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ", result);
            };
        })

        await DataPlugStatusChanger.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ", result);
            };
        })

        let dataPlugStatusChangers = await DataPlugStatusChanger.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != dataPlugStatusChangers.length; i++) {
            if (dataPlugStatusChangers[i].address)
                if (dataPlugStatusChangers[i].address.country)
                    if (unicCountries.indexOf(dataPlugStatusChangers[i].address.country) == -1) {
                        unicCountries.push(dataPlugStatusChangers[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await DataPlugStatusChanger.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return error
    }
}
// IMPORTANT: these methods are restored temporarily to be able to have two endpoints for the map at the same time, the original one and the new, clean version.
// This needs to be removed as soon as we are able to.
function priceSimulation(chargers, contractId, evId, priceRange, coordinates) {
    const context = "Function priceSimulation";
    return new Promise(async (resolve, reject) => {
        try {

            let capTotalBateriaEV;
            let capCarregamentoEV;
            let capCarregamentoInternaEV;
            let timeCharger = 30; //Time in min

            let sessionStartDate = moment.utc(new Date().toISOString()).format()
            let sessionStopDate = moment.utc(sessionStartDate).add(timeCharger, 'minutes').format()
            let contract = await getContractById(contractId);

            //console.log("contract", contract);
            //let newChargers = [];
            if (evId === "-1") {

                capTotalBateriaEV = 62.00; //ID3 Pro Type  2 CSS  >=2021
                capCarregamentoEV = 124.00; //ID3 Pro Type  2 CSS  >=2021
                capCarregamentoInternaEV = 11.00; //ID3 Pro Type  2 CSS  >=2021

            } else {

                let ev = await getEVByEvId(evId);
                //console.log("ev", ev);
                capTotalBateriaEV = ev.evInfo.maxBatteryCapacity;
                capCarregamentoEV = ev.evInfo.maxFastChargingPower ? ev.evInfo.maxFastChargingPower : ev.evInfo.internalChargerPower;
                capCarregamentoInternaEV = ev.evInfo.internalChargerPower;

            };

            let data = {
                contract: contract,
                timeCharger: timeCharger,
                sessionStartDate: sessionStartDate,
                sessionStopDate: sessionStopDate,
                capTotalBateriaEV: capTotalBateriaEV,
                capCarregamentoEV: capCarregamentoEV,
                capCarregamentoInternaEV: capCarregamentoInternaEV,
                chargers: chargers,
                priceRange: priceRange,
                coordinates: coordinates
            }

            let host = process.env.HostChargingSessionMobie + process.env.PathPriceSimulation;
            let newChargers = await axios.post(host, data)

            /**
             * Normalization of the data response, as the service for some types of chargers 
             * returns the price as a double and for others as an object. To minimize side effects, 
             * it was decided to make the change directly here, as this is where the rankings endpoint retrieves the price information.
             * Ticket: https://evio.atlassian.net/browse/EVIO-5980
             */
            resolve(newChargers.data.map((charger) => {
                return {
                    ...charger,
                    plugs: charger.plugs.map((plug) => {
                        return {
                            ...plug,
                            price: plug.price?.incl_vat ?? plug.price
                        }
                    })
                }
            }));

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};
function getContractById(contractId) {
    const context = "Function getContractById";
    return new Promise(async (resolve, reject) => {

        let host = process.env.IdentityHost + process.env.PathGetContractById + '/' + contractId

        try {
            let contract = await axios.get(host);
            resolve(contract.data);
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };

    });
};

function filterPrice(chargers, priceRange, clientName) {
    const context = "Function filterPrice";
    // TODO - Review
    return new Promise(async (resolve, reject) => {
        try {
            console.log("priceRange", priceRange);
            var capTotalBateriaEV = 62.00; //ID3 Pro Type  2 CSS  >=2021
            var capCarregamentoEV = 124.00; //ID3 Pro Type  2 CSS  >=2021
            let capCarregamentoInternaEV = 11.00; //ID3 Pro Type  2 CSS  >=2021
            let cemeEVIO = await getCEMEEVIO(clientName);
            let planCEME = cemeEVIO.plan;
            let tarCEME = cemeEVIO.tar;
            var timeCharger = 30; //Time in min
            var newChargers = [];
            let tariffTesla = await getTeslaTariff();

            var tarValue;
            var valueCeme;

            //Roaming Variables
            let sessionStartDate = moment.utc(new Date().toISOString()).format()
            let sessionStopDate = moment.utc(sessionStartDate).add(timeCharger, 'minutes').format()

            if (planCEME.tariffType === process.env.TariffTypeBiHour) {

                var currentTime = timeZoneMoment().tz('Europe/Lisbon').format("HH:mm")

                var tariffType = "server_empty";
                var TAR_Schedule = mobieScheduleTime.find(elem => elem.tariffType === planCEME.tariffType && elem.cycleType === planCEME.cycleType)//Taxa TAR

                if (currentTime >= '00:00' && currentTime <= '08:00') {
                    tariffType = TAR_Schedule.schedules[0].tariffType;
                }
                if (currentTime > '08:00' && currentTime <= '22:00') {
                    tariffType = TAR_Schedule.schedules[1].tariffType;
                }
                if (currentTime > '22:00' && currentTime <= '24:00') {
                    tariffType = TAR_Schedule.schedules[2].tariffType;
                }


                valueCeme = planCEME.tariff.find(tariff => {
                    return tariff.tariffType == tariffType;
                });

                //console.log("valueCeme", valueCeme);

                ValueTar = tarCEME.tariff.find(tar => {
                    return (tar.tariffType === tariffType && tar.voltageLevel === process.env.TariffVoltageLevelBTN);
                });

                //console.log("ValueTar", ValueTar);

                costEVIOCEME = valueCeme.price + ValueTar.price;

                //console.log("costEVIOCEME", costEVIOCEME);

            }
            else {

                valueCeme = planCEME.tariff.find(tariff => {
                    return tariff.tariffType == process.env.TariffRush;
                });

                //console.log("valueCeme 1", valueCeme);

                ValueTar = tarCEME.tariff.find(tar => {
                    return (tar.tariffType === process.env.TariffRush && tar.voltageLevel === process.env.TariffVoltageLevelBTN);
                });

                //console.log("ValueTar 1", ValueTar);

                costEVIOCEME = valueCeme.price + ValueTar.price;

                //console.log("costEVIOCEME 1", costEVIOCEME);

            };

            Promise.all(
                chargers.map(charger => {
                    return new Promise((resolve, reject) => {
                        if (charger.plugs.length != 0) {

                            if (charger.voltageLevel === undefined || charger.voltageLevel === "" || charger.voltageLevel === null) {
                                tarValue = tarCEME.tariff.find(elem => {
                                    return (elem.tariffType === (tariffType ? tariffType : process.env.TariffRush) && elem.voltageLevel === 'BTN');
                                });
                            }
                            else {
                                tarValue = tarCEME.tariff.find(elem => {
                                    return (elem.tariffType === (tariffType ? tariffType : process.env.TariffRush) && elem.voltageLevel === charger.voltageLevel);
                                });
                            };

                            let cemePrice = valueCeme ? valueCeme.price : 0 + tarValue ? tarValue.price : 0;

                            Promise.all(
                                charger.plugs.map(plug => {
                                    return new Promise(async (resolve, reject) => {

                                        if (plug.power === undefined) {
                                            resolve(false);
                                        }
                                        else {

                                            let value1;
                                            let value2;

                                            // Due to the uppercase/lowercase issue, I'm still verifying both scenarios here
                                            if (
                                                plug.connectorType === "CCS 1" ||
                                                plug.connectorType === "CCS 2" ||
                                                plug.connectorType === "CHAdeMO" ||
                                                plug.connectorType === "CHADEMO"
                                            ) {
                                                value1 = (plug.power >= capCarregamentoEV) ? capCarregamentoEV : Math.min(plug.power, capTotalBateriaEV);
                                                value2 = Math.min(timeCharger, (plug.power >= capCarregamentoEV ? (capTotalBateriaEV / capCarregamentoEV) : (capTotalBateriaEV / plug.power)) * 60) / 60;
                                            } else {
                                                value1 = (plug.power >= capCarregamentoInternaEV) ? capCarregamentoInternaEV : Math.min(plug.power, capTotalBateriaEV);
                                                value2 = Math.min(timeCharger, (plug.power >= capCarregamentoInternaEV ? (capTotalBateriaEV / capCarregamentoInternaEV) : (capTotalBateriaEV / plug.power)) * 60) / 60;
                                            }

                                            var consumo = value1 * value2;

                                            var publicNetworkChargerType = process.env.PublicNetworkChargerType;

                                            publicNetworkChargerType = publicNetworkChargerType.split(',');

                                            /*
                                            var found = publicNetworkChargerType.find(type => {
                                                return type === charger.chargerType;
                                            });
                                            */

                                            if (charger.chargerType == process.env.MobieCharger) {

                                                var costEVIOPower = 0;
                                                var costEVIOTime = 0;

                                                if (plug.serviceCost.initialCost == "-1" && plug.serviceCost.costByPower.cost == "-1" && plug.serviceCost.costByTime[0].cost == "-1") {
                                                    var initialCost = 0;
                                                    var costByPower = 0;
                                                    var costByTime = 0;

                                                    //TODO: We're making a request for each MobiE charger that has tariffId to tariffs in OCPI
                                                    // We should add this information in the public network charger model to save some requests
                                                    if (plug.tariffId.length > 0) {
                                                        let params = {
                                                            tariffId: plug.tariffId[0]
                                                        }
                                                        await getTariffOPC(params)
                                                            .then((result) => {
                                                                if (result) {
                                                                    plug.serviceCost = result
                                                                }
                                                                return
                                                            })
                                                            .catch(error => {
                                                                console.log(`[${context}] Error `, error.message);
                                                                resolve(false);
                                                            })
                                                        if (plug.serviceCost.initialCost != -1) {
                                                            initialCost = plug.serviceCost.initialCost;
                                                            costByPower = plug.serviceCost.costByPower.cost;

                                                            if (plug.serviceCost.costByTime.length > 1) {

                                                                var cost = plug.serviceCost.costByTime.find(costByTime => {
                                                                    return costByTime.maxTime == 30;
                                                                });
                                                                if (cost) {
                                                                    costByTime = cost.cost;
                                                                }
                                                                else {
                                                                    costByTime = plug.serviceCost.costByTime[0].cost;
                                                                };
                                                            }
                                                            else {
                                                                costByTime = plug.serviceCost.costByTime[0].cost;
                                                            };
                                                        }
                                                    }


                                                    let totalPrice = await calcTotalCost(initialCost, costByTime, timeCharger, costByPower, consumo, cemePrice, costEVIOTime, costEVIOPower, charger.fees);

                                                    //console.log("totalPrice", totalPrice);

                                                    if (totalPrice / timeCharger <= priceRange.max) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        resolve(false);
                                                    };
                                                    //resolve(false);
                                                }
                                                else {
                                                    var initialCost = plug.serviceCost.initialCost;
                                                    var costByPower = plug.serviceCost.costByPower.cost;

                                                    if (plug.serviceCost.costByTime.length > 1) {

                                                        var cost = plug.serviceCost.costByTime.find(costByTime => {
                                                            return costByTime.maxTime == 30;
                                                        });
                                                        if (cost) {
                                                            var costByTime = cost.cost;
                                                        }
                                                        else {
                                                            var costByTime = plug.serviceCost.costByTime[0].cost;
                                                        };
                                                    }
                                                    else {
                                                        var costByTime = plug.serviceCost.costByTime[0].cost;
                                                    };

                                                    let totalPrice = await calcTotalCost(initialCost, costByTime, timeCharger, costByPower, consumo, cemePrice, costEVIOTime, costEVIOPower, charger.fees);
                                                    //console.log("totalPrice", totalPrice);

                                                    if (totalPrice / timeCharger <= priceRange.max) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        resolve(false);
                                                    };

                                                };
                                                //resolve(false);
                                            } else if (charger.chargerType == process.env.TeslaCharger || charger.chargerType == process.env.OCMCharger) {

                                                //Tesla Model S Performance
                                                let capTotalBateriaEV = 100.00;
                                                let capCarregamentoEV;
                                                if (plug.power >= 50) {
                                                    // Fastcharge_Power_Max
                                                    capCarregamentoEV = 200.00;
                                                }
                                                else {
                                                    // Charge_Standard_Power
                                                    capCarregamentoEV = 16.50;
                                                };


                                                let value1 = (plug.power >= capCarregamentoEV) ? capCarregamentoEV : Math.min(plug.power, capTotalBateriaEV);
                                                let value2 = Math.min(timeCharger, (plug.power >= capCarregamentoEV ? (capTotalBateriaEV / capCarregamentoEV) : (capTotalBateriaEV / plug.power)) * 60) / 60;

                                                let consumo = value1 * value2;
                                                let totalPrice = consumo * tariffTesla.value;

                                                // resolve(true);
                                                if (totalPrice / timeCharger <= priceRange.max) {
                                                    //console.log("totalPrice true ", totalPrice / timeCharger);
                                                    resolve(true);
                                                }
                                                else {
                                                    //console.log("totalPrice false ", totalPrice / timeCharger);
                                                    resolve(false);
                                                };

                                            } else if (
                                                charger.chargerType === process.env.GireveCharger || 
                                                charger.chargerType === Enums.ChargerTypes.Hubject
                                            ) {

                                                // =============================== CEME =============================== //
                                                /*
                                                    //TODO: For now I'm using country code as region. This should probably be improved in the future.
                                                */
                                                // let params = {
                                                //     country: charger.countryCode,
                                                //     region: charger.countryCode,
                                                //     partyId: charger.partyId,
                                                //     roamingType: charger.source,
                                                //     evseGroup: charger.evseGroup,
                                                // }

                                                // let roamingTariff = await getRoamingPlanTariff(params)

                                                // let CEME_FLAT = roamingTariff.tariff.find(tariff => tariff.type === "flat")
                                                // let CEME_POWER = roamingTariff.tariff.find(tariff => tariff.type === "energy")
                                                // let CEME_TIME = roamingTariff.tariff.find(tariff => tariff.type === "time")

                                                // let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
                                                // let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
                                                // let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0

                                                // let totalTimeConsumed = timeCharger
                                                // if (CEME_TIME && CEME_TIME.uom.includes('h')) {
                                                //     totalTimeConsumed = timeCharger / 60
                                                // } else if (CEME_TIME && CEME_TIME.uom.includes('s')) {
                                                //     totalTimeConsumed = timeCharger * 60
                                                // }

                                                // let roamingCEME = CEME_Price_FLAT + CEME_Price_POWER * consumo + CEME_Price_TIME * totalTimeConsumed
                                                if (plug.serviceCost.initialCost === null || plug.serviceCost.initialCost === undefined) {
                                                    // =============================== CPO =============================== //

                                                    // Timezone info to get offset of charger
                                                    let timeZone = charger.timeZone
                                                    let countryCode = charger.countryCode
                                                    let offset = getChargerOffset(timeZone, countryCode)

                                                    let data = {
                                                        // elements: plug.serviceCost.elements,
                                                        sessionStartDate,
                                                        sessionStopDate,
                                                        offset,
                                                        power: plug.power,
                                                        total_energy: consumo,
                                                        total_charging_time: timeCharger / 60,
                                                        total_parking_time: 0,
                                                        countryCode,
                                                        partyId: charger.partyId,
                                                        source: charger.source,
                                                        evseGroup: plug.evseGroup,
                                                    }
                                                    let opcTariffs = await getOpcTariffsPrices(data)
                                                    let roamingOPC = opcTariffs.flat.price + opcTariffs.energy.price + opcTariffs.time.price + opcTariffs.parking.price

                                                    // let roamingOPC = 0

                                                    let totalPrice = roamingOPC

                                                    if (charger.fees != undefined) {
                                                        totalPrice += totalPrice * charger.fees.IVA;
                                                    };

                                                    if (totalPrice / timeCharger <= priceRange.max) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        resolve(false);
                                                    };
                                                } else {
                                                    var initialCost = plug.serviceCost.initialCost;
                                                    var costByPower = (plug.serviceCost.costByPower !== null && plug.serviceCost.costByPower !== undefined) ? plug.serviceCost.costByPower.cost : 0;
                                                    var costByTime = (plug.serviceCost.costByTime !== null && plug.serviceCost.costByTime !== undefined) ? plug.serviceCost.costByTime[0].cost : 0;



                                                    let totalPrice = initialCost + costByPower * consumo + costByTime * timeCharger
                                                    //console.log("totalPrice", totalPrice);
                                                    if (charger.fees != undefined) {
                                                        totalPrice += totalPrice * charger.fees.IVA;
                                                    };

                                                    if (totalPrice / timeCharger <= priceRange.max) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        resolve(false);
                                                    };
                                                }



                                            } else {

                                                //Charger EVIO NETWORK (With out CEME and TAR);
                                                var initialCost = 0;
                                                var costByPower = 0;
                                                var costByTime = 0;
                                                cemePrice = 0;

                                                if (plug.tariff.length != 0) {
                                                    if (plug.tariff[0].tariffId != "") {

                                                        if (plug.tariff[0].tariffType === process.env.TariffTypeEnergyBase) {
                                                            var costEVIOPower;
                                                            var costEVIOTime = 0;
                                                            // if (plug.tariff[0].tariff.chargingAmount.uom === "kWh") {
                                                            //     costEVIOPower = plug.tariff[0].tariff.chargingAmount.value;
                                                            // }
                                                            // else {
                                                            //     //convert value in €/kWh
                                                            //     costEVIOPower = plug.tariff[0].tariff.chargingAmount.value * 1000;
                                                            // }

                                                            //convert value in €/kWh

                                                            //Experiencia Diogo 17/03/2021. Tarifa será sempre em KWh, quando for por energy based.
                                                            costEVIOPower = plug?.tariff?.[0]?.tariff?.chargingAmount?.value ?? 0;


                                                            let totalPrice = await calcTotalCost(initialCost, costByTime, timeCharger, costByPower, consumo, cemePrice, costEVIOTime, costEVIOPower, charger.fees);
                                                            if (totalPrice / timeCharger <= priceRange.max) {
                                                                resolve(true);
                                                            }
                                                            else {
                                                                resolve(false);
                                                            };
                                                        }
                                                        else {

                                                            var costEVIOPower = 0;
                                                            var costEVIOTime;
                                                            if (plug?.tariff?.[0]?.tariff?.chargingAmount?.uom === 's') {
                                                                //Convert from €/s to €/min
                                                                costEVIOTime = (plug?.tariff?.[0]?.tariff?.chargingAmount?.value ?? 0) * 60;
                                                            }
                                                            else if (plug?.tariff?.[0]?.tariff?.chargingAmount?.uom === 'h') {
                                                                //Convert from €/h to €/min
                                                                costEVIOTime = (plug?.tariff?.[0]?.tariff?.chargingAmount?.value ?? 0) / 60;
                                                            }
                                                            else {
                                                                //Value in €/min
                                                                costEVIOTime = plug?.tariff?.[0]?.tariff?.chargingAmount?.value ?? 0;
                                                            };

                                                            let totalPrice = await calcTotalCost(initialCost, costByTime, timeCharger, costByPower, consumo, cemePrice, costEVIOTime, costEVIOPower, charger.fees);


                                                            if (totalPrice / timeCharger <= priceRange.max) {
                                                                resolve(true);
                                                            }
                                                            else {
                                                                resolve(false);
                                                            };
                                                        };
                                                    }
                                                    else {
                                                        resolve(false);
                                                    };
                                                }
                                                else {
                                                    resolve(false);
                                                };
                                            };
                                        };
                                    });
                                })
                            ).then((result) => {
                                //console.log("result", result)
                                var newResult = result.filter(value => {
                                    return value == true;
                                });
                                if (newResult.length == 0) {
                                    resolve(false);
                                }
                                else {
                                    newChargers.push(charger);
                                    resolve(true);
                                };
                            }).catch((error) => {
                                console.log(`[${context}] [Promise.all 2] Error `, error.message);
                                reject(error);
                            });
                        }
                        else {
                            resolve(true);
                        };
                    });
                })
            ).then((result) => {
                resolve(newChargers);
            }).catch((error) => {
                console.log(`[${context}] [Promise.all] Error `, error.message);
                reject(error);
            });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getTeslaTariff() {
    var context = "Function getTeslaTariff";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.TarriffServiceHost + process.env.PathTeslaTariff;
            var params = {
                active: true
            };

            axios.get(proxy, { params })
                .then((result) => {
                    if (result.data)
                        resolve(result.data);
                    else
                        resolve({
                            uom: 'KWh',
                            value: 0.262
                        })
                })
                .catch((error) => {
                    console.log(`[${context}] [${proxy}] Error `, error.message);
                    //reject(error);
                    resolve({
                        uom: 'KWh',
                        value: 0.262
                    })
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            //reject(error);
            resolve({
                uom: 'KWh',
                value: 0.262
            })
        };
    });
};

async function getTariffOPC(params) {
    var context = "Function getTariffOPC";
    return new Promise((resolve, reject) => {
        var host = process.env.HostChargingSessionMobie + process.env.PathGetOPCTariffs
        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    if (result.data.length != undefined) {
                        resolve({
                            initialCost: -1,
                            costByTime: [
                                {
                                    minTime: 0,
                                    cost: -1,
                                    uom: ""
                                }
                            ],
                            costByPower: {
                                cost: -1,
                                uom: ""
                            }
                        })
                    }
                    else {
                        resolve(result.data);
                    }

                }
                else {
                    resolve(null);
                }
            })
            .catch((error) => {
                if (error.response) {
                    console.log(`[${context}][get][.catch]`, error.response.data);
                    reject(error);
                }
                else {
                    console.log(`[${context}][get][.catch]`, error.message);
                    reject(error);
                }
            });
    });
};

function sortChargers(filterBy, newChargers, res) {
    const context = "Function sortChargers";
    return new Promise(async (resolve, reject) => {
        let chargersToResponse = []
        switch (filterBy) {
            case Enums.ChargerRankingFilters.FilterByPrice:

                if (newChargers.length <= 10) {
                    chargersToResponse = newChargers.sort((a, b) => (a.plugs[0].price > b.plugs[0].price) ? 1 : ((b.plugs[0].price > a.plugs[0].price) ? -1 : 0));
                } else {

                    newChargers.sort((a, b) => (a.plugs[0].price > b.plugs[0].price) ? 1 : ((b.plugs[0].price > a.plugs[0].price) ? -1 : 0));
                    chargersToResponse = await filterSamePrice(newChargers)

                };

                console.log("chargersToResponse.length 1", chargersToResponse.length)
                resolve(chargersToResponse);
                break;
            case Enums.ChargerRankingFilters.FilterByRelevance:

                if (newChargers.length <= 10) {
                    chargersToResponse = newChargers.sort((a, b) => (a.numberOfSessions > b.numberOfSessions) ? -1 : ((b.numberOfSessions > a.numberOfSessions) ? 1 : 0));
                } else {

                    newChargers.sort((a, b) => (a.numberOfSessions > b.numberOfSessions) ? -1 : ((b.numberOfSessions > a.numberOfSessions) ? 1 : 0));
                    chargersToResponse = await filterSameRelevance(newChargers)

                };

                console.log("chargersToResponse.length 2", chargersToResponse.length)
                resolve(chargersToResponse);
                break;
            case Enums.ChargerRankingFilters.FilterByDistance:

                if (newChargers.length <= 10) {
                    chargersToResponse = newChargers.sort((a, b) => (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0));
                } else {

                    newChargers.sort((a, b) => (a.distance > b.distance) ? 1 : ((b.distance > a.distance) ? -1 : 0));
                    //chargersToResponse = newChargers = newChargers.slice(0, 10);
                    chargersToResponse = await filterSameDistance(newChargers)

                };

                console.log("chargersToResponse.length 3", chargersToResponse.length)
                resolve(chargersToResponse);
                break;
            default:
                return res.status(400).send({ auth: false, code: 'server_filter_not_valid', message: "Filter not valid" });
        }
    });
};

function filterSameRelevance(newChargers) {
    const context = "Function filterSameRelevance";
    return new Promise(async (resolve, reject) => {
        let chargersToResponse = [];
        for (const charger of newChargers) {

            if (chargersToResponse.length === 10) {
                break;
            } else if (chargersToResponse.length === 0) {
                chargersToResponse.push(charger);
            } else {

                let index = chargersToResponse.indexOf(chargersToResponse.find(chargerToResponse => {
                    return (chargerToResponse.numberOfSessions === charger.numberOfSessions && charger.distance == chargerToResponse.distance);
                }));

                if (index > -1) {
                    let found = chargersToResponse[index].plugs.find(plug => { return plug.status == "10" })
                    if (!found) {
                        let found = charger.plugs.find(plug => { return plug.status == "10" })
                        if (found) {
                            chargersToResponse[index] = charger
                        }
                    }
                } else {
                    chargersToResponse.push(charger);
                };

            };
        };
        resolve(chargersToResponse)
    });
}


function filterSamePrice(newChargers) {
    const context = "Function filterSamePrice";
    return new Promise(async (resolve, reject) => {
        let chargersToResponse = [];
        for (const charger of newChargers) {

            if (chargersToResponse.length === 10) {
                break;
            } else if (chargersToResponse.length === 0) {
                chargersToResponse.push(charger);
            } else {

                let index = chargersToResponse.indexOf(chargersToResponse.find(chargerToResponse => {
                    return (chargerToResponse.plugs[0].price === charger.plugs[0].price && charger.distance === chargerToResponse.distance);
                }));

                if (index > -1) {

                    let found = chargersToResponse[index].plugs.find(plug => { return plug.status == "10" })
                    if (!found) {
                        let found = charger.plugs.find(plug => { return plug.status == "10" })
                        if (found) {
                            chargersToResponse[index] = charger
                        }
                    }

                } else {
                    chargersToResponse.push(charger);
                };

            };
        };
        resolve(chargersToResponse)
    });
}

function filterSameDistance(newChargers) {
    const context = "Function filterSameDistance";
    return new Promise(async (resolve, reject) => {
        let chargersToResponse = [];
        for (const charger of newChargers) {

            if (chargersToResponse.length === 10) {
                break;
            } else if (chargersToResponse.length === 0) {
                chargersToResponse.push(charger);
            } else {

                let index = chargersToResponse.indexOf(chargersToResponse.find(chargerToResponse => {
                    return (chargerToResponse.distance === charger.distance);
                }));

                if (index > -1) {
                    let found = chargersToResponse[index].plugs.find(plug => { return plug.status == "10" })
                    if (!found) {
                        let found = charger.plugs.find(plug => { return plug.status == "10" })
                        if (found) {
                            chargersToResponse[index] = charger
                        }
                    }
                } else {
                    chargersToResponse.push(charger);
                };

            };
        };
        resolve(chargersToResponse)
    });
}

async function verifyStations(filter, userId) {
    var context = "Function verifyStations";
    try {

        let publicStations = filter.stations.find((station) => {
            return station === process.env.StationsPublic;
        });

        let privateStations = filter.stations.find((station) => {
            return station === process.env.StationsPrivate;
        });

        let evio = filter.stations.find((station) => {
            return station === process.env.StationsEVIO;
        });

        let tesla = filter.stations.find((station) => {
            return station === process.env.StationsTesla;
        });

        let result = {
            data: {},
            dataPublic: {},
            type: ""
        };

        if (privateStations === process.env.StationsPrivate && publicStations === undefined && evio === undefined && tesla === undefined) {
            //Private
            if (userId === undefined) {
                //Sem ID
                let data = {};
                let dataPublic = {};
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsEVIO;
                return result;
            }
            else {
                //Com ID
                let data = { createUser: userId };
                let dataPublic = {};
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsEVIO;
                return result;
            };
        }
        else if (privateStations === undefined && publicStations === process.env.StationsPublic && evio === undefined && tesla === undefined) {
            //Public
            let data = {}
            let dataPublic = await queryCreation(filter);
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = process.env.StationsPublic;
            return result;
        }
        else if (privateStations === undefined && publicStations === undefined && evio === process.env.StationsEVIO && tesla === undefined) {
            //EVIO
            let data = await queryCreation(filter);
            let dataPublic = {};
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = process.env.StationsEVIO;
            return result;
        }
        else if (privateStations === undefined && publicStations === undefined && evio === undefined && tesla === process.env.StationsTesla) {
            //Tesla
            let data = {}
            let dataPublic = await queryCreation(filter);
            dataPublic.chargerType = '009'
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = process.env.StationsTesla;
            return result;
        }
        else if (privateStations === process.env.StationsPrivate && publicStations === process.env.StationsPublic && evio === undefined && tesla === undefined) {
            //Private + Public
            if (userId === undefined) {
                //Sem ID
                var data = {};
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsPublic;
                return result;
            }
            else {
                //Com ID
                var data = { createUser: userId };
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            };
        }
        else if (privateStations === process.env.StationsPrivate && publicStations === undefined && evio === process.env.StationsEVIO && tesla === undefined) {
            //Private + EVIO
            if (userId === undefined) {
                //Sem ID
                let data = await queryCreation(filter);
                var dataPublic = {};
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsEVIO;
                return result;
            }
            else {
                //Com ID
                let data = await queryCreation(filter);
                data.createUser = userId
                var dataPublic = {};
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsEVIO;
                return result;
            };

        }
        else if (privateStations === undefined && publicStations === process.env.StationsPublic && evio === process.env.StationsEVIO && tesla === undefined) {
            //Public + EVIO
            let data = await queryCreation(filter);
            let dataPublic = await queryCreation(filter);
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = "";
            return result;
        }
        else if (privateStations === undefined && publicStations === process.env.StationsPublic && evio === undefined && tesla === process.env.StationsTesla) {
            //Public + Tesla
            let data = {}
            let dataPublic = await queryCreation(filter);
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = process.env.StationsPublic;
            return result;
        }
        else if (privateStations === undefined && publicStations === undefined && evio === process.env.StationsEVIO && tesla === process.env.StationsTesla) {
            //Tesla + EVIO
            let data = await queryCreation(filter);
            let dataPublic = await queryCreation(filter);
            dataPublic.chargerType = '009'
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = "";
            return result;
        }
        else if (privateStations === process.env.StationsPrivate && publicStations === undefined && evio === undefined && tesla === process.env.StationsTesla) {
            //Private + Tesla
            if (userId === undefined) {
                //Sem ID
                let data = {};
                let dataPublic = await queryCreation(filter);
                dataPublic.chargerType = '009'
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsTesla;
                return result;
            }
            else {
                //Com ID
                let data = { createUser: userId };
                let dataPublic = await queryCreation(filter);
                dataPublic.chargerType = '009'
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            };
        }
        else if (privateStations === process.env.StationsPrivate && publicStations === process.env.StationsPublic && evio === process.env.StationsEVIO && tesla === undefined) {
            //Private + Public + EVIO
            if (userId === undefined) {
                //Sem ID
                let data = await queryCreation(filter);
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsPublic;
                return result;
            }
            else {
                //Com ID
                let data = await queryCreation(filter);
                data.createUser = userId
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            };
        }
        else if (privateStations === process.env.StationsPrivate && publicStations === process.env.StationsPublic && evio === undefined && tesla === process.env.StationsTesla) {
            //Private + Public + Tesla
            if (userId === undefined) {
                //Sem ID
                let data = {};
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsPublic;
                return result;
            }
            else {
                //Com ID
                let data = { createUser: userId };
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            };
        }
        else if (privateStations === process.env.StationsPrivate && publicStations === undefined && evio === process.env.StationsEVIO && tesla === process.env.StationsTesla) {
            //Private + EVIO + Tesla
            if (userId === undefined) {
                //Sem ID
                let data = await queryCreation(filter);
                let dataPublic = await queryCreation(filter);
                dataPublic.chargerType = '009'
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = process.env.StationsPublic;
                return result;
            }
            else {
                //Com ID
                let data = await queryCreation(filter);
                data.createUser = userId
                let dataPublic = await queryCreation(filter);
                dataPublic.chargerType = '009'
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            };
        }
        else if (privateStations === undefined && publicStations === process.env.StationsPublic && evio === process.env.StationsEVIO && tesla === process.env.StationsTesla) {
            //Public + EVIO + Tesla
            let data = await queryCreation(filter);
            let dataPublic = await queryCreation(filter);
            result.data = data;
            result.dataPublic = dataPublic;
            result.type = "";
            return result;
        }
        else {
            //Private + Public + EVIO + Tesla
            if (userId !== undefined) {
                //Sem ID
                let data = await queryCreation(filter);
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            }
            else {
                //Com ID
                let data = await queryCreation(filter);
                data.createUser = userId
                let dataPublic = await queryCreation(filter);
                result.data = data;
                result.dataPublic = dataPublic;
                result.type = "";
                return result;
            };
        };
        //return result;
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        throw new Error(error);
    };
};

function getUserIdWillPay(contract, evs, userId) {
    const context = "Function getUserIdWillPay";
    try {
        const ev = evs.find(e => e._id.toString() === contract.evId);

        if (!ev) {
            console.warn(`No EV found for contract with evId: ${contract.evId}`);
            return contract.userId;
        }
    
        const companyWillPay = Array.isArray(ev.listOfDrivers)
            ? ev.listOfDrivers.find(driver => driver.userId === userId && driver.paymenteBy === 'myself')
            : null;
    
        if (!companyWillPay) {
            console.warn(`No driver found for evId: ${contract.evId} with userId: ${userId} and paymenteBy: 'myself'`);
            return userId;
        }
        return contract.userId;
    } catch (error) {
        console.log(`[${context}] Error `, error);
    };
}

async function getHistory(session) {
    try {
        if (!session?.sessionId) {
            throw new Error("sessionId is required");
        }

        const baseUrl = `${process.env.HostStatistics}${process.env.GetHistoryBySessionId}`;
        const response = await axios.get(baseUrl, { params: { sessionId: session.sessionId } });

        console.log('[getHistory] Success:', response.data);
        return response.data;
    } catch (error) {
        console.error('[getHistory] Error:', error.response?.data || error.message);
        throw error;
    }
}

var server = http.createServer(app);

server.listen(port, () => {
    console.log(`Running on port ${port}`);
});

