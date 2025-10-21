require("dotenv-safe").load();
const express = require('express');
const Excel = require('exceljs');
const nodemailer = require("nodemailer");
const ObjectId = require('mongoose').Types.ObjectId;
const router = express.Router();
const Payments = require('../models/payments');
const Transaction = require('../models/transactions');
const PaymentMethod = require('../models/paymentMethod');
const Wallet = require('../models/wallet');
const Transactions = require('../models/transactions');
const NotificationsPayments = require('../models/notificationsPayments');
const ListPaymentMethod = require('../models/listPaymentMethod');
const Plafond = require('../models/plafond');
const UUID = require('uuid-js');
const moment = require('moment');
const timeZoneMoment = require('moment-timezone');
const axios = require("axios");
const toggle = require('evio-toggle').default;
const { wallet: walletConfig } = require('../utils/constants');
const RequestHistoryLogs = require('../handlers/requestHistoryLogsHandler');

// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const Invoices = require('../handlers/invoices');
const ChargerTypes = require('../globals/chargerTypes.json');
const mobieScheduleTime = require('../models/schedulesCEME.json');
const PreAuthorize = require('../models/preAuthorize');
const ErrorHandler = require('../handlers/errorHandler');
const PaymentsHandler = require('../handlers/payments');
const nodemailerS = require("../services/nodemailer");
const AxiosHandler = require("../services/axios");
const ExternalRequest = require("../handlers/externalRequest");
const UserPaymentConfiguration = require('../models/userPaymentConfigurations')
const axiosS = require('../services/axios')
const chargingSessionsService = require('../services/chargingSession')
const { StatusCodes } = require('http-status-codes');
const paymentsController = require('../controllers/payments');

const { getEVById } = require('../services/evs');
const { Enums } = require('evio-library-commons').default;

const Sentry = require('@sentry/node');

const { Client, Config, CheckoutAPI, Modification, Recurring, ClassicIntegrationAPI } = require('@adyen/api-library');
const { Number } = require('mongoose');

const PreAuthorization = require('../models/preauthorization');
const Configs = require('../models/configs');

const Constants = require('../utils/constants')


const {CodeTranslationsPushNotifications, notifyAccountLowBalance } = require('evio-library-notifications').default;

//EVIO
const config = new Config();
var client;
var adyenMerchantAccount;

//Salvador Caetano
const configSC = new Config();
var clientSC;
var adyenMerchantAccountSC;

switch (process.env.NODE_ENV) {
    case 'production':

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccount;
        config.apiKey = process.env.AdyenAPIKEY;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config, environment: 'LIVE', liveEndpointUrlPrefix: '1e2f35e905cd5681-evioelectricalmobility' });
        //config.apiKey = process.env.AdyenAPIKEYTest;
        //config.AdyenMerchantAccount = adyenMerchantAccount;
        //client = new Client({ config });
        //client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountSC;
        configSC.apiKey = process.env.AdyenAPIKEYSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC, environment: 'LIVE', liveEndpointUrlPrefix: '328e099768bec969-SalvadorCaetanoGroup' });

        break;
    case 'development':

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccountTest;
        config.apiKey = process.env.AdyenAPIKEYTest;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config });
        //hostAdyen = "https://pal-test.adyen.com/pal/servlet/Payment/v64";
        client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountTestSC;
        configSC.apiKey = process.env.AdyenAPIKEYTestSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC });
        clientSC.setEnvironment("TEST");

        break;
    case 'pre-production':

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccountTest;
        config.apiKey = process.env.AdyenAPIKEYTest;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config });
        //hostAdyen = "https://pal-test.adyen.com/pal/servlet/Payment/v64";
        client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountTestSC;
        configSC.apiKey = process.env.AdyenAPIKEYTestSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC });
        clientSC.setEnvironment("TEST");

        console.log("Initing pre environment")

        break;
    default:

        //EVIO
        adyenMerchantAccount = process.env.AdyenMerchantAccountTest;
        config.apiKey = process.env.AdyenAPIKEYTest;
        config.merchantAccount = adyenMerchantAccount;
        client = new Client({ config });
        //hostAdyen = "https://pal-test.adyen.com/pal/servlet/Payment/v64";
        client.setEnvironment("TEST");

        //Salvador Caetano
        adyenMerchantAccountSC = process.env.AdyenMerchantAccountTestSC;
        configSC.apiKey = process.env.AdyenAPIKEYTestSC;
        configSC.merchantAccount = adyenMerchantAccountSC;
        clientSC = new Client({ config: configSC });
        clientSC.setEnvironment("TEST");

        break;
};

//EVIO
const checkout = new CheckoutAPI(client);
// const modification = new Modification(client);
const modification = new ClassicIntegrationAPI(client);

//Salvador Caetano
const checkoutSC = new CheckoutAPI(clientSC);
// const modificationSC = new Modification(clientSC);
const modificationSC = new ClassicIntegrationAPI(clientSC);

//========== POST ==========
//Create a payment
router.post('/api/private/payments', (req, res, next) => {
    var context = "POST /api/private/payments";
    try {

        console.log(`[${context}] req.body `, req.body);

        const userId = (req.headers['userid'] != undefined) ? req.headers['userid'] : req.body.userId;

        if (!userId) {
            const message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res.status(400).send(message);
        }

        const payments = new Payments(req.body);
        payments.amount.value = Math.abs(payments.amount.value);
        payments.amount.value = Math.abs(parseFloat(payments.amount.value.toFixed(2)));
        console.log(`[${context}] payments`, payments);


        validateFields(payments)
            .then(() => {

                payments.userId = userId;
                payments.status = process.env.PaymentStatusStartPayment;

                Payments.createPayments(payments, (err, paymentCreated) => {
                    if (err) {

                        console.error(`[${context}] Error `, err.message);
                        res.status(500).send(err.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                        return res;

                    }
                    else {

                        //console.log("paymentCreated", paymentCreated);

                        makePayment(paymentCreated)
                            .then((response) => {
                                //console.log("response", response)
                                res.status(200).send(response);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, response);
                                return res;
                            })
                            .catch((error) => {
                                console.error(`[${context}][makePayment] Error `, error.message);
                                res.status(500).send(error.message);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                                return res;
                            });

                    };
                });

            })
            .catch((error) => {
                console.error(`[${context}] Error`, error);
                res.status(400).send(error);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                return res;
            });

        

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Create a payment monthly
router.post('/api/private/payments/monthly', (req, res, next) => {
    var context = "POST /api/private/payments/monthly";
    try {

        //console.log("req.body", req.body);
        const payments = new Payments(req.body);

        var userId;
        if (req.headers['userid'] != undefined) {

            userId = req.headers['userid'];

        }
        else {

            userId = req.body.userId;

        };

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            validateFieldsMonthly(payments)
                .then(() => {
                    payments.paymentType = process.env.PaymentTypeMonthly;
                    payments.userId = userId;
                    payments.status = process.env.PaymentStatusStartPayment;

                    Payments.createPayments(payments, (err, paymentCreated) => {
                        if (err) {

                            console.error(`[${context}] Error `, err.message);
                            res.status(500).send(err.message);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                            return res;

                        }
                        else {

                            makePayment(paymentCreated)
                                .then((result) => {

                                    res.status(200).send(result);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                                    return res;

                                })
                                .catch((error) => {

                                    console.error(`[${context}][makePayment] Error `, error.message);
                                    res.status(500).send(error.message);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                                    return res;

                                });

                        };
                    });
                })
                .catch((error) => {

                    res.status(400).send(error);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Create a payment physical card
router.post('/api/private/payments/physicalCard', (req, res, next) => {
    const context = "POST /api/private/payments/physicalCard";
    try {

        PaymentsHandler.createPaymentPhysicalCard(req)
            .then((response) => {
                return res.status(200).send(response);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                ErrorHandler.ErrorHandler(req, error, res);
            })

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(req, error, res);

    };
});

//Create a payment monthly
router.post('/api/private/payments/monthlyB2B', async (req, res, next) => {
    var context = "POST /api/private/payments/monthlyB2B";
    try {
        let payment;    

        const featureFlagEnabled = await toggle.isEnable('reprocess-attach-of-sessions-6739');
        if(featureFlagEnabled) {
            console.log(`[${context}][FEATUREFLAG][reprocess-attach-of-sessions-6739]`)
        
            //Check if the payment already exists before creating it, if it already exists return that payment
            payment = await Payments.findOne({ "listOfSessionsMonthly.sessionId": req.body.listOfSessionsMonthly[0].sessionId });

            if(payment) {
                res.status(200).send(payment);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, payment);
                return res;
            }
        }

        payment = new Payments(req.body);
        payment.paymentType = process.env.PaymentTypeMonthly;
        payment.status = process.env.PaymentStatusWaitingCapturByEVIO;

        const transaction = new Transactions(req.body);
        transaction.status = process.env.TransactionStatusWaitingCapturByEVIO;
        transaction.transactionType = process.env.TransactionTypeDebit;
        transaction.provider = process.env.TransactionProviderCreditOther;
        transaction.paymentId = payment._id

        Transactions.createTransactions(transaction, (error, transaction) => {
            if (error) {
                console.error(`[${context}] Error `, error.message);
                res.status(500).send(error.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                return res;
            } else {
                payment.transactionId = transaction._id;

                Payments.createPayments(payment, (error, payment) => {
                    if (error) {
                        console.error(`[${context}] Error `, error.message);
                        res.status(500).send(error.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                        return res;
                    }
                    else {

                        updateSessions(payment);
                        res.status(200).send(payment);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, payment);
                        return res;

                    };
                });
            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.post('/api/private/payments/periodicPayments', async (req, res, next) => {
    var context = "POST /api/private/payments/periodicPayments";
    try {

        //console.log("req.body", req.body);
        const payments = new Payments(req.body);

        var userId;
        if (req.headers['userid'] != undefined) {

            userId = req.headers['userid'];

        } else {

            userId = req.body.userId;

        };

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        };

        var listPaymentMethod = await ListPaymentMethod.findOne({ userId: userId });

        if (listPaymentMethod && listPaymentMethod.paymentMethod.length === 1) {

            payments.paymentMethod = listPaymentMethod.paymentMethod[0];

        } else {

            let walletAmount = await Wallet.findOne({ userId: userId }, { amount: 1 });

            if (walletAmount.amount.value >= payments.amount.value) {

                payments.paymentMethod = process.env.PaymentMethodWallet;

            } else {

                payments.paymentMethod = process.env.PaymentMethodCard;

            };

        };

        //payments.paymentType = process.env.PaymentTypeMonthly;
        payments.userId = userId;
        payments.status = process.env.PaymentStatusStartPayment;

        console.log("payments", payments);

        Payments.createPayments(payments, (err, paymentCreated) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                return res;

            } else {

                makePaymentPeriodic(paymentCreated)
                    .then((result) => {

                        res.status(200).send(result);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                        return res;

                    })
                    .catch((error) => {

                        console.error(`[${context}][makePayment] Error `, error.message);
                        res.status(500).send(error.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                        return res;

                    });

            };
        });



    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.post('/api/private/payments/tests', (req, res, next) => {
    var context = "POST /api/private/payments";
    try {

        //console.log("req.body", req.body);
        const payments = new Payments(req.body);

        //console.log("payments", payments);

        if (req.headers['userid'] != undefined) {

            var userId = req.headers['userid'];

        }
        else {

            var userId = req.body.userId;

        };

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            validateFields(payments)
                .then(() => {

                    payments.userId = userId;
                    payments.status = process.env.PaymentStatusStartPayment;

                    Payments.createPayments(payments, (err, result) => {
                        if (err) {

                            console.error(`[${context}] Error `, err.message);
                            res.status(500).send(err.message);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                            return res;

                        }
                        else {

                            // makePayment(result)
                            //     .then((result) => {



                            var result = {
                                paymentType: 'monthly',
                                userId: '5f3a44301903e4002af2b77e',
                                _id: '1235555555999',
                                chargerType: '004',
                                paymentMethod: 'card',
                                listOfSessions: [],
                                status: '40',
                                paymentAdyenId: '882613146577823A',
                                transactionId: '6026a9d1ba516804a6c6460f'
                            }

                            res.status(200).send(result);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                            return res;

                            // })
                            // .catch((error) => {

                            //     console.error(`[${context}][makePayment] Error `, err);
                            //     res.status(500).send(error);
                            //     RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                            //     return res;

                            // });

                        };
                    });

                })
                .catch((error) => {

                    res.status(400).send(error);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        };
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Job Check Payments
router.post('/api/job/checkPayments', (req, res) => {
    var context = "POST /api/job/checkPayments";
    try {
        checkPayments();
        return res.status(StatusCodes.OK).send(`${context} - Process completed successfully`);
    } catch (error) {
        console.error(`[${context}] Error:`, error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
});

router.post('/api/private/payments/job/checkPayments/startJob', (req, res) => {
    var context = "POST /api/private/payments/job/checkPayments/startJob";
    var timer = "*/30 * * * *";

    if (req.body.timer)
        timer = req.body.timer;

    initJobCheckPayments(timer).then(() => {
        taskPayments.start();
        console.log("Check payments Job Started")
        return res.status(200).send('Check payments Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });

});

router.post('/api/private/payments/job/checkPayments/stopJob', (req, res) => {

    taskPayments.stop();
    console.log("Check payments Job Stopped")
    return res.status(200).send('Check payments Job Stopped');

});

router.post('/api/private/payments/job/checkPayments/statusJob', (req, res) => {

    var status = "Stopped";
    if (taskPayments != undefined) {
        status = taskPayments.status;
    }

    return res.status(200).send({ "Check payments Job Status": status });
});

router.post('/api/private/payments/job/checkPayments/forceRun', (req, res) => {

    checkPayments();

    console.log("Check payments Job Status was executed")
    return res.status(200).send("Check payments Job Status was executed");
});

//Job Check Sessions
router.post('/api/job/checkSessions', (req, res) => {
    var context = "POST /api/job/checkSessions";
    try {
        checkSessions();
        return res.status(StatusCodes.OK).send(`${context} - Process completed successfully`);
    } catch (error) {
        console.error(`[${context}] Error:`, error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
});

router.post('/api/private/payments/job/checkSessions/startJob', (req, res) => {
    var context = "POST /api/private/payments/job/checkSessions/startJob";
    var timer = "*/30 * * * *";

    if (req.body.timer)
        timer = req.body.timer;

    initJobCheckSessions(timer).then(() => {
        taskSessions.start();
        console.log("Check sessions Job Started")
        return res.status(200).send('Check sessions Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });

});

router.post('/api/private/payments/job/checkSessions/stopJob', (req, res) => {

    taskSessions.stop();
    console.log("Check sessions Job Stopped")
    return res.status(200).send('Check sessions Job Stopped');

});

router.post('/api/private/payments/job/checkSessions/statusJob', (req, res) => {

    var status = "Stopped";
    if (taskSessions != undefined) {
        status = taskSessions.status;
    }

    return res.status(200).send({ "Check sessions Job Status": status });
});

router.post('/api/private/payments/job/checkSessions/forceRun', (req, res) => {

    const limit = req.body.limit

    checkSessions(limit);

    console.log("Check sessions Job Status was executed")
    return res.status(200).send("Check sessions Job Status was executed");
});

router.post('/api/private/payments/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/payments/runFirstTime";

    if (req.body.userId) {
        unlockUser(req.body.userId)
    }

    //addClientName();
    addUserIdToBilling();

    return res.status(200).send("OK");

});

router.post('/api/private/payments/forceRun', (req, res) => {
    const { paymentMethodId, refusalReasonCode } = req.body
    needsThreeDSAuthentication(paymentMethodId, refusalReasonCode)

    return res.status(200).send("needsThreeDSAuthentication was executed");
});

router.post('/api/job/createUncollectibleUsersDocument', (req, res) => {
    var context = "POST /api/job/createUncollectibleUsersDocument";
    try {
        createuUcollectibleUsersDocument();
        return res.status(StatusCodes.OK).send(`${context} - Process completed successfully`);
    } catch (error) {
        console.error(`[${context}] Error:`, error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    }
});

//========== PATCH ==========
//TODO
router.patch('/api/private/payments', (req, res, next) => {
    var context = "PATCH /api/private/payments";
    try {

        var payment = req.body;
        var query = {
            _id: payment._id
        };

        paymentFindOne(query)
            .then((paymentFound) => {

                if (paymentFound) {

                    paymentFound.status = payment.status;
                    var newValues = { $set: paymentFound };

                    paymentUpdate(query, newValues)
                        .then((result) => {

                            if (result) {

                                res.status(200).send(paymentFound);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentFound);
                                return res;

                            }
                            else {

                                var message = { auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" };
                                res.status(400).send(message);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
                                return res;

                            };
                        })
                        .catch((error) => {

                            console.error(`[${context}][paymentFindOne] Error `, error.message);
                            res.status(500).send(error.message);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                            return res;

                        });

                }
                else {

                    var message = { auth: false, code: 'server_payment_not_found', message: "Payment not found for given parameters" };
                    res.status(400).send(message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
                    return res;

                };
            })
            .catch((error) => {

                console.error(`[${context}][paymentFindOne] Error `, error.message);
                res.status(500).send(error.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                return res;

            });
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/payments/billing', async (req, res, next) => {
    var context = "PATCH /api/private/payments/billing";
    try {
        let body = req.body;
        const disabledBillingV2InvoiceOcpp = await toggle.isEnable('billing-v2-invoice-magnifinance-disable');

        await Promise.all(
            body.map(async (session) => {
                try {
                    const paymentFound = await Payments.findOne({ sessionId: session._id });

                    if (!paymentFound) {
                        console.error(`[${context}] Payment not found for session ${session._id}`);
                        Sentry.captureException(
                            new Error(`Session ${session._id} was sent to /api/private/payments/billing without having a payment`)
                        );
                        return;
                    }

                    const isValidCharger = paymentFound.chargerType &&
                        !process.env.PublicNetworkChargerType.includes(paymentFound.chargerType);

                    const isAmountValid = paymentFound.amount?.value > 0;

                    if (!disabledBillingV2InvoiceOcpp) {
                        console.log(`[${context}] Magnifinance billing is enabled for session ${session._id}`);
                        if (
                            isValidCharger &&
                            isAmountValid
                        ) {
                            sendBillingDocument(paymentFound);
                        }
                    }
                    else {
                        console.log(`[${context}] Magnifinance billing is disabled for session ${session._id}`);
                        if (
                            paymentFound.clientName === 'Salvador Caetano' &&
                            isValidCharger &&
                            isAmountValid
                        ) {
                            sendBillingDocument(paymentFound);
                        }
                    }

                } catch (error) {
                    console.error(`[${context}] Error `, error.message);
                    Sentry.captureException(error);
                }
            })
        );

        res.status(200).send(body);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, body);
        return res;

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/payments/billing2ndWayPhysicalCard', (req, res, next) => {
    var context = "PATCH /api/private/payments/billing2ndWayPhysicalCard";
    try {

        let body = req.body;

        Payments.findOne({ contractId: body._id }, (err, paymentFound) => {

            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                return res;

            };

            sendBillingDocumentPhysicalCard(paymentFound);

        });


        res.status(200).send(body);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, body);
        return res;

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/payments/monthlyB2B', (req, res, next) => {
    var context = "PATCH /api/private/payments/monthlyB2B";
    try {

        let payment = req.body;

        //console.log("Payment", payment);

        Payments.findOneAndUpdate({ _id: payment.paymentId }, { $set: { status: process.env.PaymentStatusPaidOut } }, { new: true }, async (error, paymentUpdated) => {
            if (error) {

                console.error(`[${context}] Error `, error.message);
                res.status(500).send(error.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                return res;

            }

            let transactionUpdated = await Transactions.findOneAndUpdate({ paymentId: payment.paymentId }, { $set: { status: process.env.TransactionStatusPaidOut } }, { new: true })

            updateSessions(paymentUpdated);
            res.status(200).send(paymentUpdated);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentUpdated);
            return res;

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/payments/invoiceId', (req, res, next) => {
    var context = "PATCH /api/private/payments/invoiceId";
    try {

        let payment = req.body;

        //console.log("Payment", payment);

        Payments.findOneAndUpdate({ _id: payment.paymentId }, { $set: { invoiceId: payment.invoiceId } }, { new: true }, async (error, paymentUpdated) => {
            if (error) {

                console.error(`[${context}] Error `, error.message);
                res.status(500).send(error.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                return res;

            }

            let transactionUpdated = await Transactions.findOneAndUpdate({ paymentId: payment.paymentId }, { $set: { invoiceId: payment.invoiceId } }, { new: true })

            res.status(200).send(paymentUpdated);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentUpdated);
            return res;

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/payments/removeMonthlyB2B', async (req, res, next) => {
    var context = "POST /api/private/payments/removeMonthlyB2B";
    try {
        let foundPayment = await Payments.findOne({ _id: req.body.paymentId })
        if (foundPayment) {
            await Transactions.findOneAndDelete({ paymentId: req.body.paymentId })
            await Payments.findOneAndDelete({ _id: req.body.paymentId })
            res.status(200).send({ auth: true, code: 'server_payment_deleted', message: `Payment and transaction deleted with id ${req.body.paymentId}` });
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, foundPayment);
            return res;
        } else {
            res.status(400).send({ auth: true, code: 'server_payment_deleted', message: `Payment and transaction not deleted` });
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, foundPayment);
            return res;
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/payments/walletRefund', (req, res, next) => {
    var context = "PATCH /api/private/payments/walletRefund";
    try {

        var received = req.body;

        let query = {
            _id: received.paymentId,
            sessionId: received.sessionId
        };

        Payments.findOne(query, async (err, paymentFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                return res;

            }
            let queryTransactions;
            let queryNotificationsPayments;

            switch (paymentFound.status) {
                case process.env.PaymentStatusStartPayment:

                    //console.log("Payment status", process.env.PaymentStatusStartPayment);
                    //console.log("Payment id", paymentFound._id);
                    queryTransactions = {
                        sessionId: received.sessionId,
                        paymentId: received.paymentId
                    };

                    var transaction = await transactionsFindOne(queryTransactions);

                    if (transaction) {

                        //console.log("transaction.status", transaction.status);
                        queryNotificationsPayments = {
                            sessionId: received.sessionId,
                            paymentId: received.paymentId,
                            transactionId: transaction._id
                        };

                        NotificationsPayments.findOne(queryNotificationsPayments, (err, notificationFound) => {
                            if (err) {
                                console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
                            }
                            else {
                                if (notificationFound) {
                                    if (notificationFound.userBlocked && notificationFound.active) {
                                        //console.log("notificationFound", notificationFound)
                                        let userId = notificationFound.userId;
                                        activateContracts(userId)
                                    }
                                    NotificationsPayments.updateNotificationsPayments(queryNotificationsPayments, { $set: { active: false } }, (err, notificationFound) => {
                                        if (err) {
                                            console.error(`[${context}][NotificationsPayments.updateNotificationsPayments] Error `, err.message);
                                        }
                                        else {
                                            console.log("Notifications Payments Updated")
                                        };
                                    });

                                };
                            };
                        });

                        var newValues = {
                            status: process.env.TransactionStatusCanceled,
                            notes: "Error duplicated session"
                        };
                        transaction = await transactionsUpdate(queryTransactions, { $set: newValues });
                    };
                    newValues = {
                        status: process.env.PaymentStatusCanceled,
                        reason: "Error duplicated session"
                    };
                    Payments.updatePayments(query, { $set: newValues }, (err, result) => {
                        if (err) {
                            console.error(`[${context}][Payments.updatePayments] Error `, err.message);
                        }
                        else {

                            res.status(200).send(result);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                            return res;
                        }
                    })

                    break;
                case process.env.PaymentStatusInPayment:
                    //console.log("Payment status", process.env.PaymentStatusInPayment);

                    queryTransactions = {
                        sessionId: received.sessionId,
                        paymentId: received.paymentId
                    };

                    //console.log("paymentFound", paymentFound);
                    var transaction = await transactionsFindOne(queryTransactions);
                    if (transaction) {

                        //console.log("transaction.status", transaction.status);
                        queryNotificationsPayments = {
                            sessionId: received.sessionId,
                            paymentId: received.paymentId,
                            transactionId: transaction._id
                        };

                        NotificationsPayments.findOne(queryNotificationsPayments, (err, notificationFound) => {
                            if (err) {
                                console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
                            }
                            else {
                                //console.log("notificationFound", notificationFound)
                                if (notificationFound) {
                                    if (notificationFound.userBlocked && notificationFound.active) {
                                        //console.log("notificationFound", notificationFound)
                                        let userId = notificationFound.userId;
                                        activateContracts(userId)
                                    }
                                    NotificationsPayments.updateNotificationsPayments(queryNotificationsPayments, { $set: { active: false } }, (err, notificationFound) => {
                                        if (err) {
                                            console.error(`[${context}][NotificationsPayments.updateNotificationsPayments] Error `, err.message);
                                        }
                                        else {
                                            console.log("Notifications Payments Updated")
                                        };
                                    });

                                };
                            };
                        });

                        var newValues = {
                            status: process.env.TransactionStatusCanceled,
                            notes: "Error duplicated session"
                        };
                        transaction = await transactionsUpdate(queryTransactions, { $set: newValues });
                    };
                    newValues = {
                        status: process.env.PaymentStatusCanceled,
                        reason: "Error duplicated session"
                    };
                    Payments.updatePayments(query, { $set: newValues }, (err, result) => {
                        if (err) {
                            console.error(`[${context}][Payments.updatePayments] Error `, err.message);
                        }
                        else {

                            res.status(200).send(result);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                            return res;
                        }
                    })

                    break;
                case process.env.PaymentStatusCanceled:
                    //console.log("Payment status", process.env.PaymentStatusCanceled);
                    res.status(200).send(true);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, true);
                    return res;
                    break;
                case process.env.TransactionStatusRefused:
                    //console.log("Payment status", process.env.TransactionStatusRefused);
                    res.status(200).send(true);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, true);
                    return res;
                    break;
                case process.env.PaymentStatusFaild:
                    //console.log("Payment status", process.env.PaymentStatusFaild);

                    queryTransactions = {
                        sessionId: received.sessionId,
                        paymentId: received.paymentId
                    };

                    var transaction = await transactionsFindOne(queryTransactions);
                    if (transaction) {

                        //console.log("transaction.status", transaction.status);
                        queryNotificationsPayments = {
                            sessionId: received.sessionId,
                            paymentId: received.paymentId,
                            transactionId: transaction._id
                        };

                        NotificationsPayments.findOne(queryNotificationsPayments, (err, notificationFound) => {
                            if (err) {
                                console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
                            }
                            else {
                                //console.log("notificationFound", notificationFound)
                                if (notificationFound) {
                                    if (notificationFound.userBlocked && notificationFound.active) {
                                        //console.log("notificationFound", notificationFound)
                                        let userId = notificationFound.userId;
                                        activateContracts(userId)
                                    }

                                    NotificationsPayments.updateNotificationsPayments(queryNotificationsPayments, { $set: { active: false } }, (err, notificationFound) => {
                                        if (err) {
                                            console.error(`[${context}][NotificationsPayments.updateNotificationsPayments] Error `, err.message);
                                        }
                                        else {
                                            console.log("Notifications Payments Updated")
                                        };
                                    });

                                };
                            };
                        });
                        var newValues = {
                            status: process.env.TransactionStatusCanceled,
                            notes: "Error duplicated session"
                        };
                        transaction = await transactionsUpdate(queryTransactions, { $set: newValues });
                    };
                    newValues = {
                        status: process.env.PaymentStatusCanceled,
                        reason: "Error duplicated session"
                    };
                    Payments.updatePayments(query, { $set: newValues }, (err, result) => {
                        if (err) {
                            console.error(`[${context}][Payments.updatePayments] Error `, err.message);
                        }
                        else {

                            res.status(200).send(result);
                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                            return res;
                        }
                    })
                    break;
                case process.env.PaymentStatusRefund:
                    //console.log("Payment status", process.env.PaymentStatusRefund);
                    res.status(200).send(true);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, true);
                    return res;
                    break;
                case process.env.PaymentStatusUnknown:
                    //console.log("Payment status", process.env.PaymentStatusUnknown);
                    res.status(200).send(true);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, true);
                    return res;
                    break;
                case process.env.PaymentStatusWaitingCapturByEVIO:
                    //console.log("Payment status", process.env.PaymentStatusWaitingCapturByEVIO);
                    res.status(200).send(true);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, true);
                    return res;
                    break;
                case process.env.PaymentStatusPaidOut:
                    console.log("Payment status", process.env.PaymentStatusPaidOut);
                    //if status 40
                    queryTransactions = {
                        sessionId: received.sessionId,
                        paymentId: received.paymentId
                    };

                    var transaction = await transactionsFindOne(queryTransactions);

                    if (transaction) {

                        creditNoteByPaymentId({ paymentId: received.paymentId })
                            .then(async () => {

                                //console.log("transaction", transaction);

                                let wallet = await walletFindOne({ userId: transaction.userId });

                                console.log("wallet.amount.value", wallet.amount.value);
                                var query = {

                                    userId: transaction.userId,
                                    "transactionsList.transactionId": transaction._id

                                };

                                var newTransaction = {

                                    $set: {
                                        "transactionsList.$.status": process.env.TransactionStatusRefund,
                                        "transactionsList.$.transactionType": transaction.transactionType,
                                        "transactionsList.$.transactionType": process.env.TransactionTypeRefund,
                                        "transactionsList.$.notes": "Duplicate invoice settlement"
                                    },
                                    $inc: {
                                        "amount.value": transaction.amount.value

                                    }
                                };

                                Wallet.findOneAndUpdate(query, newTransaction, { new: true }, (err, newWallet) => {
                                    if (err) {
                                        console.error(`[${context}] Error `, err.message);
                                    }
                                    console.log("newWallet.amount.value", newWallet.amount.value);
                                })

                            });
                        var newValues = {
                            status: process.env.TransactionStatusRefund,
                            notes: "Duplicate invoice settlement"
                        };
                        transaction = await transactionsUpdate(queryTransactions, { $set: newValues });

                        newValues = {
                            status: process.env.PaymentStatusRefund,
                            reason: "Duplicate invoice settlement"
                        };
                        Payments.updatePayments(query, { $set: newValues }, (err, result) => {
                            if (err) {
                                console.error(`[${context}][Payments.updatePayments] Error `, err.message);
                            }
                            else {

                                res.status(200).send(result);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                                return res;
                            }
                        })
                    };

                    break;
                default:
                    //console.log("Payment status", process.env.PaymentStatusWaitingCapturByEVIO);
                    res.status(200).send(true);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, true);
                    return res;
                    break;
            }
        })


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//========== PUT ==========
router.put('/api/private/payments/:sessionId', (req, res, next) => {
    var context = "PUT /api/private/payments/:sessionId";
    try {

        var sessionId = req.params.sessionId;

        Payments.removePayments({ sessionId: sessionId }, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                return res;
            } else {
                Transaction.removeTransactions({ sessionId: sessionId }, (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        res.status(500).send(err.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                        return res;
                    } else {
                        res.status(200).send("Transaction removed");
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, "Transaction removed");
                        return res;
                    }
                })
            }
        })

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//========== GET ==========
//Get payment using filters
router.get('/api/private/payments', (req, res, next) => {
    var context = "GET /api/private/payments";
    try {

        var userId = req.headers['userid'];

        if (req.query != undefined) {

            var query = req.query;

        }
        else {

            var query = {};

        };

        paymentFind(query)
            .then((paymentsFound) => {

                var payments = [];

                Promise.all(
                    paymentsFound.map(payment => {

                        return new Promise(async (resolve, reject) => {

                            let session = await getSession(payment.sessionId);
                            let user = await getUser(payment.userId);
                            var query = {
                                _id: payment.transactionId
                            };
                            let transaction = await transactionsFindOne(query);

                            var newPayments = {
                                session: session,
                                user: user,
                                transaction: transaction,
                                status: paymentsFound.status
                            };

                            payments.push(newPayments);
                            resolve(true);

                        });

                    })
                ).then((result) => {

                    res.status(200).send(payments);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, payments);
                    return res;

                }).catch((error) => {

                    console.error(`[${context}][paymentFind] Error `, error.message);
                    res.status(500).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });

                //return res.status(200).send(paymentsFound);

            })
            .catch((error) => {

                console.error(`[${context}][paymentFind] Error `, error.message);
                res.status(500).send(error.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                return res;

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get payment by ID
router.get('/api/private/payments/byId', (req, res, next) => {
    var context = "GET /api/private/payments/byId";
    try {

        var userId = req.headers['userid'];
        if (!req.query._id) {

            var message = { auth: false, code: 'server_id_required', message: "Id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            var query = { _id: req.query._id };

            paymentFindOne(query)
                .then(async (paymentsFound) => {
                    try {

                        let session = await getSession(paymentsFound.sessionId);
                        let user = await getUser(paymentsFound.userId);

                        var query = {
                            _id: paymentsFound.transactionId
                        };

                        let transaction = await transactionsFindOne(query);

                        var payments = {
                            session: session,
                            user: user,
                            transaction: transaction,
                            status: paymentsFound.status
                        };

                        res.status(200).send(payments);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, payments);
                        return res;

                    }
                    catch (error) {

                        console.error(`[${context}] Error `, error.message);
                        res.status(500).send(error.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                        return res;

                    };
                })
                .catch((error) => {

                    console.error(`[${context}] Error `, error.message);
                    res.status(500).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });

        };
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get payment by user
router.get('/api/private/payments/byUser', (req, res, next) => {
    var context = "GET /api/private/payments/byUser";
    try {

        var userId = req.headers['userid'];

        if (req.query != undefined) {

            var query = req.query;
            query.userId = userId;

        }
        else {

            var query = {
                userId: userId
            };

        };
        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            paymentFind(query)
                .then((paymentsFound) => {

                    var payments = [];

                    Promise.all(
                        paymentsFound.map(payment => {

                            return new Promise(async (resolve, reject) => {

                                let session = await getSession(payment.sessionId);
                                let user = await getUser(payment.userId);
                                var query = {
                                    _id: payment.transactionId
                                };
                                let transaction = await transactionsFindOne(query);

                                var newPayments = {
                                    session: session,
                                    user: user,
                                    transaction: transaction,
                                    status: paymentsFound.status
                                };

                                payments.push(newPayments);
                                resolve(true);

                            });

                        })
                    ).then((result) => {

                        res.status(200).send(payments);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, payments);
                        return res;

                    }).catch((error) => {

                        console.error(`[${context}][paymentFind] Error `, error.message);
                        res.status(500).send(error.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                        return res;

                    });

                    //return res.status(200).send(paymentsFound);

                })
                .catch((error) => {

                    console.error(`[${context}][paymentFind] Error `, error.message);
                    res.status(500).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Gets pending payments (Validate start session)
router.get('/api/private/payments/pendingPayments', (req, res, next) => {
    var context = "GET /api/private/payments/pendingPayments";
    try {
        var userId = req.headers['userid'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            var query = {
                userId: userId,
                status: { $ne: process.env.PaymentStatusPaidOut }
            };

            paymentFind(query)
                .then((paymentsFound) => {

                    res.status(200).send(paymentsFound);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentsFound);
                    return res;

                })
                .catch((error) => {

                    console.error(`[${context}][paymentFind] Error `, error.message);
                    res.status(500).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.get('/api/private/payments/paymentMethodDefault', (req, res, next) => {
    var context = "GET /api/private/payments/paymentMethodDefault";
    try {

        var userId = req.headers['userid'];

        var query = {
            userId: userId
        };


        PaymentMethod.find(query, (err, result) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, err.message);
                return res;

            }
            else {

                res.status(200).send(result);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, result);
                return res;

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Endpoint to validate payment conditions
router.get('/api/private/payments/validatePaymentConditions', async (req, res, next) => {
    const context = "GET /api/private/payments/validatePaymentConditions";

    const startDate = new moment();

    let userIdWillPay = ""
    let userIdToBilling = ""
    try {

        let request = req.body;
        validateFieldsPaymentConditions(request)
            .then(() => {
                validateEV(request)
                    .then(async (response) => {

                        let evFound = response.evFound;
                        userIdWillPay = response.userIdWillPay;
                        userIdToBilling = response.userIdToBilling;
                        let evOwner = response.evOwner;
                        let evOwnerBilling = response.evOwnerBilling; 
                        const idTag = request.data.idTag || ''
                        let infoUser = await getClientTypeAndPlanCeme(userIdWillPay, request.userId, evFound, idTag);
                        let viesVAT;
                        let billingPeriod;
                        let clientType = infoUser.clientType;
                        let clientName = infoUser.clientName;
                        let cardNumber = infoUser.cardNumber;

                        let queryPayments = {
                            userId: userIdWillPay,
                            //creditCard: true,
                            status: { $ne: process.env.PaymentMethodStatusExpired }
                        };
                        let chargerFound = await getCharger(request.data.hwId, request.data.chargerType);
                        let billingProfile = await validateBillingProfile(userIdToBilling);
                        if (billingProfile) {
                            viesVAT = billingProfile.viesVAT
                            billingPeriod = billingProfile.billingPeriod


                            const isFlagBillingProfileStatus = await toggle.isEnable('bp-369-no-address-validation-on-physical-card-request')
                            console.log('isFlagBillingProfileStatus', isFlagBillingProfileStatus)
                            if(isFlagBillingProfileStatus && billingProfile?.status !== Constants.billingProfileStatus.ACTIVE) {
                                console.log('validations billing profile status active')
                                res.status(400).send({ auth: false, statusCode: 400, code: 'server_billingProfile_required', message: "Billing Profile is required", redirect: "billing" });
                                return res;
                            }
                        };


                        // let myActiveSessions = ( await PaymentsHandler.getNotPaidSessions(userIdWillPay)).filter(elem => elem.paymentMethod == process.env.PaymentMethodWallet);
                        // console.log("myActiveSessions" , JSON.stringify(myActiveSessions))
                        let myActiveSessions = (await getMyActiveSessions(userIdWillPay)).filter(sessions => {
                            return sessions.paymentMethod == process.env.PaymentMethodWallet;
                        });
                        let planCeme;
                        if (
                            request.data.chargerType === process.env.GireveCharger ||
                            request.data.chargerType === Enums.ChargerTypes.Hubject
                        ) {

                            //planCeme = infoUser.planRoaming;
                            planCeme = infoUser.planRoaming.find(plan => {
                                return plan.plan.CEME === process.env.clientNameEVIO + " " + chargerFound.source;
                            })

                        } else {

                            planCeme = infoUser.planCeme;

                        };

                        console.log("planCeme - ", planCeme);
                        let chargerType = chargerFound.chargerType;
                        var tariff = request.data.tariff;
                        var fees = request.data.fees;
                        let timeToValidatePayment = {
                            timeToReserve: process.env.TimeToValidatePaymentToReserve,
                            timeToConfirmation: process.env.TimeToValidatePaymentToConfirmation
                        };

                        //let timeToValidatePayment = await getTimeToValidatePayment();
                        let wallet = await walletFindOne({ userId: userIdWillPay });
                        let paymentMethods = await paymentMethodsFind(queryPayments);
                        let listPaymentMethod = await listPaymentMethodFindOne({ userId: userIdWillPay });
                        let plugFound = chargerFound.plugs.find(plug => {
                            return plug.plugId == request.data.plugId;
                        });

                        const minimumAuthorizeValue = parseInt(process.env.minimumAuthorizeValue)
                        const minimumAuthorizeTime = parseInt(process.env.minimumAuthorizeTime)

                        // let reservedAmount = await PaymentsHandler.priceSimulator(minimumAuthorizeTime, tariff, plugFound, evFound, chargerType, chargerFound , planCeme?.plan?._id , clientName , minimumAuthorizeValue , userIdWillPay)

                        let reservedAmount = await priceSimulator(timeToValidatePayment.timeToReserve, tariff, plugFound, evFound, request.data.chargerType, fees, chargerFound);
                        let confirmationAmount = 0;
                        if (!reservedAmount || chargerFound.accessType === process.env.ChargerAccessFreeCharge) {
                            reservedAmount = 0;
                        }

                        let userWillPay = true;
                        let paymentType = process.env.PaymentTypeAD_HOC;

                        if (listPaymentMethod) {

                            if (listPaymentMethod.userType === "b2b") {
                                let paymentPeriod = await getPaymentPeriod(userIdWillPay);
                                userWillPay = paymentPeriod.userWillPay;
                                paymentType = paymentPeriod.paymentType;
                            };

                        };

                        if (chargerFound.accessType === process.env.ChargerAccessFreeCharge) {

                            let plafond = null
                            userIdWillPay = chargerFound.createUser
                            chagerOwnerStart(userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond);

                        } else if (clientType == 'b2b') {
                            //B2B
                            console.log("b2b")
                            if (evFound != "-1") {

                                console.log("b2b EV")
                                let plafond = null
                                if (evFound.plafondId && evFound.plafondId != "-1") {
                                    plafond = await Plafond.findOne({ _id: evFound.plafondId })
                                };

                                if (userIdWillPay === chargerFound.createUser) {

                                    chagerOwnerStart(userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond);

                                } else if (listPaymentMethod) {

                                    if (listPaymentMethod.paymentMethod.length === 1) {
                                        let plafondId = "-1";
                                        switch (listPaymentMethod.paymentMethod[0]) {
                                            case process.env.PaymentMethodTransfer:
                                                if (plafond) {
                                                    plafondId = await validatePlafond(plafond, userIdWillPay, userIdToBilling, req, res);

                                                }

                                                let paymentInfo = {
                                                    paymentMethod: process.env.PaymentMethodTypeTransfer,
                                                    paymentMethodId: "",
                                                    walletAmount: 0,
                                                    reservedAmount: 0,
                                                    confirmationAmount: 0,
                                                    userIdWillPay: userIdWillPay,
                                                    adyenReference: "",
                                                    transactionId: "",
                                                    clientType: clientType,
                                                    clientName: clientName,
                                                    ceme: planCeme,
                                                    viesVAT: viesVAT,
                                                    paymentType: paymentType,
                                                    billingPeriod: billingPeriod,
                                                    userIdToBilling: userIdToBilling,
                                                    plafondId: plafondId,
                                                    cardNumber: cardNumber
                                                };

                                                if (clientName === process.env.WhiteLabelKinto) {
                                                    paymentInfo = setKIntoPaymentInfo(userIdWillPay, clientType, clientName, planCeme, viesVAT, userIdToBilling, plafondId, cardNumber)
                                                }

                                                res.status(200).send(paymentInfo);
                                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                                return res;
                                                break;
                                            case process.env.PaymentMethodCard:
                                                validateWalletQuantity( wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, cardNumber, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond);
                                                break;
                                            default:

                                                messageResponse = { auth: false, code: 'server_listPaymentMethod_unknown', message: 'Unknown payment method', userIdWillPay, userIdToBilling };
                                                res.status(400).send(messageResponse);
                                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                                return res;

                                                break;
                                        };

                                    } else if (listPaymentMethod.paymentMethod.length > 1) {

                                        //console.log("2", paymentMethods)
                                        if (paymentMethods) {
                                            validateWalletQuantity( wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, cardNumber, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond);

                                        } else {

                                            messageResponse = { auth: false, code: 'server_paymentMethodCard_required', message: 'Card payment method is required', userIdWillPay, userIdToBilling };
                                            res.status(400).send(messageResponse);
                                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                            return res;

                                        }

                                    } else {

                                        messageResponse = { auth: false, code: 'server_listPaymentMethod_required', message: 'It is necessary to define the payment method', userIdWillPay, userIdToBilling };
                                        res.status(400).send(messageResponse);
                                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                        return res;

                                    };

                                } else {

                                    messageResponse = { auth: false, code: 'server_listPaymentMethod_required', message: 'It is necessary to define the payment method', userIdWillPay, userIdToBilling };
                                    res.status(400).send(messageResponse);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                    return res;

                                };

                                //};

                            } else {

                                console.log("b2b EV = -1")
                                let plafond = null;
                                let plafondId = "-1";
                                //console.log("listPaymentMethod", listPaymentMethod)
                                if (userIdWillPay === chargerFound.createUser) {

                                    chagerOwnerStart(userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond);

                                } else if (listPaymentMethod) {

                                    if (listPaymentMethod.paymentMethod.length === 1) {

                                        //console.log("1", paymentType);

                                        switch (listPaymentMethod.paymentMethod[0]) {
                                            case process.env.PaymentMethodTransfer:

                                                let paymentInfo = {
                                                    paymentMethod: process.env.PaymentMethodTypeTransfer,
                                                    paymentMethodId: "",
                                                    walletAmount: 0,
                                                    reservedAmount: 0,
                                                    confirmationAmount: 0,
                                                    userIdWillPay: userIdWillPay,
                                                    adyenReference: "",
                                                    transactionId: "",
                                                    clientType: clientType,
                                                    clientName: clientName,
                                                    ceme: planCeme,
                                                    viesVAT: viesVAT,
                                                    paymentType: paymentType,
                                                    billingPeriod: billingPeriod,
                                                    userIdToBilling: userIdToBilling,
                                                    plafondId: plafondId,
                                                    cardNumber: cardNumber,
                                                };

                                                if (clientName === process.env.WhiteLabelKinto) {
                                                    paymentInfo = setKIntoPaymentInfo(userIdWillPay, clientType, clientName, planCeme, viesVAT, userIdToBilling, plafondId, cardNumber)
                                                }

                                                res.status(200).send(paymentInfo);
                                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                                return res;

                                                break;
                                            case process.env.PaymentMethodCard:

                                                if (billingProfile) {
                                                    validateWalletQuantity( wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, cardNumber, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond);
                                                } else {

                                                    let messageResponse
                                                    if (evOwnerBilling) {
                                                        messageResponse = { auth: false, code: 'server_billingProfile_evOwner_required', message: "The selected EV belogns to other user, that doen's have billing profile. To start charging, the EV owner must to create a valid billing profile.", userIdWillPay, userIdToBilling };
                                                    }
                                                    else {
                                                        messageResponse = { auth: false, code: 'server_billingProfile_required', message: 'Billing Profile is required', redirect: "billing", userIdWillPay, userIdToBilling };
                                                    };
                                                    res.status(400).send(messageResponse);
                                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                                    return res;

                                                };

                                                break;
                                            default:

                                                messageResponse = { auth: false, code: 'server_listPaymentMethod_unknown', message: 'Unknown payment method', userIdWillPay, userIdToBilling };
                                                res.status(400).send(messageResponse);
                                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                                return res;

                                                break;
                                        };

                                    } else if (listPaymentMethod.paymentMethod.length > 1) {

                                        if (billingProfile) {

                                            if (paymentMethods) {
                                                let plafond = null;
                                                validateWalletQuantity( wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, cardNumber, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond);
                                            } else {

                                                messageResponse = { auth: false, code: 'server_paymentMethodCard_required', message: 'Card payment method is required', userIdWillPay, userIdToBilling };
                                                res.status(400).send(messageResponse);
                                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                                return res;

                                            };

                                        } else {

                                            var messageResponse
                                            if (evOwnerBilling) {
                                                messageResponse = { auth: false, code: 'server_billingProfile_evOwner_required', message: "The selected EV belogns to other user, that doen's have billing profile. To start charging, the EV owner must to create a valid billing profile.", userIdWillPay, userIdToBilling };
                                            }
                                            else {
                                                messageResponse = { auth: false, code: 'server_billingProfile_required', message: 'Billing Profile is required', redirect: "billing", userIdWillPay, userIdToBilling };
                                            };
                                            res.status(400).send(messageResponse);
                                            RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                            return res;

                                        };

                                    } else {

                                        messageResponse = { auth: false, code: 'server_listPaymentMethod_required', message: 'It is necessary to define the payment method', userIdWillPay, userIdToBilling };
                                        res.status(400).send(messageResponse);
                                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                        return res;

                                    };

                                } else {

                                    messageResponse = { auth: false, code: 'server_listPaymentMethod_required', message: 'It is necessary to define the payment method', userIdWillPay, userIdToBilling };
                                    res.status(400).send(messageResponse);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                    return res;

                                };

                            };

                        } else {
                            //B2C
                            console.log("b2c")
                            if (billingProfile) {
                                if (process.env.PublicNetworkChargerType.includes(chargerType)) {

                                    //Charger type public (OCPI)
                                    if (userIdWillPay == chargerFound.createUser) {

                                        let plafond = null
                                        chagerOwnerStart( userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond );

                                    } else {
                                        let plafond = null
                                        validateWalletQuantity( wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, cardNumber, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond);
                                    };

                                } else {

                                    //Charger type EVIO (OCPP or EVIO Box)
                                    //console.log("tariff.billingType", tariff.billingType);
                                    if (chargerFound.accessType === process.env.ChargerAccessFreeCharge) {

                                        let plafond = null
                                        userIdWillPay = chargerFound.createUser
                                        chagerOwnerStart(userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond );

                                    } else if (tariff.billingType == process.env.BillingTypeNotApplicable || tariff.billingType == process.env.BillingTypeForImportingCosts) {

                                        let paymentInfo = {
                                            paymentMethod: process.env.PaymentMethodNotPay,
                                            paymentMethodId: "",
                                            walletAmount: 0,
                                            reservedAmount: 0,
                                            confirmationAmount: 0,
                                            userIdWillPay: userIdWillPay,
                                            adyenReference: "",
                                            transactionId: "",
                                            clientType: clientType,
                                            clientName: clientName,
                                            ceme: planCeme,
                                            viesVAT: viesVAT,
                                            paymentType: paymentType,
                                            billingPeriod: billingPeriod,
                                            userIdToBilling: userIdToBilling,
                                            plafondId: "-1",
                                            cardNumber: cardNumber,
                                        };

                                        if (clientName === process.env.WhiteLabelKinto) {
                                            paymentInfo = setKIntoPaymentInfo(userIdWillPay, clientType, clientName, planCeme, viesVAT, userIdToBilling, plafondId, cardNumber)
                                        }

                                        res.status(200).send(paymentInfo);
                                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                        return res;

                                    } else {

                                        if (userIdWillPay === chargerFound.createUser) {
                                            let plafond = null
                                            chagerOwnerStart(userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond );

                                        } else {
                                            let plafond = null
                                            validateWalletQuantity( wallet, paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, clientName, cardNumber, planCeme, viesVAT, paymentType, billingPeriod, evOwner, userIdToBilling, myActiveSessions, req, res, plafond);
                                        };

                                    };

                                };

                            } else {

                                var messageResponse
                                if (evOwnerBilling) {
                                    messageResponse = { auth: false, code: 'server_billingProfile_evOwner_required', message: "The selected EV belogns to other user, that doen's have billing profile. To start charging, the EV owner must to create a valid billing profile.", userIdWillPay, userIdToBilling };
                                }
                                else {
                                    messageResponse = { auth: false, code: 'server_billingProfile_required', message: 'Billing Profile is required', redirect: "billing", userIdWillPay, userIdToBilling };
                                };

                                res.status(400).send(messageResponse);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                return res;

                            };

                        }

                    })
                    .catch((error) => {

                        console.error(`[${context}][validateEV] Error `, error);
                        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                        return res;

                    });

            })
            .catch((error) => {
                console.error(`[${context}][validateFieldsPaymentConditions] Error `, error.message);
                res.status(400).send({ message: error.message, userIdWillPay, userIdToBilling });
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                return res;

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.get('/api/private/payments/validatePaymentConditions_new', async (req, res, next) => {
    const context = "GET /api/private/payments/validatePaymentConditions";
    try {

        let request = req.body;

        //console.log("request", request);

        validateFieldsPaymentConditions(request)
            .then(() => {
                validateEV(request)
                    .then(async (response) => {

                        PaymentsHandler.validatePaymentConditions(request, response)
                            .then(response => {
                                res.status(200).send(response);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, response);
                                return res;
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                ErrorHandler.ErrorHandler(req, error, res);
                            })

                    })
                    .catch((error) => {

                        console.error(`[${context}][validateEV] Error `, error.message);
                        res.status(500).send(error.message);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                        return res;

                    });

            })
            .catch((error) => {

                res.status(400).send(error);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                return res;

            });

    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.get('/api/private/payments/statusTransaction/:sessionId', async (req, res, next) => {
    var context = "GET /api/private/payments/statusTransaction";
    try {

        let sessionId = req.params.sessionId;

        let queryPayment = {
            $or: [
                { sessionId: sessionId },
                { listOfSessions: sessionId }
            ]
        };

        let query = {
            sessionId: sessionId
        };

        let payments = await paymentFind(queryPayment);
        let transactions = await transactionsFind(query);

        let response = {
            payments: payments,
            transactions: transactions
        };

        res.status(200).send(response);

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get payment by ID
router.get('/api/private/payments/byIdHistory', async (req, res, next) => {
    const context = "GET /api/private/payments/byIdHistory";
    try {

        if (!req.query._id) {

            var message = { auth: false, code: 'server_id_required', message: "Id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            let query = { _id: req.query._id };

            let paymentsFound = await paymentFindOne(query)

            res.status(200).send(paymentsFound);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentsFound);
            return res;

        };
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.get('/api/private/payments/byIdERSE', async (req, res, next) => {
    const context = "GET /api/private/payments/byIdERSE";
    try {

        if (!req.query._id) {

            var message = { auth: false, code: 'server_id_required', message: "Id is required" };
            res.status(400).send(message);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            let query = { _id: req.query._id };

            let paymentsFound = await paymentFind(query)

            res.status(200).send(paymentsFound);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentsFound);
            return res;

        };
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});


//Get uncollectible users
router.get('/api/private/payments/uncollectibleUsers', async (req, res, next) => {
    const context = "GET /api/private/payments/uncollectibleUsers";

    try {
        let query = {
            status: {
                $in: [
                    process.env.PaymentStatusStartPayment,
                    process.env.PaymentStatusFaild
                ]
            },
            clientName: {
                $in: [
                    process.env.clientNameEVIO,
                    process.env.clientNameACP
                ]
            }
        }

        let paymentsFailed = await paymentFind(query)

        console.log("paymentsFailed.length: " + paymentsFailed.length)

        let usersIds = [];
        let paymentWithUser = [];

        for (let i = 0; i != paymentsFailed.length; i++) {
            if (paymentsFailed[i].userId != "Unknown") {
                if (!usersIds.includes(paymentsFailed[i].userId))
                    usersIds.push(paymentsFailed[i].userId)
                paymentWithUser.push(paymentsFailed[i])
            }
        }

        let users = await getUsers(usersIds)

        console.log("users.length: " + users.length)

        let organizedUsers = []
        let listOfUnicUsers = []
        let countOfUnicUsers = []
        let sumOfValueOfUnicUsers = []
        let firstDateOfUnicUser = []
        let lastDateOfUnicUser = []

        for (let i = 0; i != paymentWithUser.length; i++) {
            for (let j = 0; j != users.length; j++) {
                if (paymentWithUser[i].userId == users[j]._id) {
                    organizedUsers.push(users[j]);
                    if (listOfUnicUsers.includes(users[j])) {
                        let index = listOfUnicUsers.indexOf(users[j]);
                        countOfUnicUsers[index] = countOfUnicUsers[index] + 1;
                        sumOfValueOfUnicUsers[index] = sumOfValueOfUnicUsers[index] + paymentWithUser[i].amount.value
                        if (moment(paymentWithUser[i].createdAt).isBefore(firstDateOfUnicUser[index]))
                            firstDateOfUnicUser[index] = paymentWithUser[i].createdAt
                        else if (moment(paymentWithUser[i].createdAt).isAfter(lastDateOfUnicUser[index]))
                            lastDateOfUnicUser[index] = paymentWithUser[i].createdAt
                    }
                    else {
                        listOfUnicUsers.push(users[j]);
                        countOfUnicUsers.push(1);
                        sumOfValueOfUnicUsers.push(paymentWithUser[i].amount.value)
                        firstDateOfUnicUser.push(paymentWithUser[i].createdAt)
                        lastDateOfUnicUser.push(paymentWithUser[i].createdAt)
                    }
                }
            }
        }

        //if (organizedUsers.length != usersIds.length) {
        //    console.log("Users (" + organizedUsers.length + ") and payments (" + paymentWithUser.length + ") have diferent Length!");
        //}

        const workbook = new Excel.Workbook();

        const usersSheet = workbook.addWorksheet('Users');
        const sumUserSheet = workbook.addWorksheet('Totals');

        usersSheet.columns = [
            {
                header: 'userId', key: 'userId', width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "paymentsId", key: "paymentsId", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "UserName", key: "UserName", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Email", key: "Email", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "International Prefix", key: "International Prefix", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Mobile", key: "Mobile", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Value", key: "Value", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Currency", key: "Currency", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "SessionId", key: "SessionId", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Charger Type", key: "Charger Type", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Blocked", key: "Blocked", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Creation Date", key: "Creation Date", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            }

        ];

        sumUserSheet.columns = [
            {
                header: 'User', key: 'User', width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Count of sessions", key: "Count of sessions", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Sum of value", key: "Sum of value", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "First session date", key: "First session date", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Last session date", key: "Last session date", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            }
        ];

        for (let i = 0; i != listOfUnicUsers.length; i++) {
            for (let j = 0; j != paymentWithUser.length; j++) {
                if (listOfUnicUsers[i]._id == paymentWithUser[j].userId) {

                    let userId = ""
                    let paymentId = ""
                    let userName = ""
                    let userEmail = ""
                    let userInternationalPrefix = ""
                    let userMobile = ""
                    let paymentAmountValue = ""
                    let paymentAmountCurrency = ""
                    let paymentSessionId = ""
                    let paymentChargerType = ""
                    let userBlocked = ""
                    let paymentCreatedAt = ""

                    if (listOfUnicUsers[i]._id)
                        userId = listOfUnicUsers[i]._id

                    if (paymentWithUser[j]._id)
                        paymentId = paymentWithUser[j]._id

                    if (listOfUnicUsers[i].name)
                        userName = listOfUnicUsers[i].name

                    if (listOfUnicUsers[i].email)
                        userEmail = listOfUnicUsers[i].email

                    if (listOfUnicUsers[i].internationalPrefix)
                        userInternationalPrefix = listOfUnicUsers[i].internationalPrefix

                    if (listOfUnicUsers[i].mobile)
                        userMobile = listOfUnicUsers[i].mobile

                    if (paymentWithUser[j].amount.value)
                        paymentAmountValue = paymentWithUser[j].amount.value

                    if (paymentWithUser[j].amount.currency)
                        paymentAmountCurrency = paymentWithUser[j].amount.currency

                    if (paymentWithUser[j].sessionId)
                        paymentSessionId = paymentWithUser[j].sessionId

                    if (paymentWithUser[j].chargerType)
                        paymentChargerType = paymentWithUser[j].chargerType

                    if (paymentWithUser[j].blocked)
                        userBlocked = paymentWithUser[j].blocked

                    if (paymentWithUser[j].createdAt)
                        paymentCreatedAt = moment(paymentWithUser[j].createdAt).format("DD-MM-YYYY")

                    usersSheet.addRow([userId, paymentId, userName, userEmail, userInternationalPrefix, userMobile, paymentAmountValue, paymentAmountCurrency, paymentSessionId, paymentChargerType, userBlocked, paymentCreatedAt])
                    //usersSheet.addRow([listOfUnicUsers[i]._id, paymentWithUser[j]._id, listOfUnicUsers[i].name, listOfUnicUsers[i].email, listOfUnicUsers[i].internationalPrefix, listOfUnicUsers[i].mobile, paymentWithUser[j].amount.value, paymentWithUser[j].amount.currency, paymentWithUser[j].sessionId, paymentWithUser[j].chargerType, listOfUnicUsers[i].blocked, moment(paymentWithUser[j].createdAt).format("DD-MM-YYYY")]);
                    continue;
                }
            }
        }

        for (let i = 0; i != listOfUnicUsers.length; i++) {

            let userName = ""

            if (listOfUnicUsers[i].name)
                userName = listOfUnicUsers[i].name

            sumUserSheet.addRow([userName, countOfUnicUsers[i], sumOfValueOfUnicUsers[i], moment(firstDateOfUnicUser[i]).format("DD-MM-YYYY"), moment(lastDateOfUnicUser[i]).format("DD-MM-YYYY")]);
        }

        const buffer = await workbook.xlsx.writeBuffer();

        let day = moment().format("DD-MM-YYYY")
        let emailFileName = "Relatório semanal dos utilizadores com dívidas (" + day + ").xlsx"
        let emailSubject = "Relatório semanal dos utilizadores com dívidas (" + day + ")";
        let emailText =
            `
Bom dia

 
Em anexo encontra-se o ficheiro de utilizadores em divida com a EVIO


Obrigado
`
        let cc = [];
        cc.push(process.env.EMAIL_TEST);
        //cc.push(process.env.EMAIL_ARMANDO);
        cc.push(process.env.EMAIL_EVIO);
        cc.push(process.env.EMAIL_BARBABRA)
        cc.push(process.env.EMAIL_INES)
        cc.push(process.env.EMAIL_FINANCE)

        if (process.env.NODE_ENV === 'production')
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_SUPPORT, [buffer], [emailFileName], emailSubject, emailText, cc)
        else
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [emailFileName], emailSubject, emailText, [])

        res.status(200).send();
        return res;

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        return res;
    };
});

router.get('/api/private/payments/checkUserHasDebt', paymentsController.checkUserHasDebt);

async function createuUcollectibleUsersDocument() {
    const context = "Function createuUcollectibleUsersDocument";

    try {
        let query = {
            status: {
                $in: [
                    process.env.PaymentStatusStartPayment,
                    process.env.PaymentStatusFaild
                ]
            },
            clientName: {
                $in: [
                    process.env.clientNameEVIO,
                    process.env.clientNameACP
                ]
            }
        }

        let paymentsFailed = await paymentFind(query)

        let usersIds = [];
        let paymentWithUser = [];

        for (let i = 0; i != paymentsFailed.length; i++) {
            if (paymentsFailed[i].userId != "Unknown") {
                if (!usersIds.includes(paymentsFailed[i].userId))
                    usersIds.push(paymentsFailed[i].userId)
                paymentWithUser.push(paymentsFailed[i])
            }
        }

        let users = await getUsers(usersIds)

        let organizedUsers = []
        let listOfUnicUsers = []
        let countOfUnicUsers = []
        let sumOfValueOfUnicUsers = []
        let firstDateOfUnicUser = []
        let lastDateOfUnicUser = []

        for (let i = 0; i != paymentWithUser.length; i++) {
            for (let j = 0; j != users.length; j++) {
                if (paymentWithUser[i].userId == users[j]._id) {
                    organizedUsers.push(users[j]);
                    if (listOfUnicUsers.includes(users[j])) {
                        let index = listOfUnicUsers.indexOf(users[j]);
                        countOfUnicUsers[index] = countOfUnicUsers[index] + 1;
                        sumOfValueOfUnicUsers[index] = sumOfValueOfUnicUsers[index] + paymentWithUser[i].amount.value
                        if (moment(paymentWithUser[i].createdAt).isBefore(firstDateOfUnicUser[index]))
                            firstDateOfUnicUser[index] = paymentWithUser[i].createdAt
                        else if (moment(paymentWithUser[i].createdAt).isAfter(lastDateOfUnicUser[index]))
                            lastDateOfUnicUser[index] = paymentWithUser[i].createdAt
                    }
                    else {
                        listOfUnicUsers.push(users[j]);
                        countOfUnicUsers.push(1);
                        sumOfValueOfUnicUsers.push(paymentWithUser[i].amount.value)
                        firstDateOfUnicUser.push(paymentWithUser[i].createdAt)
                        lastDateOfUnicUser.push(paymentWithUser[i].createdAt)
                    }
                }
            }
        }

        //if (organizedUsers.length != usersIds.length) {
        //    console.log("Users (" + organizedUsers.length + ") and payments (" + paymentWithUser.length + ") have diferent Length!");
        //}

        const workbook = new Excel.Workbook();

        const usersSheet = workbook.addWorksheet('Users');
        const sumUserSheet = workbook.addWorksheet('Totals');

        usersSheet.columns = [
            {
                header: 'userId', key: 'userId', width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "paymentsId", key: "paymentsId", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "UserName", key: "UserName", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Email", key: "Email", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "International Prefix", key: "International Prefix", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Mobile", key: "Mobile", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Value", key: "Value", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Currency", key: "Currency", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "SessionId", key: "SessionId", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Charger Type", key: "Charger Type", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Blocked", key: "Blocked", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Creation Date", key: "Creation Date", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            }

        ];

        sumUserSheet.columns = [
            {
                header: 'User', key: 'User', width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Count of sessions", key: "Count of sessions", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Sum of value", key: "Sum of value", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "First session date", key: "First session date", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            },
            {
                header: "Last session date", key: "Last session date", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
                }
            }
        ];

        for (let i = 0; i != listOfUnicUsers.length; i++) {
            for (let j = 0; j != paymentWithUser.length; j++) {
                if (listOfUnicUsers[i]._id == paymentWithUser[j].userId) {

                    let userId = ""
                    let paymentId = ""
                    let userName = ""
                    let userEmail = ""
                    let userInternationalPrefix = ""
                    let userMobile = ""
                    let paymentAmountValue = ""
                    let paymentAmountCurrency = ""
                    let paymentSessionId = ""
                    let paymentChargerType = ""
                    let userBlocked = ""
                    let paymentCreatedAt = ""

                    if (listOfUnicUsers[i]._id)
                        userId = listOfUnicUsers[i]._id

                    if (paymentWithUser[j]._id)
                        paymentId = paymentWithUser[j]._id

                    if (listOfUnicUsers[i].name)
                        userName = listOfUnicUsers[i].name

                    if (listOfUnicUsers[i].email)
                        userEmail = listOfUnicUsers[i].email

                    if (listOfUnicUsers[i].internationalPrefix)
                        userInternationalPrefix = listOfUnicUsers[i].internationalPrefix

                    if (listOfUnicUsers[i].mobile)
                        userMobile = listOfUnicUsers[i].mobile

                    if (paymentWithUser[j].amount.value)
                        paymentAmountValue = paymentWithUser[j].amount.value

                    if (paymentWithUser[j].amount.currency)
                        paymentAmountCurrency = paymentWithUser[j].amount.currency

                    if (paymentWithUser[j].sessionId)
                        paymentSessionId = paymentWithUser[j].sessionId

                    if (paymentWithUser[j].chargerType)
                        paymentChargerType = paymentWithUser[j].chargerType

                    if (paymentWithUser[j].blocked)
                        userBlocked = paymentWithUser[j].blocked

                    if (paymentWithUser[j].createdAt)
                        paymentCreatedAt = moment(paymentWithUser[j].createdAt).format("DD-MM-YYYY")

                    usersSheet.addRow([userId, paymentId, userName, userEmail, userInternationalPrefix, userMobile, paymentAmountValue, paymentAmountCurrency, paymentSessionId, paymentChargerType, userBlocked, paymentCreatedAt])
                    //usersSheet.addRow([listOfUnicUsers[i]._id, paymentWithUser[j]._id, listOfUnicUsers[i].name, listOfUnicUsers[i].email, listOfUnicUsers[i].internationalPrefix, listOfUnicUsers[i].mobile, paymentWithUser[j].amount.value, paymentWithUser[j].amount.currency, paymentWithUser[j].sessionId, paymentWithUser[j].chargerType, listOfUnicUsers[i].blocked, moment(paymentWithUser[j].createdAt).format("DD-MM-YYYY")]);
                    continue;
                }
            }
        }

        for (let i = 0; i != listOfUnicUsers.length; i++) {

            let userName = ""

            if (listOfUnicUsers[i].name)
                userName = listOfUnicUsers[i].name

            sumUserSheet.addRow([userName, countOfUnicUsers[i], sumOfValueOfUnicUsers[i], moment(firstDateOfUnicUser[i]).format("DD-MM-YYYY"), moment(lastDateOfUnicUser[i]).format("DD-MM-YYYY")]);
        }

        const buffer = await workbook.xlsx.writeBuffer();

        let day = moment().format("DD-MM-YYYY")
        let emailFileName = "Relatório semanal dos utilizadores com dívidas (" + day + ").xlsx"
        let emailSubject = "Relatório semanal dos utilizadores com dívidas (" + day + ")";
        let emailText =
            `
Bom dia

 
Em anexo encontra-se o ficheiro de utilizadores em divida com a EVIO


Obrigado
`
        let cc = [];
        cc.push(process.env.EMAIL_TEST);
        //cc.push(process.env.EMAIL_ARMANDO);
        cc.push(process.env.EMAIL_EVIO);
        cc.push(process.env.EMAIL_BARBABRA)
        cc.push(process.env.EMAIL_INES)
        cc.push(process.env.EMAIL_FINANCE)

        if (process.env.NODE_ENV === 'production')
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_SUPPORT, [buffer], [emailFileName], emailSubject, emailText, cc)
        else
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [emailFileName], emailSubject, emailText, [])

        return;

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return;
    };
}

let uncollectibleUserstask;

initJobUncollectibleUsersDocument("23 5 * * 1").then(() => {

    console.log("Uncollectible Users Document Job Started")

    uncollectibleUserstask.start();
});

router.post('/api/private/payments/uncollectibleUsers/startJob', (req, res) => {
    var context = "POST /api/private/payments/uncollectibleUsers/startJob";
    //TODO alterar o timer para os dias 9 do mes
    var timer = "23 5 * * 1";

    if (req.body.timer)
        timer = req.body.timer;

    try {

        initJobUncollectibleUsersDocument(timer).then(() => {

            console.log("Uncollectible Users Document Job Started")

            uncollectibleUserstask.start();
            return res.status(200).send('Uncollectible Users Document Job Started');
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

function initJobUncollectibleUsersDocument(timer) {
    return new Promise((resolve, reject) => {
        uncollectibleUserstask = cron.schedule(timer, () => {

            console.log('Running Job Uncollectible Users Document ' + new Date().toISOString());

            createuUcollectibleUsersDocument()
        }, {
            scheduled: false
        });
        resolve();
    });
};

router.post('/api/private/payments/uncollectibleUsers/stopJob', (req, res) => {
    var context = "POST /api/private/payments/uncollectibleUsers/stopJob";

    try {
        uncollectibleUserstask.stop();
        console.log("Uncollectible Users Document Job Stopped")
        return res.status(200).send('Uncollectible Users Document Job Stopped');
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/payments/uncollectibleUsers/statusJob', (req, res) => {
    var context = "POST /api/private/payments/uncollectibleUsers/statusJob";

    try {
        var status = "Stopped";
        if (uncollectibleUserstask != undefined) {
            status = uncollectibleUserstask.status;
        }

        return res.status(200).send({ "Uncollectible Users Document Job Status": status });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

router.post("/api/private/payments/verifyPendingTransactionsLusoPay", paymentsController.verifyPendingTransactionsLusoPay);

//========== DELETE ==========


//========== FUNCTION ==========

function paymentFindOne(query) {
    var context = "Function paymentFindOne";
    return new Promise((resolve, reject) => {
        Payments.findOne(query, (err, paymentFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(paymentFound);
            };
        });
    });
};

function paymentFind(query) {
    var context = "Function paymentFind";
    return new Promise((resolve, reject) => {
        Payments.find(query, (err, paymentsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(paymentsFound);
            };
        });
    });
};

function paymentUpdate(query, newValues) {
    var context = "Function paymentUpdate";
    return new Promise((resolve, reject) => {
        Payments.updatePayments(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function paymentUpdateFilter(query, newValues) {
    var context = "Function paymentUpdateFilter";
    return new Promise((resolve, reject) => {
        Payments.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {
            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getSession(sessionId) {
    var context = "Function getSession";
    return new Promise((resolve, reject) => {
        var host = process.env.HostCharger + process.env.PathGetChargingSession;
        var params = {
            _id: sessionId
        };
        axios.get(host, { params })
            .then((result) => {

                if (result.data) {
                    var session = result.data.chargingSession[0];
                    session = JSON.parse(JSON.stringify(session));
                    session.sessionId = sessionId;
                    resolve(session);
                }
                else {
                    resolve({});
                };

            })
            .catch((error) => {

                console.error(`[${context}][axios.get] Error `, error.message);
                reject(error);

            });
    });
};

function getUser(userId) {
    var context = "Function getUser";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetUser;
        var headers = {
            userid: userId
        };

        axios.get(host, { headers })
            .then((result) => {

                if (result.data) {
                    var user = result.data;
                    user = JSON.parse(JSON.stringify(user));
                    user.userId = userId;
                    resolve(user);
                }
                else {
                    resolve({});
                };

            })
            .catch((error) => {

                console.error(`[${context}][axios.get] Error `, error.message);
                reject(error);

            });
    });
};

function transactionsFindOne(query) {
    var context = "Function transactionsFindOne";
    return new Promise((resolve, reject) => {

        Transaction.findOne(query, (err, result) => {

            if (err) {

                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);

            }
            else {

                resolve(result);

            };
        });

    });
};

function transactionsFind(query) {
    var context = "Function transactionsFind";
    return new Promise((resolve, reject) => {

        Transaction.find(query, (err, result) => {

            if (err) {

                console.error(`[${context}][find] Error `, err.message);
                reject(err);

            }
            else {

                resolve(result);

            };
        });

    });
};

function validateFields(payments) {
    var context = "Function validateFields";
    return new Promise((resolve, reject) => {

        if (!payments)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!payments.sessionId)
            reject({ auth: false, code: 'server_sessionId_required', message: 'Session Id is required' });

        else if (!payments.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else if (!payments.amount)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });
        /*
        else if (!payments.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency is required' });
        */
        else if (!payments.paymentMethod)
            reject({ auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' });

        else if (!payments.amount.value && payments.amount.value != 0)
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else
            resolve(true);

    });
};

function validateFieldsMonthly(payments) {
    var context = "Function validateFields";
    return new Promise((resolve, reject) => {

        if (!payments)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!payments.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else if (!payments.paymentMethod)
            reject({ auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' });

        else if (!payments.amount)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });
        /*
        else if (!payments.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency is required' });
        */

        else if (!payments.amount.value && payments.amount.value != 0)
            reject({ auth: false, code: 'server_value_required', message: 'Amount value is required' });

        else
            resolve(true);

    });
};

function paymentMethodsFind(query) {
    var context = "Function paymentMethodsFind";
    return new Promise((resolve, reject) => {
        PaymentMethod.find(query, (err, paymentMethodsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {

                if (paymentMethodsFound.length > 0) {

                    paymentMethodsFound.sort((x, y) => { return x.defaultPaymentMethod - y.defaultPaymentMethod });
                    paymentMethodsFound.reverse();
                    resolve(paymentMethodsFound[0]);
                }
                else {
                    resolve(null);
                };

            };
        });
    });
};

function listPaymentMethodFindOne(query) {
    var context = "Function listPaymentMethodFindOne";
    return new Promise((resolve, reject) => {
        ListPaymentMethod.findOne(query, (err, paymentMethodsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve({ userType: "b2c" });
            }
            else {

                if (paymentMethodsFound)
                    resolve(paymentMethodsFound);
                else
                    resolve({ userType: "b2c" });
            };
        });
    });
};

function makePayment(payment) {
    var context = "Function makePayment payments";
    return new Promise(async (resolve, reject) => {

        try {

            if (payment.paymentType === process.env.PaymentTypeMonthly) {
                console.log("1")

                switch (payment.paymentMethod) {

                    case process.env.PaymentMethodWallet:

                        makePaymentWalletMonthly(payment)
                            .then((result) => {

                                if (result.status === process.env.PaymentStatusPaidOut) {


                                    if (
                                        result.chargerType === process.env.MobieCharger ||
                                        result.chargerType === Enums.ChargerTypes.Gireve ||
                                        result.chargerType === Enums.ChargerTypes.Hubject
                                    ) {
                                        updateMultiSessionMobiE(result)
                                    }
                                    else {
                                        updateMultiSessionEVIO(result);
                                    };


                                };

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentWalletMonthly] Error `, error.message);
                                reject(error);

                            });

                        break;

                    case process.env.PaymentMethodCard:

                        makePaymentCardMonthly(payment)
                            .then((result) => {

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentCardMonthly] Error `, error.message);
                                reject(error);

                            });

                        break;

                    case process.env.PaymentMethodNotPay:

                        //resolve();
                        makePaymentNotPay(payment)
                            .then((result) => {

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentNotPay] Error `, error.message);
                                reject(error);

                            });

                        break;

                    case process.env.PaymentMethodUnknown:
                        resolve();
                        break;

                    case process.env.PaymentMethodUnknownPayments:
                        resolve();
                        break;

                    default:

                        makePaymentWalletMonthly(payment)
                            .then((result) => {

                                if (result.status === process.env.PaymentStatusPaidOut) {


                                    if (
                                        result.chargerType === process.env.MobieCharger ||
                                        result.chargerType === Enums.ChargerTypes.Gireve ||
                                        result.chargerType === Enums.ChargerTypes.Hubject
                                    ) {
                                        updateMultiSessionMobiE(result)
                                    }
                                    else {
                                        updateMultiSessionEVIO(result);
                                    };


                                };

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentWalletMonthly] Error `, error.message);
                                reject(error);

                            });

                        break;

                };

            }
            else {
                console.log("2")
                switch (payment.paymentMethod) {

                    case process.env.PaymentMethodWallet:

                        makePaymentWallet(payment)
                            .then((result) => {

                                if (result.status === process.env.PaymentStatusPaidOut) {

                                    if (
                                        result.chargerType === process.env.MobieCharger ||
                                        result.chargerType === Enums.ChargerTypes.Gireve ||
                                        result.chargerType === Enums.ChargerTypes.Hubject
                                    ) {
                                        updateSessionMobiE(result, "makePayment-makePaymentWallet")
                                    }
                                    else {
                                        updateSessionEVIO(result, "makePayment-makePaymentWallet")
                                    };

                                };

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentWallet] Error `, error.message);
                                reject(error);

                            });

                        break;

                    case process.env.PaymentMethodCard:
                        makePaymentCard(payment)
                            .then((result) => {
                                resolve(result);
                            })
                            .catch((error) => {
                                console.error(`[${context}][makePaymentCard] Error `, error.message);
                                reject(error);
                            });

                        break;

                    case process.env.PaymentMethodNotPay:

                        //resolve();
                        makePaymentNotPay(payment)
                            .then((result) => {

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentNotPay] Error `, error.message);
                                reject(error);

                            });

                        break;

                    case process.env.PaymentMethodUnknown:
                        resolve();
                        break;

                    case process.env.PaymentMethodUnknownPayments:
                        resolve();
                        break;

                    default:

                        //TODO
                        makePaymentWallet(payment)
                            .then((result) => {

                                if (result.status === process.env.PaymentStatusPaidOut) {

                                    if (
                                        result.chargerType === process.env.MobieCharger ||
                                        result.chargerType === Enums.ChargerTypes.Gireve ||
                                        result.chargerType === Enums.ChargerTypes.Hubject
                                    ) {
                                        updateSessionMobiE(result, "makePayment-makePaymentWallet")
                                    }
                                    else {
                                        updateSessionEVIO(result, "makePayment-makePaymentWallet")
                                    };

                                };

                                resolve(result);

                            })
                            .catch((error) => {

                                console.error(`[${context}][makePaymentWallet] Error `, error.message);
                                reject(error);

                            });

                        break;

                };

            };

        } catch (error) {

            console.error(`[${context}][] Error `, error.message);
            reject(error);

        };
    });
};

function makePaymentPeriodic(payment) {
    var context = "Function makePaymentPeriodic payments";
    return new Promise(async (resolve, reject) => {

        try {

            switch (payment.paymentMethod) {

                case process.env.PaymentMethodWallet:

                    makePaymentWallet(payment)
                        .then((result) => {

                            if (result.status === process.env.PaymentStatusPaidOut) {

                                updateSessions(result);

                            };

                            resolve(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][makePaymentWallet] Error `, error.message);
                            reject(error);

                        });

                    break;

                case process.env.PaymentMethodCard:
                    makePaymentCard(payment)
                        .then((result) => {

                            updateSessions(result);
                            resolve(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][makePaymentCard] Error `, error.message);
                            reject(error);

                        });

                    break;

                case process.env.PaymentMethodNotPay:

                    //resolve();
                    makePaymentNotPay(payment)
                        .then((result) => {

                            updateSessions(result);
                            resolve(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][makePaymentNotPay] Error `, error.message);
                            reject(error);

                        });

                    break;

                case process.env.PaymentMethodUnknown:

                    resolve();
                    /*makePaymentUnknown(payment)
                        .then((result) => {

                            updateSessions(result);
                            resolve(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][makePaymentUnknown] Error `, error.message);
                            reject(error);

                        });*/

                    break;

                /*case process.env.PaymentMethodPlafond:

                    makePaymentPlafond(payment)
                        .then((result) => {

                            updateSessions(result);
                            resolve(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][makePaymentPlafond] Error `, error.message);
                            reject(error);

                        });

                    break;*/

                case process.env.PaymentMethodUnknownPayments:

                    resolve();
                    /* makePaymentUnknown(payment)
                         .then((result) => {

                             updateSessions(result);
                             resolve(result);

                         })
                         .catch((error) => {

                             console.error(`[${context}][makePaymentUnknown] Error `, error.message);
                             reject(error);

                         });*/

                    break;

                default:

                    //TODO
                    makePaymentWallet(payment)
                        .then((result) => {

                            if (result.status === process.env.PaymentStatusPaidOut) {

                                updateSessions(result);

                            };

                            resolve(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][makePaymentWallet] Error `, error.message);
                            reject(error);

                        });

                    break;

            };

        } catch (error) {

            console.error(`[${context}][] Error `, error.message);
            reject(error);

        };
    });
};

function validateFieldsPaymentConditions(request) {
    var context = "Function validateFieldsPaymentConditions";
    return new Promise((resolve, reject) => {

        if (Object.keys(request).length === 0)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!request.userId)
            reject({ auth: false, code: 'server_userId_required', message: 'User Id is required' });

        else if (!request.data)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (Object.keys(request.data).length === 0)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!request.data.hwId)
            reject({ auth: false, code: 'server_hw_id_required', message: 'HWID is required!' });

        else if (!request.data.plugId)
            reject({ auth: false, code: 'server_plug_id_required', message: "Plug Id is required" });

        else if (!request.data.evId)
            reject({ auth: false, code: 'server_evId_required', message: "EV Id is required" });

        else if (!request.data.tariffId)
            reject({ auth: false, code: 'server_tariffId_required', message: "Tariff Id is required" });

        else if (!request.data.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: "Charger Type is required" });

        else
            resolve(true);

    });
};

function createTransactions(transaction) {
    var context = "Funciton createTransactions";
    return new Promise((resolve, reject) => {
        Transactions.createTransactions(transaction, (err, result) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                reject(err);

            }
            else {

                addTransactionToWallet(result)
                    .then((value) => {

                        resolve(result);

                    })
                    .catch((error) => {

                        console.error(`[${context}][addTransactionToWallet] Error `, error.message);
                        reject(error);

                    });

            };
        });
    });
};

function createPayments(payment) {
    var context = "Funciton createPayments";
    return new Promise((resolve, reject) => {
        Payments.createPayments(payment, (err, result) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                reject(err);

            }
            else {

                resolve(result);

            };
        });
    });
};

function createNewTransactions(transaction) {
    var context = "Funciton createNewTransactions";
    return new Promise((resolve, reject) => {
        Transactions.createTransactions(transaction, (err, result) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                reject(err);

            }
            else {

                resolve(result);

            };
        });
    });
};

function addTransactionToWallet(transaction) {
    var context = "Function addTransactionToWallet";
    return new Promise((resolve, reject) => {
        var query = {
            userId: transaction.userId
        };

        var newTransaction = {
            $push: {
                transactionsList: {
                    transactionId: transaction._id,
                    transactionType: transaction.transactionType,
                    status: transaction.status
                }
            }
        };

        Wallet.addTansationsList(query, newTransaction, (err, result) => {
            if (err) {

                console.error(`[${context}][addTansationsList] Error `, err.message);
                reject(err);

            }
            else {

                if (result) {

                    resolve(true);

                }
                else {

                    resolve(false);

                };

            };
        });

    });
};

function makePaymentWallet(payment) {
    var context = "Function makePaymentWallet";
    return new Promise(async (resolve, reject) => {
        try {

            let transactionId;
            if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                //Created a new transaction
                var newTransaction = new Transactions(
                    {
                        userId: payment.userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderWallet,
                        amount: payment.amount,
                        sessionId: payment.sessionId,
                        paymentId: payment._id,
                        clientName: payment.clientName
                    }
                );

                let transactionCreated = await createTransactions(newTransaction);
                transactionId = transactionCreated._id.toString();
            } else {
                transactionId = payment.transactionId;
            }
            //Query to transaction
            var queryTransaction = {
                _id: transactionId
            };

            var transaction = {
                $set: {
                    status: process.env.TransactionStatusPaidOut,
                    data: process.env.ReasonSuccessBalance
                }
            };

            var queryPayment = {
                _id: payment._id
            };

            //Update transaction to status
            transactionsUpdate(queryTransaction, transaction)
                .then((result) => {

                    result.status = process.env.TransactionStatusPaidOut;

                    //Remove balance from wallet
                    removeBalanceToWallet(result)
                        .then((value) => {

                            //console.log("value", value);

                            if (value) {

                                var newValuesPayments = {
                                    $set: {
                                        status: process.env.TransactionStatusPaidOut,
                                        reason: process.env.ReasonSuccessBalance,
                                        transactionId: result._id
                                    }
                                };

                                //Update payment
                                paymentUpdate(queryPayment, newValuesPayments)
                                    .then(async (paymentsUpdated) => {

                                        let response = await paymentFindOne(queryPayment);

                                        if (/*process.env.NODE_ENV === 'production' &&*/ !process.env.PublicNetworkChargerType.includes(response.chargerType) && response.amount.value > 0) {

                                            // sendBillingDocument(response);

                                        };

                                        resolve(response);

                                    })
                                    .catch((error) => {

                                        updateTransactionFaild(queryTransaction);
                                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                                        reject(error);

                                    });
                            }
                            else {
                                var transaction = {
                                    $set: {
                                        status: process.env.TransactionStatusFaild,
                                        data: process.env.ReasonFailNoBalance
                                    }
                                };
                                transactionsUpdate(queryTransaction, transaction)
                                    .then(() => {
                                        var newValuesPayments = {
                                            $set: {
                                                status: process.env.TransactionStatusFaild,
                                                reason: process.env.ReasonFailNoBalance,
                                                transactionId: result._id
                                            }
                                        };
                                        //Update payment
                                        paymentUpdate(queryPayment, newValuesPayments)
                                            .then(async (paymentsUpdated) => {

                                                let response = await paymentFindOne(queryPayment);

                                                resolve(response);

                                            })
                                            .catch((error) => {

                                                updateTransactionFaild(queryTransaction);
                                                console.error(`[${context}][paymentUpdate] Error `, error.message);
                                                reject(error);

                                            });

                                    })
                                    .catch((error) => {

                                        updateTransactionFaild(queryTransaction);
                                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                                        reject(error);

                                    });

                            };

                        })
                        .catch((error) => {

                            updateTransactionFaild(queryTransaction);
                            console.error(`[${context}][removeBalanceToWallet] Error `, error.message);
                            reject(error);

                        });

                })
                .catch((error) => {

                    updateTransactionFaild(queryTransaction);
                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function makePaymentWalletMonthly(payment) {
    var context = "Function makePaymentWallet";
    return new Promise(async (resolve, reject) => {
        try {

            let transactionId;
            if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                //Created a new transaction
                var newTransaction = new Transactions(
                    {
                        userId: payment.userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderWallet,
                        amount: payment.amount,
                        listOfSessions: payment.listOfSessions,
                        paymentId: payment._id

                    }
                );

                let transactionCreated = await createTransactions(newTransaction);
                transactionId = transactionCreated._id.toString();

            }
            else {
                transactionId = payment.transactionId;
            };

            //Query to transaction
            var queryTransaction = {
                _id: transactionId
            };

            var transaction = {
                $set: {
                    status: process.env.TransactionStatusPaidOut,
                    data: process.env.ReasonSuccessBalance
                }
            };

            var queryPayment = {
                _id: payment._id
            };

            //Update transaction to status
            transactionsUpdate(queryTransaction, transaction)
                .then((result) => {

                    result.status = process.env.TransactionStatusPaidOut;

                    //Remove balance from wallet
                    removeBalanceToWallet(result)
                        .then((value) => {

                            if (value) {

                                var newValuesPayments = {
                                    $set: {
                                        status: process.env.TransactionStatusPaidOut,
                                        reason: process.env.ReasonSuccessBalance,
                                        transactionId: result._id
                                    }
                                };

                                //Update payment
                                paymentUpdate(queryPayment, newValuesPayments)
                                    .then(async (paymentsUpdated) => {

                                        let response = await paymentFindOne(queryPayment);

                                        if (/*process.env.NODE_ENV === 'production' &&*/ !process.env.PublicNetworkChargerType.includes(response.chargerType) && response.amount.value > 0) {

                                            // sendBillingDocument(response);

                                        };

                                        resolve(response);

                                    })
                                    .catch((error) => {

                                        updateTransactionFaild(queryTransaction);
                                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                                        reject(error);

                                    });
                            }
                            else {
                                var transaction = {
                                    $set: {
                                        status: process.env.TransactionStatusFaild,
                                        data: process.env.ReasonFailNoBalance
                                    }
                                };
                                transactionsUpdate(queryTransaction, transaction)
                                    .then(() => {
                                        var newValuesPayments = {
                                            $set: {
                                                status: process.env.TransactionStatusFaild,
                                                reason: process.env.ReasonFailNoBalance,
                                                transactionId: result._id
                                            }
                                        };
                                        //Update payment
                                        paymentUpdate(queryPayment, newValuesPayments)
                                            .then(async (paymentsUpdated) => {

                                                let response = await paymentFindOne(queryPayment);

                                                resolve(response);

                                            })
                                            .catch((error) => {

                                                updateTransactionFaild(queryTransaction);
                                                console.error(`[${context}][paymentUpdate] Error `, error.message);
                                                reject(error);

                                            });

                                    })
                                    .catch((error) => {

                                        updateTransactionFaild(queryTransaction);
                                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                                        reject(error);

                                    });

                            };

                        })
                        .catch((error) => {

                            updateTransactionFaild(queryTransaction);
                            console.error(`[${context}][removeBalanceToWallet] Error `, error.message);
                            reject(error);

                        });

                })
                .catch((error) => {

                    updateTransactionFaild(queryTransaction);
                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function makePaymentNotPay(payment) {
    var context = "Function makePaymentNotPay";
    return new Promise(async (resolve, reject) => {
        try {


            var queryPayment = {
                _id: payment._id
            };

            var newValuesPayments = {
                $set: {
                    status: process.env.TransactionStatusPaidOut,
                    reason: process.env.ReasonSuccessBalance
                }
            };

            //Update payment
            paymentUpdate(queryPayment, newValuesPayments)
                .then(async (paymentsUpdated) => {

                    let response = await paymentFindOne(queryPayment);

                    resolve(response);

                })
                .catch((error) => {

                    updateTransactionFaild(queryTransaction);
                    console.error(`[${context}][paymentUpdate] Error `, error.message);
                    reject(error);

                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};


async function makeTransactionPlafond(session) {
    let context = "Function makeTransactionPlafond";
    try {

        const queryFindOldTransation = { sessionId: session._id }

        let oldTransaction = await transactionsFindOne(queryFindOldTransation);

        if (oldTransaction && oldTransaction.status == process.env.TransactionStatusPaidOut) {
            await chargingSessionsService.sessionSyncToPlafond(session)
            return;
        }

        let transaction;
        let transactionId;

        if (oldTransaction) {
            transaction = oldTransaction;
            transactionId = oldTransaction._id.toString();
        }
        else {

            //Created a new transaction
            let newTransaction = new Transactions(
                {
                    userId: session.userIdWillPay,
                    transactionType: process.env.TransactionTypeDebit,
                    status: process.env.TransactionStatusInPayment,
                    provider: process.env.TransactionProviderPlafond,
                    amount: { value: session.estimatedPrice },
                    sessionId: session._id,
                    paymentId: session.plafondId,
                    chargerType: session.chargerType,
                    clientName: session.clientName
                }
            );

            let transactionCreated = await createNewTransactions(newTransaction);
            transactionId = transactionCreated._id.toString();
            transaction = transactionCreated;
        }

        console.log("session", session._id, "transaction", { paymentId, userId, sessionId } = transaction);

        transaction.paymentId = session.plafondId;

        removeAmountFromPlafondAndTransation(transaction)
            .then(async (response) => {
                //console.log("response", response);
                try {
                    let transactionUpdated = await transactionsUpdateFilter({ _id: transactionId }, { $set: { status: process.env.TransactionStatusPaidOut } });

                    await chargingSessionsService.sessionSyncToPlafond(session)

                } catch (error) {

                    console.error(`[${context}][] Error `, error);

                }


            })
            .catch(async (error) => {

                let transactionUpdated = await transactionsUpdateFilter({ _id: transactionId }, { $set: { status: process.env.TransactionStatusFaild } });
                console.error(`[${context}][transactionsUpdate] Error `, error.message);

            });



    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        reject(error);

    };

};

function validateBillingProfile(userId) {
    var context = "Function getActiveSessionsMyChargers";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.HostUser + process.env.PathValidateBilling;
            var headers = {
                userid: userId
            };

            axios.get(proxy, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.error(`[${context}][${proxy}] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function setKIntoPaymentInfo(userIdWillPay, clientType, clientName, planCeme, viesVAT, userIdToBilling, plafondId, cardNumber) {
    return {
        paymentMethod: process.env.PaymentMethodTypeTransfer,
        paymentMethodId: "",
        walletAmount: 0,
        reservedAmount: 0,
        confirmationAmount: 0,
        userIdWillPay: userIdWillPay,
        adyenReference: "",
        transactionId: "",
        clientType: clientType,
        clientName: clientName,
        ceme: planCeme,
        viesVAT: viesVAT,
        paymentType: process.env.PaymentTypeMonthly,
        billingPeriod: process.env.PaymentTypeMonthly,
        userIdToBilling: userIdToBilling,
        plafondId: plafondId,
        cardNumber: cardNumber
    };
}

function getSessionEV(evId) {
    const context = "Function getSessionEV";

    return new Promise((resolve, reject) => {
        try {
            getEVById(evId).then((result) => {
                console.log(`[${context}] Result `, result);
                resolve(result);
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

function transactionsUpdate(query, newValues) {
    var context = "Function transactionsUpdate";
    return new Promise((resolve, reject) => {

        Transactions.updateTransactions(query, newValues, (err, result) => {

            if (err) {
                console.error(`[${context}][updateTransactions] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };

        });

    });
};

function transactionsUpdateFilter(query, newValues) {
    var context = "Function transactionsUpdateFilter";
    return new Promise((resolve, reject) => {

        Transactions.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {

            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };

        });

    });
};

function walletFindOne(query) {
    var context = "Funciton walletFindOne";
    return new Promise((resolve, reject) => {
        Wallet.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
                //reject(result);
            };

        });

    });
};

function removeBalanceToWallet(transaction) {
    var context = "Function removeBalanceToWallet";
    return new Promise(async (resolve, reject) => {
        let wallet = await walletFindOne({ userId: transaction.userId });

        if (wallet) {

            var found = wallet.transactionsList.find(elem => {
                return elem.transactionId == transaction._id
            });

            if (found) {

                if (wallet.amount.value - transaction.amount.value >= 0) {

                    var query = {

                        userId: transaction.userId,
                        "transactionsList.transactionId": transaction._id

                    };

                    var newTransaction = {

                        $set: {
                            "transactionsList.$.status": transaction.status,
                            "transactionsList.$.transactionType": transaction.transactionType
                        },
                        $inc: {
                            "amount.value": -transaction.amount.value

                        }
                    };

                    Wallet.updateOne(query, newTransaction, (err, result) => {
                        if (err) {

                            console.error(`[${context}][updateOne] Error `, err.message);
                            reject(err);

                        }
                        else {

                            resolve(true);

                        };
                    });

                }
                else {
                    var query = {

                        userId: transaction.userId,
                        "transactionsList.transactionId": transaction._id

                    };

                    var newTransaction = {

                        $set: {
                            "transactionsList.$.status": process.env.TransactionStatusFaild,
                            "transactionsList.$.transactionType": transaction.transactionType
                        }
                    };

                    Wallet.updateOne(query, newTransaction, (err, result) => {
                        if (err) {

                            console.error(`[${context}][updateOne] Error `, err.message);
                            reject(err);

                        }
                        else {

                            resolve(false);

                        };
                    });
                };

            }
            else {

                //console.log("found 1", found);
                if (wallet.amount.value - transaction.amount.value >= 0) {

                    var query = {

                        userId: transaction.userId

                    };

                    var newTransaction = {

                        $push: {
                            transactionsList: {
                                transactionId: transaction._id,
                                transactionType: transaction.transactionType,
                                status: transaction.status
                            }

                        },
                        $inc: {
                            "amount.value": -transaction.amount.value

                        }
                    };

                    Wallet.addTansationsList(query, newTransaction, (err, result) => {
                        if (err) {

                            console.error(`[${context}][updateOne] Error `, err.message);
                            reject(err);

                        }
                        else {

                            resolve(true);

                        };
                    })

                }
                else {

                    var query = {

                        userId: transaction.userId

                    };

                    var newTransaction = {

                        $push: {
                            transactionsList: {
                                transactionId: transaction._id,
                                transactionType: transaction.transactionType,
                                status: process.env.TransactionStatusFaild,
                            }

                        }
                    };

                    Wallet.addTansationsList(query, newTransaction, (err, result) => {
                        if (err) {

                            console.error(`[${context}][updateOne] Error `, err.message);
                            reject(err);

                        }
                        else {

                            resolve(false);

                        };
                    })
                };
            };

        }
        else {

            console.error(`[${context}][walletFindOne] Wallet not found `);
            reject('Wallet not found');

        };

    });
};

function updateTransactionFaild(queryTransaction) {
    var context = "Function updateTransactionFaild";

    var transaction = {
        $set: {
            status: process.env.TransactionStatusFaild,
            data: process.env.ReasonFail
        }
    };

    transactionsUpdate(queryTransaction, transaction)
        .then((result) => {

            result.status = process.env.TransactionStatusFaild;
            updateTransactionToWallet(result);

        })
        .catch((error) => {

            console.error(`[${context}][transactionsUpdate] Error `, error.message);
        });

};

function updateTransactionToWallet(transaction) {
    var context = "Function updateTransactionToWallet";

    var query = {

        userId: transaction.userId,
        "transactionsList.transactionId": transaction._id

    };

    var newTransaction = {

        $set: {
            "transactionsList.$.status": transaction.status,
            "transactionsList.$.transactionType": transaction.transactionType
        }
    };


    Wallet.updateOne(query, newTransaction, (err, result) => {
        if (err) {
            console.error(`[${context}][updateOne] Error `, err.message);
            //reject(err);
        }
        else {
            console.log(`[${context}][updateOne]  Updated`);
        };
    });

};

async function sendBillingDocument_old(paymentFound) {
    var context = "Function sendBillingDocument";
    //return new Promise((resolve, reject) => {
    try {

        let monthlyBilling = await validateMonthlyBilling(paymentFound);

        if (!monthlyBilling) {

            var proxyBilling = process.env.HostBilling + process.env.PathBillingDocument;

            var headers = {
                userId: paymentFound.userId,
                chargerType: paymentFound.chargerType
            };

            getChargerIva(paymentFound.hwId, paymentFound.chargerType)
                .then(iva => {

                    let price_excl_vat;

                    if (paymentFound.totalPrice) {
                        price_excl_vat = paymentFound.totalPrice.excl_vat;
                    }
                    else {
                        price_excl_vat = paymentFound.amount.value / (1 + iva);
                    };

                    var payments = {
                        payment: price_excl_vat,
                        currency: paymentFound.amount.currency,
                        paymentRef: paymentFound._id,
                        iva: iva
                    };

                    var data = {
                        headers: headers,
                        payments: [payments]
                    };

                    axios.post(proxyBilling, data)
                        .then((result) => {

                            //console.log("Result: ", result.data);

                            //updateSessionInvoice(paymentFound, result.data);
                            updateSessionInvoice(paymentFound, { invoiceId: result.data.invoiceId, invoiceStatus: true });
                            //TODO concet to chaging session
                            //resolve(result.data);
                        })
                        .catch((error) => {
                            console.error(`[${context}][axiso.post] Error `, error.message);
                            updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
                            //reject(error);
                        });
                })
                .catch((error) => {
                    console.error(`[${context}][getChargerIva] Error `, error.message);
                    updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
                });

        } else {
            console.log(`[${context}] Monthly Billing `);
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
        //reject(error);
    };
    //})
};

function validateMonthlyBilling(paymentFound) {
    var context = "Function validateMonthlyBilling";
    return new Promise((resolve, reject) => {

        var host = process.env.HostUser + process.env.PathMonthlyBilling + "/" + paymentFound.userId;

        axios.get(host)
            .then(response => {

                //console.log(response.data);
                resolve(response.data.monthlyBilling);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(false);
            });
    });
};

async function sendBillingDocument(paymentFound) {
    var context = "Function sendBillingDocument";
    //return new Promise((resolve, reject) => {
    try {

        let proxyBilling;

        if (paymentFound.clientName === process.env.clientNameEVIO) {
            proxyBilling = process.env.HostBilling + process.env.PathBillingDocument;
        } else {
            proxyBilling = process.env.HostBilling + process.env.PathBillingDocumentWL;
        };

        let data = await Invoices.createInvoiceDate(paymentFound);

        let headers = {
            'userid': data.invoice.header.userId,
            'clientname': data.invoice.header.clientname,
            'source': data.invoice.header.source,
            'ceme': data.invoice.header.ceme,
        }

        axios.post(proxyBilling, data, { headers })
            .then((result) => {

                //console.log("Result: ", result.data);

                //updateSessionInvoice(paymentFound, result.data);
                updateSessionInvoice(paymentFound, { invoiceId: result.data.invoiceId, invoiceStatus: true });
                //TODO concet to chaging session
                //resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}][axiso.post] Error `, error.message);
                updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
                //reject(error);
            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
        //reject(error);
    };
    //})
};

/*createInvoiceDate({
    "_id": "610c0493082bed002063e576",
    "userId": "602fcee210f1ce00201b178f",
    "sessionId": "610c047e33b890002070a08b",
    "hwId": "8925F0",
    "chargerType": "007",
    "listOfSessionsMonthly": []
})
    .then((result) => {
        console.log("result", result);
    })
    .catch((error) => {
        console.error(`[] Error `, error.message);
    });*/

function createInvoiceDate(paymentFound) {
    var context = "Function createInvoiceDate";
    return new Promise(async (resolve, reject) => {
        try {

            let sessionsId;
            if (paymentFound.listOfSessionsMonthly.length > 0) {
                sessionsId = await getSessionsIds(paymentFound.listOfSessionsMonthly);
            } else {
                sessionsId = paymentFound.sessionId;
            };

            //TODO
            let listOfSessions = await getSessions(sessionsId);

            let invoice = {

                paymentId: paymentFound._id,
                header: {
                    userId: paymentFound.userId,
                    chargerType: paymentFound.chargerType
                },
                lines: []

            };

            var footer = {
                total_exc_vat: 0,
                total_inc_vat: 0
            };

            var others = 0;
            var activationFee = 0;
            var attachLines = [];

            var totalTime = 0;
            var numberSessions = listOfSessions.length;
            var totalPower = 0;
            let lines = [];
            var vatPrice;
            var chargingSessionsEVIO = 0;

            if (listOfSessions.length === 0) {

                resolve(false);

            } else {

                Promise.all(listOfSessions.map(session => {

                    return new Promise(async (resolve, reject) => {

                        session = JSON.parse(JSON.stringify(session));

                        //console.log("session", session);

                        let invoiceLine = await getInvoiceLines(session);

                        lines.push(invoiceLine);

                        totalTime += session.timeCharged;
                        totalPower += session.totalPower;
                        footer.total_exc_vat += session.totalPrice.excl_vat;
                        footer.total_inc_vat += session.totalPrice.incl_vat;
                        chargingSessionsEVIO += session.totalPrice.excl_vat

                        let evioTimeCost = 0;
                        let evioEnergyCost = 0;


                        let use_energy = 0;
                        let use_time = 0;


                        if (session.tariff.tariffType === process.env.TariffByPower) {
                            evioEnergyCost = session.tariff.tariff.chargingAmount.value;
                            use_energy = session.costDetails.costDuringCharge;
                        } else {
                            evioTimeCost = session.tariff.tariff.chargingAmount.value;
                            use_time = session.costDetails.costDuringCharge;
                        }

                        activationFee += session.costDetails.activationFee;

                        //console.log("session", session);
                        vatPrice = session.fees.IVA;

                        var attachLine = {
                            "date": moment(session.startDate).format("DD/MM/YYYY"),
                            "startTime": moment(session.startDate).format("HH:mm"),//.getTime().format("HH:mm"),
                            "duration": new Date(session.costDetails.totalTime * 1000).toISOString().substr(11, 5),
                            "city": session.address.city,
                            "network": process.env.clientNameEVIO,
                            "hwId": session.hwId,
                            "totalPower": session.costDetails.totalPower / 1000,
                            "charging_duration": new Date(session.costDetails.timeCharged * 1000).toISOString().substr(11, 5),
                            "use_energy": use_energy,
                            "use_time": use_time,
                            "opcFlatCost": session.costDetails.activationFee,
                            "charging_parking": session.costDetails.parkingDuringCharging,
                            "charging_after_parking": session.costDetails.parkingAmount,
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

                    var body = {
                        invoice: invoice,
                        attach: {
                            overview: {
                                footer: footer,
                                lines: {
                                    evio_services: {
                                        total_exc_vat: others,
                                        vat: vatPrice
                                    },
                                    evio_network: {
                                        total_exc_vat: chargingSessionsEVIO - others,
                                        vat: vatPrice
                                    },
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

            };

        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error)
        }

    });
};

function getInvoiceLines(session) {
    var context = "Function getLines";
    return new Promise((resolve, reject) => {
        let quantity;
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

        quantity = parseFloat(quantity.toFixed(2));

        let line = {
            code: "ISERV21014",
            description: "Serviços rede EVIO",
            unitPrice: session.tariff.tariff.chargingAmount.value,
            uom: session.tariff.tariff.chargingAmount.uom,
            quantity: quantity,
            vat: session.fees.IVA,
            discount: 0,
            total: 0
        };
        if (session?.fees?.IVA == 0) {
            line.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40;
        }
        //console.log("line", line);
        resolve(line);

    });
};

function getSessions(sessionsId) {
    var context = "Function getSessions";
    return new Promise(async (resolve, reject) => {
        try {

            let host = process.env.HostCharger + process.env.PathGetSessionsBilling + "/" + sessionsId;

            axios.get(host)
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.error(`[${context}] Error `, error.message);
                    resolve([]);
                })
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve([]);
        }

    });
};

function getSessionsIds(listOfSessionsMonthly) {
    var context = "Function getSessionsIds";
    return new Promise(async (resolve, reject) => {
        let sessionsId = [];

        Promise.all(
            listOfSessionsMonthly.map(session => {
                return new Promise(resolve => {
                    if (!process.env.PublicNetworkChargerType.includes(session.chargerType)) {
                        sessionsId.push(session.sessionId);
                        resolve(true);
                    } else {
                        resolve(false);
                    };
                });
            })
        ).then(() => {

            resolve(sessionsId);

        });

    });
};

//Function to update invoiceId and invoiceStatus
function updateSessionInvoice(paymentFound, invoice) {
    var context = "Function updateSessionInvoice";

    try {
        let params;

        if (paymentFound.paymentType === process.env.PaymentTypeMonthly) {
            params = {
                _id: paymentFound.listOfSessions
            };
        }
        else {
            params = {
                _id: paymentFound.sessionId
            };
        };

        let data = {
            invoiceId: invoice.invoiceId,
            invoiceStatus: invoice.invoiceStatus
        };

        let proxyCharger = process.env.HostCharger + process.env.PathUpdateSessionInvoice;

        axios.patch(proxyCharger, data, { params })
            .then((result) => {
                //console.log("Result: ", result.data);
                console.log("Invoice created")
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

function getChargerIva(hwId, chargerType) {
    var context = "Function getChargerIva";
    return new Promise((resolve, reject) => {

        let proxy;
        let params;

        switch (chargerType) {
            case '003':
                //Open Charge Map
                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;
                params = {
                    hwId: hwId
                };

                break;
            case '004':
                //MobiE
                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;
                params = {
                    hwId: hwId
                };

                break;
            case '009':
                //Tesla
                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;
                params = {
                    hwId: hwId
                };

                break;
            case '010':
                //Gireve
                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;
                params = {
                    hwId: hwId
                };

                break;
            case Enums.ChargerTypes.Hubject:
                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;
                params = {
                    hwId: hwId
                };

                break;
            default:

                proxy = process.env.HostCharger + process.env.PathGetChargerEVIOPrivate;
                params = {
                    hwId: hwId
                };
                break;
        };

        axios.get(proxy, { params })
            .then((result) => {
                var iva = result.data.fees.IVA;
                resolve(iva);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

function getTariff(tariffId) {
    var context = "Function getTariff";
    return new Promise(async (resolve, reject) => {
        try {

            if (tariffId === '-1') {
                resolve('-1');
            }
            else {

                var proxyTariff = process.env.HostTariff + process.env.PathGetTariff;

                var params = {
                    _id: tariffId
                };

                axios.get(proxyTariff, { params })
                    .then((result) => {

                        if (result.data.auth === undefined) {

                            resolve(result.data);

                        }
                        else {

                            resolve('-1');

                        };

                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        reject(error);
                    });

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getMyActiveSessions(userId) {
    var context = "Function getMyActiveSessions";
    return new Promise(async (resolve, reject) => {
        try {
            var host = process.env.HostCharger + process.env.PathChargingSessionsMyActiveSessionsPaymentMethod;

            var headers = {
                userid: userId
            };

            let myActiveSessionsEVIONetwork = await axios.get(host, { headers });
            //let myActiveSessionsPublicNetwork = await getMyActiveSessionsPublicNetwork(headers);
            let myActiveSessions = myActiveSessionsEVIONetwork.data;

            resolve(myActiveSessions);

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getCharger(hwId, chargerType) {
    var context = "Function getCharger";
    return new Promise(async (resolve, reject) => {
        try {

            let proxy;
            let params;

            if (chargerType === process.env.MobieCharger || chargerType === process.env.OCMCharger || chargerType === process.env.TeslaCharger || chargerType === process.env.GireveCharger || chargerType === process.env.HubjectCharger) {
                proxy = process.env.HostPublicNetwork + process.env.PathGetChargerPublicNetwork;

                params = {
                    hwId: hwId,
                    chargerType: chargerType
                };
            }
            else {

                // proxy = process.env.HostCharger + process.env.PathGetChargerEVIOPrivate;
                proxy = process.env.HostCharger + process.env.PathGetChargerEVIOPrivateDetails;

                params = {
                    hwId: hwId,
                    active: true,
                    hasInfrastructure: true
                };
            };

            axios.get(proxy, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });


        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};


function priceSimulator(time, tariff, plugFound, evFound, chargerType, fees, chargerFound) {
    var context = "Function priceSimulator";
    return new Promise(async (resolve, reject) => {
        try {

            //console.log("time", time);
            //console.log("tariff", tariff);
            //console.log("plugFound", plugFound);
            //console.log("evFound", evFound);
            //console.log("chargerType", chargerType);
            //time = 2;
            var chargerPower = plugFound.power;
            //todo all chargers
            let activationOPC;
            let minOPC;
            let energyOPC;
            let costEVIOCEME;
            let maxBatteryCapacity;
            let internalChargerPower;

            let timeCostEVIO;
            let energyCostEVIO;
            let feesIEC;

            //Roaming Variables
            let roamingCEME;
            let roamingOPC

            let sessionStartDate = moment.utc(new Date().toISOString()).format()
            let sessionStopDate = moment.utc(sessionStartDate).add(time, 'minutes').format()

            if (evFound != '-1') {

                if (evFound.evInfo == undefined) {
                    //With anonymous EV
                    maxBatteryCapacity = 62.00; //ID3 Pro Type  2 CSS  >=2021
                    internalChargerPower = 124.00; //ID3 Pro Type  2 CSS  >=2021
                }
                else {
                    maxBatteryCapacity = evFound.evInfo.maxBatteryCapacity;
                    internalChargerPower = (evFound.evInfo.maxFastChargingPower != null && evFound.evInfo.maxFastChargingPower != undefined && evFound.evInfo.maxFastChargingPower != 0) ? evFound.evInfo.maxFastChargingPower : evFound.evInfo.internalChargerPower;
                };
            }
            else {

                //With anonymous EV
                maxBatteryCapacity = 62.00; //ID3 Pro Type  2 CSS  >=2021
                internalChargerPower = 124.00; //ID3 Pro Type  2 CSS  >=2021

            };


            let value1 = (chargerPower >= internalChargerPower) ? internalChargerPower : Math.min(maxBatteryCapacity, chargerPower);
            let value2 = Math.min(time, (chargerPower >= internalChargerPower ? (maxBatteryCapacity / internalChargerPower) : (maxBatteryCapacity / maxBatteryCapacity)) * 60) / 60;

            let consumption = value1 * value2;

            if (chargerType === process.env.MobieCharger || chargerType === process.env.OCMCharger || chargerType === process.env.TeslaCharger) {

                let cemeEVIO = await getCEMEEVIO();
                let planCEME = cemeEVIO.plan;
                let tarCEME = cemeEVIO.tar;

                var currentTime = timeZoneMoment().tz('Europe/Lisbon').format("HH:mm")

                if (planCEME.tariffType === process.env.TariffTypeBiHour) {

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

                    var valueCeme = planCEME.tariff.find(tariff => {
                        return tariff.tariffType == tariffType;
                    });

                    var ValueTar = tarCEME.tariff.find(tar => {
                        return (tar.tariffType === tariffType && tar.voltageLevel === process.env.TariffVoltageLevel);
                    });

                    costEVIOCEME = valueCeme.price + ValueTar.price;

                }
                else {

                    var valueCeme = planCEME.tariff.find(tariff => {
                        return tariff.tariffType == process.env.TariffRush;
                    });
                    var ValueTar = tarCEME.tariff.find(tar => {
                        return (tar.tariffType === process.env.TariffRush && tar.voltageLevel === process.env.TariffVoltageLevel);
                    });

                    costEVIOCEME = valueCeme.price + ValueTar.price;

                };

                activationOPC = (plugFound.serviceCost.initialCost >= 0 ? plugFound.serviceCost.initialCost : 0);
                minOPC = (plugFound.serviceCost.costByTime[0].cost >= 0 ? plugFound.serviceCost.costByTime[0].cost : 0);
                energyOPC = (plugFound.serviceCost.costByPower.cost >= 0 ? plugFound.serviceCost.costByPower.cost : 0);
                timeCostEVIO = 0;
                energyCostEVIO = 0;
                feesIEC = consumption * fees.IEC;
                roamingCEME = 0
                roamingOPC = 0

            } else if (chargerType === process.env.GireveCharger || chargerType === process.env.HubjectCharger) {

                // =============================== CEME =============================== //
                /*
                    //TODO: For now I'm using country code as region. This should probably be improved in the future.
                */
                // let params = {
                //     country: chargerFound.countryCode,
                //     region: chargerFound.countryCode,
                //     partyId: chargerFound.partyId,
                //     roamingType: chargerFound.source,
                //     evseGroup: chargerFound.evseGroup
                // }

                // let roamingTariff = await getRoamingPlanTariff(params)

                // let CEME_FLAT = roamingTariff.tariff.find(tariff => tariff.type === "flat")
                // let CEME_POWER = roamingTariff.tariff.find(tariff => tariff.type === "energy")
                // let CEME_TIME = roamingTariff.tariff.find(tariff => tariff.type === "time")

                // let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
                // let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
                // let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0

                // let totalTimeConsumed = time
                // if (CEME_TIME && CEME_TIME.uom.includes('h')) {
                //     totalTimeConsumed = time / 60
                // } else if (CEME_TIME && CEME_TIME.uom.includes('s')) {
                //     totalTimeConsumed = time * 60
                // }

                // roamingCEME = CEME_Price_FLAT + CEME_Price_POWER * consumption + CEME_Price_TIME * totalTimeConsumed;
                roamingCEME = 0

                // =============================== CPO =============================== //

                // Timezone info to get offset of charger
                let timeZone = chargerFound.timeZone
                let countryCode = chargerFound.countryCode
                let offset = getChargerOffset(timeZone, countryCode)

                let data = {
                    // elements: plugFound.serviceCost.elements,
                    sessionStartDate,
                    sessionStopDate,
                    offset,
                    power: chargerPower,
                    total_energy: consumption,
                    total_charging_time: time / 60,
                    total_parking_time: 0,
                    countryCode,
                    partyId: chargerFound.partyId,
                    source: chargerFound.source,
                    evseGroup: plugFound.evseGroup,
                }
                console.log(JSON.stringify(data))

                let opcTariffs = await getOpcTariffsPrices(data)

                roamingOPC = opcTariffs.flat.price + opcTariffs.energy.price + opcTariffs.time.price + opcTariffs.parking.price
                // roamingOPC = 0


                activationOPC = 0
                minOPC = 0
                energyOPC = 0
                costEVIOCEME = 0;
                timeCostEVIO = 0;
                energyCostEVIO = 0;
                feesIEC = 0

            } else {

                activationOPC = 0;
                minOPC = 0;
                energyOPC = 0;
                costEVIOCEME = 0;
                feesIEC = 0;
                roamingCEME = 0
                roamingOPC = 0

                if (chargerFound.accessType === process.env.ChargerAccessFreeCharge) {

                    timeCostEVIO = 0;
                    energyCostEVIO = 0;

                } else if (Object.keys(tariff).length != 0) {

                    if (tariff.tariffType === process.env.TariffTypeEnergyBase) {
                        timeCostEVIO = 0;
                        if (tariff?.tariff?.chargingAmount?.uom?.toUpperCase() === 'KWH') {
                            //Value on €/kwh
                            energyCostEVIO = tariff?.tariff?.chargingAmount?.value ?? 0;
                        }
                        else {
                            //Convert from €/Wh to €/kwh
                            energyCostEVIO = (tariff?.tariff?.chargingAmount?.value ?? 0) * 1000;
                        };
                    }
                    else {
                        energyCostEVIO = 0;
                        if (tariff?.tariff?.chargingAmount?.uom === 's') {
                            //Convert from €/s to €/min
                            timeCostEVIO = (tariff?.tariff?.chargingAmount?.value ?? 0) * 60;

                        }
                        else if (tariff?.tariff?.chargingAmount?.uom === 'h') {
                            //Convert from €/h to €/min
                            timeCostEVIO = (tariff?.tariff?.chargingAmount?.value ?? 0) / 60;
                        }
                        else {
                            //Value on €/min
                            timeCostEVIO = tariff?.tariff?.chargingAmount?.value ?? 0;
                        };

                    };

                } else {

                    timeCostEVIO = 0;
                    energyCostEVIO = 0;

                };

            };

            //TODO ADD IVA AND EVIO FEE
            var total = Math.abs(activationOPC + (time * minOPC) + (consumption * energyOPC) + (consumption * costEVIOCEME) + (time * timeCostEVIO) + (consumption * energyCostEVIO) + roamingCEME + roamingOPC);
            //Add IEC
            //console.log("feesIEC", feesIEC);
            total += feesIEC;
            //Add IVA
            total += (total * fees.IVA);

            if (total < 2.50) {
                total = 2.50;
            }

            resolve(Math.abs(parseFloat(total.toFixed(2))));

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getCEMEEVIO() {
    var context = "Function getCEMEEVIO";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.HostPublicTariffs + process.env.PathGetTariffs;
            var params = {
                CEME: process.env.clientNameEVIO
            };

            axios.get(proxy, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}] [${proxy}] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function makePaymentCard(payment) {
    var context = "Function makePaymentCard Payments";
    return new Promise(async (resolve, reject) => {
        try {
            //console.log(`Function makePaymentCard Payments`);
            const defaultCard = await paymentMethodsFind({ userId: payment.userId, defaultPaymentMethod: true });

            if (payment?.paymentMethodId != defaultCard?.paymentMethodId?.toString()) {
                await paymentUpdate({ _id: payment._id }, { $set: { paymentMethodId: defaultCard?.paymentMethodId.toString() } });
                payment.paymentMethodId = defaultCard?.paymentMethodId.toString();
            }

            //let clientName = payment.clientName;
            if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                //Created a new transaction
                var newTransaction = new Transactions(
                    {
                        userId: payment.userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderCreditCard,
                        amount: { currency: payment.amount.currency, value: payment.amount.value / 100 },
                        sessionId: payment.sessionId,
                        paymentId: payment._id,
                        clientName: payment.clientName

                    }
                );

                let transactionCreated = await createNewTransactions(newTransaction);
                payment.transactionId = transactionCreated._id.toString();
                await paymentUpdate({ _id: payment._id }, { $set: { transactionId: transactionCreated._id.toString() } });

            };

            let amoutToCard;

            if (payment.amountToCard && payment.amountToCard.value > 0) {
                amoutToCard = payment.amountToCard;
            } else {
                amoutToCard = payment.amount;
            };
            const preAuthorization = await PreAuthorization.retrieveReservationAmountBySessionId(payment.sessionId);
            if (amoutToCard.value == 0 && !preAuthorization && !preAuthorization?.adyenReference) {  // for old flow keep working in cases of value 0 of charging sessions.

                let transaction = await transactionFindOne({ _id: payment.transactionId });
                if (transaction.adyenReference == "-1" || transaction.adyenReference == "" || transaction.adyenReference == undefined) {

                    let queryPayment = {
                        _id: payment._id
                    };

                    let newValues = {
                        $set: {
                            status: process.env.PaymentStatusPaidOut,
                            reason: process.env.ReasonSuccessBalance,
                            data: {}
                        }
                    };

                    paymentUpdate(queryPayment, newValues)
                        .then(() => {
                            var query = {
                                _id: payment.transactionId
                            };
                            var newValues = {
                                $set: {
                                    status: process.env.TransactionStatusPaidOut,
                                    data: {}
                                }
                            };
                            transactionsUpdate(query, newValues)
                                .then(async () => {
                                    let response = await paymentFindOne(queryPayment);
                                    resolve(response);
                                })
                                .catch((error) => {
                                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                    reject(error);
                                });
                        })
                        .catch((error) => {
                            console.error(`[${context}][paymentUpdate] Error `, error.message);
                            reject(error);
                        });

                } else {

                    if (payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai) {
                        let data = {

                            merchantAccount: adyenMerchantAccountSC,
                            originalReference: transaction.adyenReference,
                            reference: transaction._id
                        };
                        //TODO
                        modificationSC.cancel(data)
                            //modification.cancel(data)
                            .then((result) => {

                                let queryPayment = {
                                    _id: payment._id
                                };

                                let newValues = {
                                    $set: {
                                        status: process.env.PaymentStatusPaidOut,
                                        reason: process.env.ReasonSuccessBalance,
                                        data: result.data
                                    }
                                };

                                paymentUpdate(queryPayment, newValues)
                                    .then(() => {
                                        var query = {
                                            _id: payment.transactionId
                                        };
                                        var newValues = {
                                            $set: {
                                                status: process.env.TransactionStatusPaidOut,
                                                data: result.data
                                            }
                                        };
                                        transactionsUpdate(query, newValues)
                                            .then(async () => {
                                                let response = await paymentFindOne(queryPayment);
                                                resolve(response);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                                reject(error);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                                        reject(error);
                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            });
                    } else {

                        let data = {

                            merchantAccount: adyenMerchantAccount,
                            originalReference: transaction.adyenReference,
                            reference: transaction._id
                        };
                        modification.cancel(data)
                            .then((result) => {

                                let queryPayment = {
                                    _id: payment._id
                                };

                                let newValues = {
                                    $set: {
                                        status: process.env.PaymentStatusPaidOut,
                                        reason: process.env.ReasonSuccessBalance,
                                        data: result.data
                                    }
                                };

                                paymentUpdate(queryPayment, newValues)
                                    .then(() => {
                                        var query = {
                                            _id: payment.transactionId
                                        };
                                        var newValues = {
                                            $set: {
                                                status: process.env.TransactionStatusPaidOut,
                                                data: result.data
                                            }
                                        };
                                        transactionsUpdate(query, newValues)
                                            .then(async () => {
                                                let response = await paymentFindOne(queryPayment);
                                                resolve(response);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                                reject(error);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                                        reject(error);
                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            });


                    };
                };

            } else {

                //var host = 'http://localhost:3017' + '/api/private/paymentsAdyen/finalAuthorisePayment';

                var userId = payment.userId;

                var received = {

                    paymentId: payment._id,
                    sessionId: payment.sessionId,
                    amount: amoutToCard,
                    paymentMethod: {
                        type: "scheme",
                        storedPaymentMethodId: payment.paymentMethodId,
                        encryptedCardNumber: "",
                        encryptedExpiryYear: "",
                        encryptedSecurityCode: "",
                        holderName: "",
                        encryptedExpiryMonth: ""
                    },
                    transactionId: payment.transactionId,
                    adyenReference: payment.adyenReference,
                    reservedAmount: payment.reservedAmount

                };


                console.log(`2 - [makePaymentCard] WILL MAKE A PAYMENT CARD userId: ${payment.userId}`);
                console.log(`[makePaymentCard] NOT RESERVATION: ${!preAuthorization}`)

                payment.adyenReference = preAuthorization ? preAuthorization.adyenReference : payment.paymentAdyenId;
                if (preAuthorization && preAuthorization.adyenReference) {
                    console.log("2 - new flow client with preauthorization");
                    received.amount.value = Math.abs(received.amount.value);

                    const data = {
                        merchantAccount: ((payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai) ? adyenMerchantAccountSC : adyenMerchantAccount),
                        reservation: preAuthorization,
                        userId: preAuthorization.userId,
                        amount: received.amount.value,
                        transactionId: payment.transactionId,
                        paymentId: received.paymentId
                    };

                    const proxy = process.env.HostPaymentsV2 + process.env.PathPostPreAuthorization + 'session/' + payment.sessionId
                    axios.post(proxy, data)
                        .then(async (result) => {

                            const amountToUp = result?.data?.info?.status !== '70' ? { currency: payment.amount.currency, value: result?.data?.info?.topUpAmount } : null;
                            const amountRefund = result?.data?.info?.status === '70' ? { currency: payment.amount.currency, value: result?.data?.info?.amount } : null;

                            console.log(`${context} do a topup with this amount: ${amountToUp}`)
                            console.log(`${context} do a refund with this amount: ${amountRefund}`)

                            let queryPayment = {
                                _id: received.paymentId
                            };

                            let valuesPaymet = {
                                $set: {
                                    status: result?.data?.info?.status === '70' ? process.env.PaymentStatusRefund : process.env.PaymentStatusPaidOut,
                                    paymentMethod: process.env.PaymentMethodCard,
                                    paymentAdyenId: data.reservation.adyenReference,
                                    reason: result?.data?.info?.status === '70' ? process.env.ReasonRefund : process.env.ReasonSuccess,
                                    amountToUp: amountToUp?.value ?? 0,
                                    amountRefund: amountRefund?.value ?? 0,
                                    amount: amountToUp || amountRefund || received.amount
                                }
                            };

                            let queryTransaction = {
                                _id: received.transactionId
                            };


                            let valuesTransation = {
                                $set: {
                                    transactionType: result?.data?.info?.status === '70' ? process.env.TransactionTypeRefund : process.env.TransactionTypeDebit,
                                    status: result?.data?.info?.status === '70' ? process.env.TransactionStatusRefund : process.env.TransactionStatusPaidOut,
                                    dataRecieved: result.data.info?.dataRecieved,
                                    amount: amountToUp || amountRefund || received.amount,
                                    amountToUp: amountToUp?.value ?? 0,
                                    amountRefund: amountRefund?.value ?? 0,
                                    reason: result?.data?.info?.status === '70' ? process.env.ReasonRefund : process.env.ReasonSuccess
                                }
                            };

                            const [response, transactionsUpdated] = await Promise.all([
                                await paymentUpdate(queryPayment, valuesPaymet),
                                await transactionsUpdate(queryTransaction, valuesTransation)
                            ]);
                            resolve(response);
                        })
                        .catch((error) => {
                            console.error(`[${context}][modification.capture] Error `, error);
                            console.error(`[${context}][modification.capture] Error `, error.message);
                            reject(error);
                        });

                    console.log('############################ fim ')
                } else {
                    console.log("2 - old flow client without preauthorization");

                    if (received.adyenReference == "-1" || received.adyenReference == "" || received.adyenReference == undefined) {


                        let body = {
                            merchantAccount: adyenMerchantAccount,
                            reference: received.transactionId,
                            amount: received.amount,
                            paymentMethod: received.paymentMethod,
                            shopperReference: userId,
                            shopperInteraction: process.env.ShopperInteractionContAuth,
                            recurringProcessingModel: await getRecurringProcessingModel(userId, payment.paymentMethodId)/*,
                            additionalData: {
                                authorisationType: process.env.AdyenAuthorisationTypePreAuth
                            }*/
                        };
                        await forceResponseCode(userId, body)
                        body.amount.value *= 100;
                        body.amount.value = Math.abs(body.amount.value);


                        if (payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai) {

                            body.merchantAccount = adyenMerchantAccountSC;

                            console.log("2 body SC - ", body);
                            checkoutSC.payments(body)
                                //checkout.payments(body)
                                .then(async (result) => {
                                    needsThreeDSAuthentication(payment.paymentMethodId, result.refusalReasonCode)

                                    console.log("result checkoutSC - ", result);

                                    var status;

                                    switch (result.resultCode) {
                                        case 'Error':
                                            status = process.env.TransactionStatusFaild;
                                            break;
                                        case 'Refused':
                                            status = process.env.TransactionStatusFaild;
                                            break;
                                        default:

                                            result.amount.value = Math.abs(result.amount.value);

                                            var data = {
                                                merchantAccount: adyenMerchantAccountSC,
                                                originalReference: result.pspReference,
                                                modificationAmount: result.amount,
                                                reference: result.merchantReference
                                            };

                                            //TODO
                                            modificationSC.capture(data);
                                            //modification.capture(data);
                                            status = process.env.TransactionStatusInPayment;
                                            result.amount.value /= 100;

                                            break;
                                    };

                                    let queryPayment = {
                                        _id: received.paymentId
                                    };

                                    let valuesPaymet = {
                                        $set: {
                                            status: process.env.PaymentStatusInPayment,
                                            paymentMethod: process.env.PaymentMethodCard,
                                            paymentAdyenId: result.pspReference
                                        }
                                    };

                                    let queryTransaction = {
                                        _id: received.transactionId
                                    };

                                    let valuesTransation = {
                                        $set: {
                                            provider: process.env.TransactionProviderCreditCard,
                                            transactionType: process.env.TransactionTypeDebit,
                                            status: process.env.TransactionStatusInPayment,
                                            data: result,
                                            amount: {
                                                currency: received.amount.currency,
                                                value: received.amount.value / 100
                                            }
                                        }
                                    };

                                    let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                    let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);


                                    let response = await paymentFindOne(queryPayment);
                                    resolve(response);

                                })
                                .catch((error) => {

                                    console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                                    reject(error);

                                });
                        } else {
                            checkout.payments(body)
                                .then(async (result) => {
                                    needsThreeDSAuthentication(payment.paymentMethodId, result.refusalReasonCode)

                                    //console.log("result", result);

                                    var status;

                                    switch (result.resultCode) {
                                        case 'Error':
                                            status = process.env.TransactionStatusFaild;
                                            break;
                                        case 'Refused':
                                            status = process.env.TransactionStatusFaild;
                                            break;
                                        default:

                                            result.amount.value = Math.abs(result.amount.value);

                                            var data = {
                                                merchantAccount: adyenMerchantAccount,
                                                originalReference: result.pspReference,
                                                modificationAmount: result.amount,
                                                reference: result.merchantReference
                                            };

                                            modification.capture(data);
                                            status = process.env.TransactionStatusInPayment;
                                            result.amount.value /= 100;

                                            break;
                                    };

                                    let queryPayment = {
                                        _id: received.paymentId
                                    };

                                    let valuesPaymet = {
                                        $set: {
                                            status: process.env.PaymentStatusInPayment,
                                            paymentMethod: process.env.PaymentMethodCard,
                                            paymentAdyenId: result.pspReference
                                        }
                                    };

                                    let queryTransaction = {
                                        _id: received.transactionId
                                    };

                                    let valuesTransation = {
                                        $set: {
                                            provider: process.env.TransactionProviderCreditCard,
                                            transactionType: process.env.TransactionTypeDebit,
                                            status: process.env.TransactionStatusInPayment,
                                            data: result,
                                            amount: {
                                                currency: received.amount.currency,
                                                value: received.amount.value / 100
                                            }
                                        }
                                    };

                                    let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                    let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);


                                    let response = await paymentFindOne(queryPayment);
                                    resolve(response);

                                })
                                .catch((error) => {

                                    console.error(`[${context}][checkout.payments] Error `, error.message);
                                    reject(error);

                                });
                        }
                    } else {

                        if ((received.amount.value) > (received.reservedAmount)) {


                            //Primeiro fazer ajuste ao valor reservado se valor de pagamento maior que valor reservado
                            let modificationAmount = Math.abs(parseFloat((received.amount.value - received.reservedAmount).toFixed(2)));
                            //console.log("modificationAmount", modificationAmount);
                            received.amount.value = Math.abs(received.amount.value);

                            let body = {

                                originalReference: received.adyenReference,
                                modificationAmount: {
                                    currency: "EUR",
                                    value: (received.amount.value * 100)
                                },
                                additionalData: {
                                    industryUsage: "DelayedCharge",
                                    encryptedCardNumber: "",
                                    encryptedExpiryYear: "",
                                    encryptedSecurityCode: "",
                                    holderName: "",
                                    encryptedExpiryMonth: ""
                                },
                                reference: received.transactionId,
                                merchantAccount: adyenMerchantAccount

                            };

                            //console.log("body", body);

                            adjustmentPreAuthorize(body, payment.clientName)
                                .then((result) => {
                                    if (result) {
                                        //Atualizar valor de reservedAmount no charging session, transaction e payment.
                                        /*paymentUpdate({ _id: received.paymentId }, { $set: { reservedAmount: received.amount.value } })
                                            .then(() => {*/

                                        received.amount.value = Math.abs(received.amount.value);

                                        var data = {
                                            merchantAccount: adyenMerchantAccount,
                                            modificationAmount: {
                                                currency: "EUR",
                                                value: received.amount.value * 100
                                            },
                                            originalReference: received.adyenReference,
                                            reference: received.transactionId
                                        };

                                        console.log('make a payment ------ data', data);

                                        if (payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai) {

                                            data.merchantAccount = adyenMerchantAccountSC;

                                            //TODO
                                            modificationSC.capture(data)
                                                //modification.capture(data)
                                                .then(async (result) => {

                                                    let queryPayment = {
                                                        _id: received.paymentId
                                                    };

                                                    let valuesPaymet = {
                                                        $set: {
                                                            status: process.env.PaymentStatusInPayment,
                                                            paymentMethod: process.env.PaymentMethodCard,
                                                            paymentAdyenId: result.pspReference
                                                        }
                                                    };
                                                    let queryTransaction = {
                                                        _id: received.transactionId
                                                    };

                                                    let valuesTransation = {
                                                        $set: {
                                                            transactionType: process.env.TransactionTypeDebit,
                                                            status: process.env.TransactionStatusInPayment,
                                                            data: result
                                                        }
                                                    };
                                                    //console.log("queryTransaction", queryTransaction)
                                                    //console.log("valuesTransation", valuesTransation)

                                                    let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                                    let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);
                                                    let response = await paymentFindOne(queryPayment);
                                                    resolve(response);


                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][adjustmentPreAuthorize][modificationSC.capture] Error `, error.message);
                                                    reject(error);
                                                });
                                        } else {
                                            console.log('make a payment 1 ------ data', data);
                                            modification.capture(data)
                                                .then(async (result) => {

                                                    let queryPayment = {
                                                        _id: received.paymentId
                                                    };

                                                    let valuesPaymet = {
                                                        $set: {
                                                            status: process.env.PaymentStatusInPayment,
                                                            paymentMethod: process.env.PaymentMethodCard,
                                                            paymentAdyenId: result.pspReference
                                                        }
                                                    };
                                                    let queryTransaction = {
                                                        _id: received.transactionId
                                                    };

                                                    let valuesTransation = {
                                                        $set: {
                                                            transactionType: process.env.TransactionTypeDebit,
                                                            status: process.env.TransactionStatusInPayment,
                                                            data: result
                                                        }
                                                    };
                                                    //console.log("queryTransaction", queryTransaction)
                                                    //console.log("valuesTransation", valuesTransation)

                                                    let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                                    let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);
                                                    let response = await paymentFindOne(queryPayment);
                                                    resolve(response);


                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][adjustmentPreAuthorize][modification.capture] Error `, error.message);
                                                    reject(error);
                                                });
                                        };
                                        /*})
                                        .catch((error) => {

                                            console.error(`[${context}][updatereservedAmount] Error `, error.message);
                                            reject(error);

                                        });
                                        */


                                    }
                                    else {
                                        let message = { auth: false, code: "server_can't_adjust", message: "Can't adjust value" }
                                        reject(error);
                                    };
                                })
                                .catch((error) => {

                                    console.error(`[${context}][adjustmentPreAuthorize] Error `, error.message);
                                    reject(error);

                                });

                        }
                        else {

                            received.amount.value = Math.abs(received.amount.value);
                            var data = {

                                merchantAccount: adyenMerchantAccount,
                                originalReference: received.adyenReference,
                                modificationAmount: received.amount,
                                reference: received.transactionId

                            };

                            //data.modificationAmount.value = parseFloat(data.modificationAmount.value.toFixed(2)) * 100;

                            data.modificationAmount.value *= 100;
                            console.log('make a payment 2 ------ data', data);

                            if (payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai) {

                                data.merchantAccount = adyenMerchantAccountSC;

                                //TODO
                                modificationSC.capture(data)
                                    //modification.capture(data)
                                    .then(async (result) => {

                                        let queryPayment = {
                                            _id: received.paymentId
                                        };

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference
                                            }
                                        };

                                        let queryTransaction = {
                                            _id: received.transactionId
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: result,
                                                amount: {
                                                    currency: received.amount.currency,
                                                    value: received.amount.value / 100
                                                }
                                            }
                                        };
                                        //console.log("queryTransaction 1", queryTransaction)
                                        //console.log("valuesTransation 1", valuesTransation)
                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);


                                        let response = await paymentFindOne(queryPayment);
                                        resolve(response);

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][modificationSC.capture] Error `, error.message);
                                        reject(error);

                                    });
                            } else {


                                console.log('make a payment 3 ------ data', data);

                                modification.capture(data)
                                    .then(async (result) => {
                                        console.log("result", result)

                                        let queryPayment = {
                                            _id: received.paymentId
                                        };

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference
                                            }
                                        };

                                        let queryTransaction = {
                                            _id: received.transactionId
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: result,
                                                amount: {
                                                    currency: received.amount.currency,
                                                    value: received.amount.value / 100
                                                }
                                            }
                                        };
                                        //console.log("queryTransaction 1", queryTransaction)
                                        //console.log("valuesTransation 1", valuesTransation)
                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);


                                        let response = await paymentFindOne(queryPayment);
                                        resolve(response);

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][modification.capture] Error `, error.message);
                                        reject(error);

                                    });

                            };
                        };

                    };
                }
            };

        } catch (error) {
            console.error(`[${context}][catch] Error `, error.message);
            reject(error);
        };
    });
};

function makePaymentCardMonthly(payment) {
    var context = "Function makePaymentCardMonthly";
    return new Promise(async (resolve, reject) => {
        try {

            let transactionId;
            if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                //Created a new transaction
                var newTransaction = new Transactions(
                    {
                        userId: payment.userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderCreditCard,
                        amount: payment.amount,
                        listOfSessions: payment.listOfSessions,
                        paymentId: payment._id,
                        clientName: payment.clientName
                    }
                );

                let transactionCreated = await createNewTransactions(newTransaction);
                transactionId = transactionCreated._id.toString();

            }
            else {
                transactionId = payment.transactionId;
            };

            if (payment.amount.value === 0) {

                var queryPayment = {
                    _id: payment._id
                };

                var newValues = {
                    $set: {
                        transactionId: transactionId,
                        status: process.env.PaymentStatusPaidOut,
                        reason: process.env.ReasonSuccessBalance
                    }
                };

                paymentUpdate(queryPayment, newValues)
                    .then(() => {

                        var query = {
                            _id: transactionId
                        };

                        var newValues = {
                            $set: {
                                status: process.env.TransactionStatusPaidOut
                            }
                        };

                        transactionsUpdate(query, newValues)
                            .then(async () => {

                                let response = await paymentFindOne(queryPayment);
                                resolve(response);

                            })
                            .catch((error) => {

                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                reject(error);

                            });
                    })
                    .catch((error) => {

                        console.error(`[${context}][paymentUpdate] Error `, error.message);
                        reject(error);

                    });

            }
            else {

                var queryPayment = {
                    _id: payment._id
                };

                paymentMethodsFind({ userId: payment.userId })
                    .then(async (paymentMethodsFound) => {

                        //let clientName = paymentMethodsFound.clientName;
                        if (paymentMethodsFound) {

                            let body = {
                                merchantAccount: adyenMerchantAccount,
                                reference: transactionId,
                                amount: payment.amount,
                                paymentMethod: {
                                    type: "scheme",
                                    storedPaymentMethodId: paymentMethodsFound.paymentMethodId,
                                    encryptedCardNumber: "",
                                    encryptedExpiryYear: "",
                                    encryptedSecurityCode: "",
                                    holderName: "",
                                    encryptedExpiryMonth: ""
                                },
                                shopperReference: payment.userId,
                                shopperInteraction: process.env.ShopperInteractionContAuth,
                                recurringProcessingModel: await getRecurringProcessingModel(payment.userId, paymentMethodsFound.paymentMethodId)/*,
                                additionalData: {
                                    authorisationType: process.env.AdyenAuthorisationTypePreAuth
                                }*/
                            };
                            await forceResponseCode(payment.userId, body)

                            body.amount.value *= 100;
                            body.amount.value = Math.abs(body.amount.value);
                            //console.log("body", body);

                            if (paymentMethodsFound.clientName === process.env.clientNameSC || paymentMethodsFound.clientName === process.env.clientNameHyundai) {
                                body.merchantAccount = adyenMerchantAccountSC;
                                //TODO
                                console.log("3 body SC - ", body);
                                checkoutSC.payments(body)
                                    //checkout.payments(body)
                                    .then(async (result) => {
                                        needsThreeDSAuthentication(paymentMethodsFound.paymentMethodId, result.refusalReasonCode)

                                        var status;

                                        switch (result.resultCode) {
                                            case 'Error':
                                                status = process.env.TransactionStatusFaild;
                                                break;

                                            case 'Refused':
                                                status = process.env.TransactionStatusFaild;
                                                break;

                                            default:
                                                result.amount.value = Math.abs(result.amount.value);
                                                var data = {
                                                    merchantAccount: adyenMerchantAccountSC,
                                                    originalReference: result.pspReference,
                                                    modificationAmount: result.amount,

                                                    reference: result.merchantReference
                                                };

                                                //TODO
                                                modificationSC.capture(data);
                                                //modification.capture(data);
                                                status = process.env.TransactionStatusInPayment;
                                                result.amount.value /= 100;

                                                break;
                                        };

                                        let queryPayment = {
                                            _id: payment._id
                                        };

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference,
                                                transactionId: transactionId
                                            }
                                        };

                                        let queryTransaction = {
                                            _id: transactionId
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: result,
                                                amount: {
                                                    currency: payment.amount.currency,
                                                    value: payment.amount.value / 100
                                                }
                                            }
                                        };

                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);
                                        let response = await paymentFindOne(queryPayment);
                                        resolve(response);

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                                        reject(error);

                                    });
                            } else {
                                checkout.payments(body)
                                    .then(async (result) => {
                                        needsThreeDSAuthentication(paymentMethodsFound.paymentMethodId, result.refusalReasonCode)

                                        var status;

                                        switch (result.resultCode) {
                                            case 'Error':
                                                status = process.env.TransactionStatusFaild;
                                                break;

                                            case 'Refused':
                                                status = process.env.TransactionStatusFaild;
                                                break;

                                            default:
                                                result.amount.value = Math.abs(result.amount.value);
                                                var data = {
                                                    merchantAccount: adyenMerchantAccount,
                                                    originalReference: result.pspReference,
                                                    modificationAmount: result.amount,

                                                    reference: result.merchantReference
                                                };

                                                modification.capture(data);
                                                status = process.env.TransactionStatusInPayment;
                                                result.amount.value /= 100;

                                                break;
                                        };

                                        let queryPayment = {
                                            _id: payment._id
                                        };

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference,
                                                transactionId: transactionId
                                            }
                                        };

                                        let queryTransaction = {
                                            _id: transactionId
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: result,
                                                amount: {
                                                    currency: payment.amount.currency,
                                                    value: payment.amount.value / 100
                                                }
                                            }
                                        };

                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);
                                        let response = await paymentFindOne(queryPayment);
                                        resolve(response);

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkout.payments] Error `, error.message);
                                        reject(error);

                                    });
                            };
                        } else {


                            var newValues = {
                                $set: {
                                    paymentMethod: process.env.PaymentMethodWallet,
                                    transactionId: transactionId
                                }
                            };
                            payment.paymentMethod = process.env.PaymentMethodWallet;
                            payment.transactionId = transactionId;


                            let paymentUpdated = await paymentUpdate(queryPayment, newValues);

                            makePaymentWalletMonthly(payment)
                                .then((result) => {

                                    if (result.status === process.env.PaymentStatusPaidOut) {

                                        /*
                                        if (result.chargerType === process.env.MobieCharger) {
                                            updateMultiSessionMobiE(result)
                                        }
                                        else {
                                            updateMultiSessionEVIO(result);
                                        };
                                        */

                                    };

                                    resolve(result);

                                })
                                .catch((error) => {

                                    console.error(`[${context}][makePaymentWalletMonthly] Error `, error.message);
                                    reject(error);

                                });



                        };

                    })
                    .catch((error) => {

                        console.error(`[${context}][paymentMethodsFind] Error `, error.message);
                        reject(error);

                    });

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

var taskPayments = null;
var taskSessions = null;

if (process.env.NODE_ENV === 'production') {

    initJobCheckPayments('*/30 * * * *')
        .then(() => {
            taskPayments.start();
            console.log("Check payments Job Started")
        })
        .catch(error => {
            Sentry.captureException(error);
            console.log("Error starting check payments Job: " + error.message)
        });

    initJobCheckSessions('*/10 * * * *')
        .then(() => {
            taskSessions.start();
            console.log("Check sessions Job Started")
        })
        .catch(error => {
            Sentry.captureException(error);
            console.log("Error starting check sessions Job: " + error.message)
        });

}

function initJobCheckPayments(timer) {
    return new Promise((resolve, reject) => {
        taskPayments = cron.schedule(timer, () => {
            console.log('Running Job check payments: ' + new Date().toISOString());
            checkPayments();
        }, {
            scheduled: false
        });
        resolve();
    });
};

function initJobCheckSessions(timer) {
    return new Promise((resolve, reject) => {
        taskSessions = cron.schedule(timer, () => {
            console.log('Running Job check sessions: ' + new Date().toISOString());
            checkSessions();
        }, {
            scheduled: false
        });
        resolve();
    });
};


//checkPayments()
function checkPayments(req, res) {
    const context = "Function checkPayments";
    try {

        let query = [
            {
                $match: {
                    $or: [
                        //{ status: process.env.PaymentStatusCanceled },
                        { status: process.env.PaymentStatusRefused },
                        { status: process.env.PaymentStatusFaild },
                        { status: process.env.PaymentStatusStartPayment },
                        {
                            status: process.env.PaymentStatusCanceled,
                            paymentMethod: process.env.PaymentMethodPlafond,
                            $and: [
                                { paymentMethodId: { $exists: true } },
                                { paymentMethodId: { $ne: "" } }
                            ]
                        }
                    ],
                    transactionType: { $ne: process.env.TransactionType2ndWayPhysicalCard }
                }
            },
            {
                "$group": {
                    "_id": {
                        "userId": "$userId"
                    }
                }
            },
            {
                "$project": {
                    "userId": "$_id.userId",
                    "_id": 0
                }
            }
        ];

        Payments.aggregate(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Aggregate Error `, err.message);
                Sentry.captureException(err);
                return null;
            };

            console.log("checkPayments result", result?.length);
            if (result?.length > 0) {
                result.map(async user => {
                    if (user.userId) {
                        if (user.userId === "Unknown") {
                            console.log("userId", user.userId);
                            Payments.updateMany({ userId: "Unknown" }, { $set: { status: "30" } }, (err, result) => {
                                if (err) { console.error(`[${context}] Error `, err.message); };
                                console.log("Payments Updated")
                            });

                        } else {
                            console.log("userId", user.userId);

                            let newQuery = {
                                userId: user.userId,
                                $or: [
                                    { status: process.env.PaymentStatusRefused },
                                    { status: process.env.PaymentStatusFaild },
                                    { status: process.env.PaymentStatusStartPayment }
                                ],
                                transactionType: { $ne: process.env.TransactionType2ndWayPhysicalCard }

                            };

                            let userWallet;
                            let allPaymentMethodsFound;
                            let listPaymentMethod;

                            try {

                                userWallet = await Wallet.findOne({ userId: user.userId }, { amount: 1, userId: 1 });
                                allPaymentMethodsFound = await PaymentMethod.find({ userId: user.userId, status: { $ne: process.env.PaymentMethodStatusExpired } });
                                listPaymentMethod = await ListPaymentMethod.findOne({ userId: user.userId })

                            } catch (error) {
                                console.error(`[${context}][Wallet.findOne] Error `, error.message);
                                userWallet = {
                                    amount: {
                                        value: 0,
                                        currency: "EUR"
                                    },
                                    userId: user.userId
                                };

                                allPaymentMethodsFound = [];

                            };

                            if (!userWallet) {
                                userWallet = {
                                    amount: {
                                        value: 0,
                                        currency: "EUR"
                                    },
                                    userId: user.userId
                                };
                            };

                            Payments.find(newQuery, (err, paymentsFound) => {
                                if (err)
                                    console.error(`[${context}] Error `, err.message);

                                if (paymentsFound.length > 0) {
                                    if (listPaymentMethod) {
                                        paymentsFound.map(async payment => {
                                            let params = {
                                                userId: payment.userId,
                                                sessionId: payment.sessionId,
                                                transactionId: payment.transactionId,
                                                paymentId: payment._id,
                                                active: true,
                                                userBlocked: true
                                            };

                                            if (listPaymentMethod.paymentMethod.length === 1 && listPaymentMethod.paymentMethod[0].toUpperCase() === process.env.PaymentMethodTypeTransfer.toUpperCase() && payment.paymentMethod !== process.env.PaymentMethodPlafond) {
                                                console.log(`[${context}] 1 - process to cancel`);

                                                await Payments.findOneAndUpdate({ _id: payment._id }, { $set: { status: "30" } }, { new: true });
                                                await Transaction.findOneAndUpdate({ paymentId: payment._id }, { $set: { status: "30" } }, { new: true });
                                                console.log("Payments updated")

                                            } else {
                                                console.log(`[${context}] 2 - process to try again`);

                                                NotificationsPayments.findOne(params, async (err, notificationFound) => {
                                                    if (err) { console.error(`[${context}] Error `, err.message); };

                                                    if (notificationFound) {
                                                        console.log("User already blocked", notificationFound.userId);
                                                    } else {
                                                        if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                                                            //Created a new transaction
                                                            var newTransaction = new Transactions(
                                                                {
                                                                    userId: payment.userId,
                                                                    transactionType: process.env.TransactionTypeDebit,
                                                                    status: process.env.TransactionStatusSentToGenerate,
                                                                    provider: payment.paymentMethod,
                                                                    amount: payment.amount,
                                                                    sessionId: payment.sessionId,
                                                                    paymentId: payment._id,
                                                                    clientName: payment.clientName

                                                                }
                                                            );

                                                            let transactionCreated = await createNewTransactions(newTransaction);
                                                            payment.transactionId = transactionCreated._id.toString();
                                                            await Payments.findOneAndUpdate({ _id: payment._id }, { $set: payment }, { new: true });
                                                        };

                                                        payment.amount.value = Math.abs(payment.amount.value);
                                                        if (payment.paymentMethod === process.env.PaymentMethodPlafond) {
                                                            console.log("1")
                                                            makePayment(payment)
                                                                .then((result) => {
                                                                    if (
                                                                        result.chargerType === process.env.MobieCharger ||
                                                                        result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                        result.chargerType === Enums.ChargerTypes.Hubject
                                                                    ) {
                                                                        updateSessionMobiE(result, "checkPayments")
                                                                    }
                                                                    else {
                                                                        updateSessionEVIO(result, "checkPayments");
                                                                    };
                                                                    console.log(`[${context}][makePayment] Payment done!`);
                                                                })
                                                                .catch(async (error) => {
                                                                    await doNotification(context, payment);
                                                                    console.error(`[${context}][makePayment] Error `, error.message);
                                                                });
                                                        } else if (userWallet.amount.value - payment.amount.value >= 0) {

                                                            //Verify if have all the value in wallet
                                                            if (payment.paymentMethod !== process.env.PaymentMethodWallet) {

                                                                payment.paymentMethod = process.env.PaymentMethodWallet;
                                                                payment.status = process.env.PaymentStatusFaild;

                                                                await paymentUpdate({ _id: payment._id }, { $set: { paymentMethod: process.env.PaymentMethodWallet, paymentMethod: process.env.PaymentMethodWallet, status: process.env.PaymentStatusFaild } });
                                                                await transactionsUpdate({ _id: payment.transactionId }, { $set: { provider: process.env.PaymentMethodWallet } });
                                                            };

                                                            makePayment(payment)
                                                                .then((result) => {

                                                                    if (
                                                                        result.chargerType === process.env.MobieCharger ||
                                                                        result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                        result.chargerType === Enums.ChargerTypes.Hubject
                                                                    ) {
                                                                        updateSessionMobiE(result, "checkPayments")
                                                                    }
                                                                    else {
                                                                        updateSessionEVIO(result, "checkPayments");
                                                                    };
                                                                    console.log(`[${context}][makePayment] Payment done!`);
                                                                })
                                                                .catch(async (error) => {
                                                                    await doNotification(context, payment);
                                                                    console.error(`[${context}][makePayment] Error `, error.message);
                                                                });

                                                        } else if (allPaymentMethodsFound.length > 0) {

                                                            query = {
                                                                userId: payment.userId,
                                                                sessionId: payment.sessionId,
                                                                transactionId: payment.transactionId,
                                                                paymentId: payment._id,
                                                                paymentMethod: payment.paymentMethod,
                                                                active: true
                                                            };

                                                            NotificationsPayments.findOne(query, async (err, notificationFound) => {
                                                                if (err) {
                                                                    console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
                                                                };

                                                                if (notificationFound) {

                                                                    //Foi encontrado
                                                                    //Verificar se envia notificação ou SMS ou verificar se cancela contratos
                                                                    if (notificationFound.notificatcionSend === false && notificationFound.emailSend === false && notificationFound.numberAattempts === 1) {
                                                                        //Send notification and SMS
                                                                        let validateSession = await validateSessionFunc(notificationFound)
                                                                        if (!validateSession) {
                                                                            sendNotifications(notificationFound);
                                                                            //sendSMS(notificationFound);
                                                                            let debtValue = `${payment.amount.value} ${payment.amount.currency}`;
                                                                            console.log(`[${context}] DebtValue `, debtValue);
                                                                            sendEmail(notificationFound, debtValue);
                                                                        }
                                                                    }
                                                                    else if (!notificationFound.userBlocked) {
                                                                        //Deactivate all contracts
                                                                        //console.log("notificationFound", notificationFound);
                                                                        deactivateContracts(notificationFound, true);
                                                                    };

                                                                } else {

                                                                    let paymentMethodFound = allPaymentMethodsFound.find(elem => {
                                                                        return elem.paymentMethodId === payment.paymentMethodId;
                                                                    });

                                                                    if (paymentMethodFound) {

                                                                        makePaymentCard(payment)
                                                                            .then(async (result) => {

                                                                                let paymentFound = await Payments.findOne({ _id: payment._id });

                                                                                let notificationsPayments = new NotificationsPayments({
                                                                                    userId: paymentFound.userId,
                                                                                    sessionId: paymentFound.sessionId,
                                                                                    transactionId: paymentFound.transactionId,
                                                                                    paymentId: paymentFound._id,
                                                                                    paymentMethod: paymentFound.paymentMethod,
                                                                                    numberAattempts: 1,
                                                                                    active: true,
                                                                                    clientName: paymentFound.clientName
                                                                                });

                                                                                if (
                                                                                    result.chargerType === process.env.MobieCharger ||
                                                                                    result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                                    result.chargerType === Enums.ChargerTypes.Hubject
                                                                                ) {
                                                                                    updateSessionMobiE(result, "checkPayments")
                                                                                }
                                                                                else {
                                                                                    updateSessionEVIO(result, "checkPayments")
                                                                                };

                                                                                NotificationsPayments.createNotificationsPayments(notificationsPayments, (err, result) => {
                                                                                    if (err) {
                                                                                        console.error(`[${context}][createNotificationsPayments] Error `, err.message);
                                                                                    }
                                                                                    else {
                                                                                        console.log(`[${context}][createNotificationsPayments] Notifications save!`);
                                                                                    };
                                                                                });

                                                                            })
                                                                            .catch(async (error) => {
                                                                                await doNotification(context, payment);
                                                                                console.error(`[${context}][makePaymentCard] Error `, error.message);

                                                                            });

                                                                    } else {

                                                                        let foundPaymentMethod = allPaymentMethodsFound.find(paymentMethod => {
                                                                            return paymentMethod.defaultPaymentMethod === true;
                                                                        });

                                                                        let paymentMethodId;

                                                                        if (foundPaymentMethod) {
                                                                            paymentMethodId = foundPaymentMethod.paymentMethodId;
                                                                        } else {
                                                                            paymentMethodId = allPaymentMethodsFound[0].paymentMethodId;
                                                                        };

                                                                        payment.paymentMethodId = paymentMethodId;
                                                                        makePaymentCard(payment)
                                                                            .then(async (result) => {

                                                                                let paymentFound = await Payments.findOne({ _id: payment._id });

                                                                                let notificationsPayments = new NotificationsPayments({
                                                                                    userId: paymentFound.userId,
                                                                                    sessionId: paymentFound.sessionId,
                                                                                    transactionId: paymentFound.transactionId,
                                                                                    paymentId: paymentFound._id,
                                                                                    paymentMethod: paymentFound.paymentMethod,
                                                                                    numberAattempts: 1,
                                                                                    active: true,
                                                                                    clientName: paymentFound.clientName
                                                                                });

                                                                                if (
                                                                                    result.chargerType === process.env.MobieCharger ||
                                                                                    result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                                    result.chargerType === Enums.ChargerTypes.Hubject
                                                                                ) {
                                                                                    updateSessionMobiE(result, "checkPayments")
                                                                                }
                                                                                else {
                                                                                    updateSessionEVIO(result, "checkPayments")
                                                                                };

                                                                                NotificationsPayments.createNotificationsPayments(notificationsPayments, (err, result) => {
                                                                                    if (err) {
                                                                                        console.error(`[${context}][createNotificationsPayments] Error `, err.message);
                                                                                    }
                                                                                    else {
                                                                                        console.log(`[${context}][createNotificationsPayments] Notifications save!`);
                                                                                    };
                                                                                });

                                                                            })
                                                                            .catch(async (error) => {
                                                                                await doNotification(context, payment);
                                                                                console.error(`[${context}][makePaymentCard] Error `, error.message);

                                                                            });

                                                                    };

                                                                };

                                                            });

                                                        } else {
                                                            await doNotification(context, payment);
                                                        };

                                                    };

                                                });
                                            };
                                        });

                                    } else {
                                        paymentsFound.map(async payment => {
                                            //let clientName = payment.clientName;

                                            console.log("payment.clientName - ", payment.clientName);
                                            let params = {
                                                userId: payment.userId,
                                                sessionId: payment.sessionId,
                                                transactionId: payment.transactionId,
                                                paymentId: payment._id,
                                                active: true,
                                                userBlocked: true
                                            };

                                            NotificationsPayments.findOne(params, async (err, notificationFound) => {
                                                if (err) {

                                                    console.error(`[${context}] Error `, err.message);

                                                };

                                                if (notificationFound) {
                                                    console.log("User already blocked", notificationFound.userId);
                                                } else {

                                                    if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                                                        //Created a new transaction
                                                        var newTransaction = new Transactions(
                                                            {
                                                                userId: payment.userId,
                                                                transactionType: process.env.TransactionTypeDebit,
                                                                status: process.env.TransactionStatusSentToGenerate,
                                                                provider: payment.paymentMethod,
                                                                amount: payment.amount,
                                                                sessionId: payment.sessionId,
                                                                paymentId: payment._id,
                                                                clientName: payment.clientName

                                                            }
                                                        );

                                                        let transactionCreated = await createNewTransactions(newTransaction);
                                                        payment.transactionId = transactionCreated._id.toString();
                                                        await Payments.findOneAndUpdate({ _id: payment._id }, { $set: payment }, { new: true });
                                                    };

                                                    payment.amount.value = Math.abs(payment.amount.value);
                                                    if (userWallet.amount.value - payment.amount.value >= 0) {

                                                        //Verify if have all the value in wallet
                                                        if (payment.paymentMethod !== process.env.PaymentMethodWallet) {

                                                            payment.paymentMethod = process.env.PaymentMethodWallet;
                                                            payment.status = process.env.PaymentStatusFaild;

                                                            await paymentUpdate({ _id: payment._id }, { $set: { paymentMethod: process.env.PaymentMethodWallet, paymentMethod: process.env.PaymentMethodWallet, status: process.env.PaymentStatusFaild } });
                                                            await transactionsUpdate({ _id: payment.transactionId }, { $set: { provider: process.env.PaymentMethodWallet } });
                                                        };

                                                        makePayment(payment)
                                                            .then((result) => {

                                                                if (
                                                                    result.chargerType === process.env.MobieCharger ||
                                                                    result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                    result.chargerType === Enums.ChargerTypes.Hubject
                                                                ) {
                                                                    updateSessionMobiE(result, "checkPayments")
                                                                }
                                                                else {
                                                                    updateSessionEVIO(result, "checkPayments")
                                                                };
                                                                console.log(`[${context}][makePayment] Payment done!`);
                                                            })
                                                            .catch(async (error) => {
                                                                await doNotification(context, payment);
                                                                console.error(`[${context}][makePayment] Error `, error.message);
                                                            });

                                                    } else if (allPaymentMethodsFound.length > 0) {

                                                        query = {
                                                            userId: payment.userId,
                                                            sessionId: payment.sessionId,
                                                            transactionId: payment.transactionId,
                                                            paymentId: payment._id,
                                                            paymentMethod: payment.paymentMethod,
                                                            active: true
                                                        };

                                                        NotificationsPayments.findOne(query, async (err, notificationFound) => {
                                                            if (err) {
                                                                console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
                                                            };

                                                            if (notificationFound) {

                                                                //Foi encontrado
                                                                //Verificar se envia notificação ou SMS ou verificar se cancela contratos
                                                                if (notificationFound.notificatcionSend === false && notificationFound.emailSend === false && notificationFound.numberAattempts === 1) {
                                                                    //Send notification and SMS
                                                                    let validateSession = await validateSessionFunc(notificationFound)
                                                                    if (!validateSession) {
                                                                        sendNotifications(notificationFound);
                                                                        //sendSMS(notificationFound);
                                                                        let debtValue = `${payment.amount.value} ${payment.amount.currency}`;
                                                                        console.log(`[${context}] DebtValue `, debtValue);
                                                                        sendEmail(notificationFound, debtValue);
                                                                    }
                                                                }
                                                                else if (!notificationFound.userBlocked) {
                                                                    //Deactivate all contracts
                                                                    //console.log("notificationFound", notificationFound);
                                                                    deactivateContracts(notificationFound, true);
                                                                };

                                                            } else {

                                                                let paymentMethodFound = allPaymentMethodsFound.find(elem => {
                                                                    return elem.paymentMethodId === payment.paymentMethodId;
                                                                });

                                                                if (paymentMethodFound) {

                                                                    makePaymentCard(payment)
                                                                        .then(async (result) => {

                                                                            let paymentFound = await Payments.findOne({ _id: payment._id });

                                                                            let notificationsPayments = new NotificationsPayments({
                                                                                userId: paymentFound.userId,
                                                                                sessionId: paymentFound.sessionId,
                                                                                transactionId: paymentFound.transactionId,
                                                                                paymentId: paymentFound._id,
                                                                                paymentMethod: paymentFound.paymentMethod,
                                                                                numberAattempts: 1,
                                                                                active: true,
                                                                                clientName: paymentFound.clientName
                                                                            });

                                                                            if (
                                                                                result.chargerType === process.env.MobieCharger ||
                                                                                result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                                result.chargerType === Enums.ChargerTypes.Hubject
                                                                            ) {
                                                                                updateSessionMobiE(result, "checkPayments")
                                                                            }
                                                                            else {
                                                                                updateSessionEVIO(result, "checkPayments")
                                                                            };

                                                                            NotificationsPayments.createNotificationsPayments(notificationsPayments, async (err, result) => {
                                                                                if (err) {
                                                                                    console.error(`[${context}][createNotificationsPayments] Error `, err.message);
                                                                                }
                                                                                notificationsPayments._id = result._id;
                                                                                await doNotification(context, paymentFound);
                                                                                console.log(`[${context}][createNotificationsPayments] Notifications save!`);
                                                                            });

                                                                        })
                                                                        .catch(async (error) => {
                                                                            await doNotification(context, payment);
                                                                            console.error(`[${context}][makePaymentCard] Error `, error.message);

                                                                        });

                                                                } else {

                                                                    let foundPaymentMethod = allPaymentMethodsFound.find(paymentMethod => {
                                                                        return paymentMethod.defaultPaymentMethod === true;
                                                                    });

                                                                    let paymentMethodId;

                                                                    if (foundPaymentMethod) {
                                                                        paymentMethodId = foundPaymentMethod.paymentMethodId;
                                                                    } else {
                                                                        paymentMethodId = allPaymentMethodsFound[0].paymentMethodId;
                                                                    };

                                                                    payment.paymentMethodId = paymentMethodId;
                                                                    makePaymentCard(payment)
                                                                        .then(async (result) => {

                                                                            let paymentFound = await Payments.findOne({ _id: payment._id });

                                                                            let notificationsPayments = new NotificationsPayments({
                                                                                userId: paymentFound.userId,
                                                                                sessionId: paymentFound.sessionId,
                                                                                transactionId: paymentFound.transactionId,
                                                                                paymentId: paymentFound._id,
                                                                                paymentMethod: paymentFound.paymentMethod,
                                                                                numberAattempts: 1,
                                                                                active: true,
                                                                                clientName: paymentFound.clientName
                                                                            });

                                                                            if (
                                                                                result.chargerType === process.env.MobieCharger ||
                                                                                result.chargerType === Enums.ChargerTypes.Gireve ||
                                                                                result.chargerType === Enums.ChargerTypes.Hubject
                                                                            ) {
                                                                                updateSessionMobiE(result, "checkPayments")
                                                                            }
                                                                            else {
                                                                                updateSessionEVIO(result, "checkPayments")
                                                                            };

                                                                            NotificationsPayments.createNotificationsPayments(notificationsPayments, async (err, result) => {
                                                                                if (err) {
                                                                                    console.error(`[${context}][createNotificationsPayments] Error `, err.message);
                                                                                } else {
                                                                                    notificationsPayments._id = result._id;
                                                                                    await doNotification(context, paymentFound);
                                                                                    console.log(`[${context}][createNotificationsPayments] Notifications save!`);
                                                                                };
                                                                            });



                                                                        })
                                                                        .catch(async (error) => {
                                                                            await doNotification(context, payment);
                                                                            console.error(`[${context}][makePaymentCard] Error `, error.message);

                                                                        });

                                                                };

                                                            };

                                                        });

                                                    } else {

                                                        let newQueryParams = {
                                                            userId: payment.userId,
                                                            sessionId: payment.sessionId,
                                                            transactionId: payment.transactionId,
                                                            paymentId: payment._id,
                                                            paymentMethod: payment.paymentMethod,
                                                            active: true
                                                        };

                                                        NotificationsPayments.findOne(newQueryParams, async (err, notificationFound) => {
                                                            if (err) {
                                                                console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
                                                            };

                                                            if (notificationFound && !notificationFound.userBlocked) {
                                                                deactivateContracts(notificationFound, true);
                                                            } else {

                                                                let notificationsPayments = new NotificationsPayments({
                                                                    userId: payment.userId,
                                                                    sessionId: payment.sessionId,
                                                                    transactionId: payment.transactionId,
                                                                    paymentId: payment._id,
                                                                    paymentMethod: payment.paymentMethod,
                                                                    numberAattempts: 1,
                                                                    active: true,
                                                                    clientName: payment.clientName
                                                                });


                                                                NotificationsPayments.createNotificationsPayments(notificationsPayments, async (err, result) => {
                                                                    if (err) {
                                                                        console.error(`[${context}][createNotificationsPayments] Error `, err.message);
                                                                    };

                                                                    let validateSession = await validateSessionFunc(result)
                                                                    if (!validateSession) {
                                                                        sendNotifications(result);
                                                                        //sendSMS(result);
                                                                        let debtValue = `${payment.amount.value} ${payment.amount.currency}`;
                                                                        console.log(`[${context}] DebtValue `, debtValue);
                                                                        sendEmail(result, debtValue);
                                                                    }
                                                                    console.log(`[${context}][createNotificationsPayments] Notifications save!`);

                                                                });

                                                            };

                                                        });

                                                    };

                                                };

                                            });
                                        });

                                    };

                                };

                            });

                        };

                    };

                });

            };

        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message ?? error);
        Sentry.captureException(error);
        return null;
    }
};

async function doNotification(context, payment) {

    let newQueryParams = {
        userId: payment.userId,
        sessionId: payment.sessionId,
        transactionId: payment.transactionId,
        paymentId: payment._id,
        paymentMethod: payment.paymentMethod,
        active: true
    };

    console.log(context, ', doNotification')
    NotificationsPayments.findOne(newQueryParams, async (err, notificationFound) => {
        if (err) {
            console.error(`[${context}][NotificationsPayments.findOne] Error `, err.message);
        };

        if (notificationFound && !notificationFound.userBlocked) {
            deactivateContracts(notificationFound, true);
        } else {
            let notificationsPayments = new NotificationsPayments({
                userId: payment.userId,
                sessionId: payment.sessionId,
                transactionId: payment.transactionId,
                paymentId: payment._id,
                paymentMethod: payment.paymentMethod,
                numberAattempts: 1,
                active: true,
                clientName: payment.clientName
            });

            NotificationsPayments.createNotificationsPayments(notificationsPayments, async (err, result) => {
                if (err) {
                    console.error(`[${context}][createNotificationsPayments] Error `, err.message);
                };

                let validateSession = await validateSessionFunc(result)
                if (!validateSession) {
                    sendNotifications(result);
                    //sendSMS(result);
                    let debtValue = `${payment.amount.value} ${payment.amount.currency}`;
                    console.log(`[${context}] DebtValue `, debtValue);
                    sendEmail(result, debtValue);
                }
                console.log(`[${context}][createNotificationsPayments] Notifications save!`);
                await paymentUpdate({ _id: payment._id }, { $set: { status: process.env.PaymentStatusFaild } });
                await transactionsUpdate({ _id: payment.transactionId }, { $set: { status: process.env.TransactionStatusFaild } });

            });
            deactivateContracts(notificationFound, true);
        };

        await paymentUpdate({ _id: payment._id }, { $set: { status: process.env.PaymentStatusFaild } });
        await transactionsUpdate({ _id: payment.transactionId }, { $set: { status: process.env.TransactionStatusFaild } });

    });
}

async function sendNotifications(result) {
    const context = "Function sendNotifications";
    const query = { _id: result._id };
    const newValues = {
        $set: { notificatcionSend: true }
    };

    try {

        await notifyAccountLowBalance((result.paymentMethod === process.env.PaymentMethodWallet ? CodeTranslationsPushNotifications.NOTIFICATION_ACCOUNT_LOW_BALANCE_WALLET : CodeTranslationsPushNotifications.NOTIFICATION_ACCOUNT_LOW_BALANCE_CARD), result.userId)
        NotificationsPayments.updateNotificationsPayments(query, newValues, (err, result) => {
            err ? console.error(`[${context}][updateNotificationsPayments] Error `, err.message) :
                console.log(`[${context}][updateNotificationsPayments] Notifications Updated!`)
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function sendEmail(result, debtValue = null) {
    var context = "Function sendEmail";

    try {

        let user = await getUser(result.userId);

        let mailOptions = {
            to: user.email,
            message: {
                "username": user.name,
                ...(debtValue !== null && { "debtValue": debtValue })
            },
            type: "missingPayments"
        };

        let headers = {
            clientname: user.clientName
        }

        var sendEmailRequest = process.env.NotificationsHost + process.env.PathSenEmail;
        axios.post(sendEmailRequest, { mailOptions }, { headers })
            .then((response) => {
                var query = {
                    _id: result._id
                };
                var newValues = {
                    $set: { emailSend: true }
                };
                NotificationsPayments.updateNotificationsPayments(query, newValues, (err, result) => {
                    if (err) {
                        console.error(`[${context}][updateNotificationsPayments] Error `, err.message);
                    }
                    else {
                        if (response) {
                            console.log("[Success] Mail Notification success");
                        } else {
                            console.log("[Error] Mail Notification error");
                        }
                    };
                });

            })
            .catch((error) => {

                var query = {
                    _id: result._id
                };
                var newValues = {
                    $set: { emailSend: true }
                };
                NotificationsPayments.updateNotificationsPayments(query, newValues, (err, result) => {
                    if (err) {
                        console.error(`[${context}][updateNotificationsPayments] Error `, err.message);
                    }
                    else {
                        if (result) {
                            console.log("[Success] Mail Notification success");
                        } else {
                            console.log("[Error] Mail Notification error");
                        }
                    };
                });

                if (error.response) {
                    console.error(`[${context}][${sendEmailRequest}] Error `, error.response.message);
                }
                else {
                    console.error(`[${context}][${sendEmailRequest}] Error `, error.message);
                };

            })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

async function deactivateContracts(result, skipContractDeactivation = false) {
    const context = "Function deactivateContracts";

    try {
        console.log(`[${context}] Starting with result:`, JSON.stringify(result));
        console.log(`[${context}] skipContractDeactivation: ${skipContractDeactivation}`);

        let validateSession = await validateSessionFunc(result)
        console.log(`[${context}] validateSession: ${validateSession}`);

        if (validateSession) {
            let query = {
                userId: result.userId,
                _id: result._id
            };

            let newValues = {
                $set: {
                    userBlocked: true
                }
            };

            NotificationsPayments.updateNotificationsPayments(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}] [updateNotificationsPayments] Error`, err);
                } else {
                    console.log(`[${context}] Notifications payments updated`);
                };
            });

        } else {
            const headers = {
                userid: result.userId
            };

            const data = {
                key: process.env.StatusMessageInactivate,
                skipContractDeactivation
            };

            const proxyIdentity = process.env.HostUser + process.env.PathDeactivateContracts;

            console.log(`[${context}] PATCH headers:`, headers);
            console.log(`[${context}] PATCH data:`, data);

            axios.patch(proxyIdentity, data, { headers })
                .then((response) => {
                    console.log(`[${context}] [${proxyIdentity}] Contracts deactivated`);

                    let query = {
                        userId: result.userId,
                        _id: result._id
                    };

                    let newValues = {
                        $set: {
                            userBlocked: true
                        }
                    };

                    NotificationsPayments.updateNotificationsPayments(query, newValues, (err, result) => {
                        if (err) {
                            console.error(`[${context}] [updateNotificationsPayments] Error`, err);
                        } else {
                            console.log(`[${context}] Notifications payments updated`);
                        };
                    });

                })
                .catch((error) => {
                    console.error(`[${context}] [${proxyIdentity}] Error`, error);
                });
        }

    } catch (error) {
        console.error(`[${context}] Error`, error);
    };
};

function validateSessionFunc(result) {
    const context = "Function validateSessionFunc";
    return new Promise(async (resolve, reject) => {
        try {
            let params = {
                _id: result.sessionId
            }
            let hostEVIO = process.env.HostCharger + process.env.PathGetSessionById;
            let session = await axios.get(hostEVIO, { params })

            if (!session?.data) {
                let hostEVIO = process.env.HostOcpi + process.env.PathGetSessionById;
                session = await axios.get(hostEVIO, { params })
            }

            if (session?.data) {
                let evOwner = session.data.evOwner
                let listPaymentMethod = await ListPaymentMethod.findOne({ userId: evOwner })

                if (listPaymentMethod) {

                    if (listPaymentMethod.paymentMethod.includes("transfer") || listPaymentMethod.paymentMethod.includes("Transfer")) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }

                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(false);
        };
    });
};

function validateEV(request) {
    const context = "Function validateEV";
    return new Promise(async (resolve, reject) => {
        try {

            let userIdWillPay;
            let userIdToBilling;
            let evOwner = false;
            let evOwnerBilling = false;

            // console.log("request.data.evId", request.data.evId)
            if (request.data.evId != '-1') {

                getSessionEV(request.data.evId)
                    .then((evFound) => {
                        if (evFound) {

                            if (evFound.userId === request.userId) {

                                //console.log("1")
                                let response = {
                                    evFound: evFound,
                                    userIdWillPay: request.userId,
                                    userIdToBilling: request.userId,
                                    evOwner: evOwner,
                                    evOwnerBilling: evOwnerBilling
                                };

                                resolve(response);
                            } else {

                                let foundDriver = evFound.listOfDrivers.find(driver => {
                                    return driver.userId === request.userId;
                                });

                                let foundGourpDriver = evFound.listOfGroupDrivers.filter(groups => {
                                    return groups.listOfDrivers.find(driver => {
                                        return driver.driverId === request.userId;
                                    });
                                });

                                if (foundDriver) {
                                    //validate who pays
                                    if (foundDriver.paymenteBy === process.env.EVPaymenteByDriver) {
                                        userIdWillPay = request.userId;
                                        evOwner = false;
                                    }
                                    else {
                                        userIdWillPay = evFound.userId;
                                        evOwner = true;
                                    };

                                    //validate who to bill
                                    if (foundDriver.billingBy === process.env.EVBillingByDriver) {
                                        userIdToBilling = request.userId;
                                    } else {
                                        userIdToBilling = evFound.userId;
                                        evOwnerBilling = true;
                                    };

                                } else if (foundGourpDriver.length > 0) {

                                    //validate who pays
                                    if (foundGourpDriver[0].paymenteBy === process.env.EVPaymenteByDriver) {
                                        userIdWillPay = request.userId;
                                        evOwner = false;
                                    } else {
                                        userIdWillPay = evFound.userId;
                                        evOwner = true;
                                    };

                                    //validate who to bill
                                    if (foundGourpDriver[0].billingBy === process.env.EVBillingByDriver) {
                                        userIdToBilling = request.userId;
                                    } else {
                                        userIdToBilling = evFound.userId;
                                        evOwnerBilling = true
                                    };
                                } else {

                                    userIdWillPay = request.userId;
                                    userIdToBilling = request.userId;
                                    evOwner = false

                                };

                                let response = {
                                    evFound: evFound,
                                    userIdWillPay: userIdWillPay,
                                    userIdToBilling: userIdToBilling,
                                    evOwner: evOwner,
                                    evOwnerBilling: evOwnerBilling
                                };
                                //console.log("2")
                                resolve(response);

                            };

                        } else {

                            let response = {
                                evFound: '-1',
                                userIdWillPay: request.userId,
                                userIdToBilling: request.userId,
                                evOwner: false,
                                evOwnerBilling: evOwnerBilling
                            };
                            //console.log("3")
                            resolve(response);
                        };
                    })
                    .catch((error) => {

                        console.error(`[${context}][getSessionEV] Error `, error.message);

                        let response = {
                            evFound: '-1',
                            userIdWillPay: request.userId,
                            userIdToBilling: request.userId,
                            evOwner: false,
                            evOwnerBilling: evOwnerBilling
                        };
                        //console.log("4")
                        resolve(response);

                    });

            } else {

                let response = {
                    evFound: '-1',
                    userIdWillPay: request.userId,
                    userIdToBilling: request.userId,
                    evOwner: false,
                    evOwnerBilling: evOwnerBilling
                };
                //console.log("5")
                resolve(response);

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);

            let response = {
                evFound: '-1',
                userIdWillPay: request.userId,
                userIdToBilling: request.userId,
                evOwner: false,
                evOwnerBilling: false
            };
            //console.log("6")
            resolve(response);

        };
    });
};

function makeReservationPaymentAdyen(paymentInfo) {
    var context = "Function makeReservationPaymentAdyen";
    return new Promise(async (resolve, reject) => {
        paymentInfo.adyenReference = "-1";
        paymentInfo.transactionId = "-1";
        resolve(paymentInfo);
    });
};


function adjustmentPreAuthorize(body, clientName) {
    var context = "Funciton adjustmentPreAuthorize";
    return new Promise((resolve, reject) => {
        try {

            body.modificationAmount.value = Math.abs(body.modificationAmount.value);

            if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                //TODO
                modificationSC.adjustAuthorisation(body)
                    //modification.adjustAuthorisation(body)
                    .then((result) => {
                        if (result.response === '[adjustAuthorisation-received]') {
                            resolve(true);
                        }
                        else {
                            resolve(false);
                        }
                    })
                    .catch((error) => {
                        console.error(`[${context}][modificationSC.adjustAuthorisation] Error `, error.message);
                        reject(error);
                    });
            } else {
                modification.adjustAuthorisation(body)
                    .then((result) => {
                        if (result.response === '[adjustAuthorisation-received]') {
                            resolve(true);
                        }
                        else {
                            resolve(false);
                        }
                    })
                    .catch((error) => {
                        console.error(`[${context}][modification.adjustAuthorisation] Error `, error.message);
                        reject(error);
                    });
            };
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//checkSessions()
async function checkSessions(numberOfSessions = undefined) {
    const context = "Function checkSessions";

    try {
        console.log(`[${context}] Start...`);
        let sessionsEVIO = await getSessionsEVIO(numberOfSessions);
        let sessionsMobiE = await getSessionsMobiE(numberOfSessions);
        let sessions = sessionsEVIO.concat(sessionsMobiE);

        if (sessions.length > 0) {

            sessions.map((session) => {
                if ( [process.env.PaymentMethodTypeTransfer.toUpperCase(), process.env.PaymentMethodUnknown.toUpperCase(), process.env.PaymentMethodNotPay.toUpperCase()].includes(session.paymentMethod.toUpperCase()) ) {

                    if (session.plafondId && session.plafondId !== "-1" && !session.syncToPlafond) {
                        makeTransactionPlafond(session);
                    };


                } else {

                    let query = {
                        sessionId: session._id
                    };

                    paymentFind(query)
                        .then((paymentsFounded) => {
                            let paymentFound = paymentsFounded.find(payment => payment.reason !== Constants.RESERVATION_REASON);
                            
                            if (session.plafondId && session.plafondId !== "-1" && !session.syncToPlafond) {
                                //console.log("session.plafondId", session.plafondId);

                                makeTransactionPlafond(session);

                            };

                            if (paymentFound) {

                                var publicNetworkChargerType = process.env.PublicNetworkChargerType;

                                publicNetworkChargerType = publicNetworkChargerType.split(',');

                                var found = publicNetworkChargerType.find(type => {
                                    return type === paymentFound.chargerType;
                                });

                                if (found) {

                                    updateSessionMobiE(paymentFound, "checkSessions");

                                } else {

                                    updateSessionEVIO(paymentFound, "checkSessions");

                                };

                            } else {

                                let payments = new Payments(
                                    {
                                        sessionId: session._id,
                                        hwId: session.hwId,
                                        chargerType: session.chargerType,
                                        amount: { value: session.estimatedPrice },
                                        status: process.env.PaymentStatusStartPayment,
                                        paymentMethod: session.paymentMethod,
                                        paymentMethodId: session.paymentMethodId,
                                        transactionId: session.transactionId,
                                        adyenReference: session.adyenReference,
                                        reservedAmount: session.reservedAmount,
                                        userId: session.userIdWillPay,
                                        totalPrice: session.totalPrice,
                                        clientName: session.clientName,
                                        userIdToBilling: session.userIdToBilling
                                    }
                                );

                                if (!process.env.PublicNetworkChargerType.includes(session.chargerType)) {
                                    payments.costDetails = session.costDetails
                                };

                                Payments.createPayments(payments, (err, result) => {
                                    if (err) {

                                        console.error(`[${context}] Error `, err.message);

                                    }

                                    makePayment(result)
                                        .then((result) => {

                                            var publicNetworkChargerType = process.env.PublicNetworkChargerType;

                                            publicNetworkChargerType = publicNetworkChargerType.split(',');

                                            var found = publicNetworkChargerType.find(type => {
                                                return type === payments.chargerType;
                                            });

                                            if (found) {

                                                updateSessionMobiE(result, "checkSessions");

                                            }
                                            else {

                                                updateSessionEVIO(result, "checkSessions");

                                            };

                                        })
                                        .catch((error) => {

                                            console.error(`[${context}][makePayment] Error `, error.message);

                                        });

                                });

                            };

                        })
                        .catch((error) => {

                            console.error(`[${context}][paymentFindOne] Error `, error.message);

                        });

                };
            });

        } else {

            console.log(`[${context}] No sessions to pay `);

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };

};

//getSessionsEVIO()
function getSessionsEVIO(limit = undefined) {
    var context = "Function getSessionsEVIO";
    return new Promise((resolve, reject) => {

        try {
            const limitQuery = limit ? `limit=${limit}` : '';

            let proxy = `${process.env.HostCharger}${process.env.PathGetSessionsNoPaymentId}?${limitQuery}`;

            axios.get(proxy)
                .then((result) => {

                    console.log("getSessionsEVIO", result.data.length)
                    resolve(result.data);

                })
                .catch((error) => {

                    if (error.response)

                        console.error(`[${context}] [${proxy}] Error `, error.response);

                    else

                        console.error(`[${context}] [${proxy}] Error `, error.message);

                    resolve([]);
                    //reject(error);

                });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error);

        };

    });
};

function updateSessionEVIO(payment, call) {
    var context = "Function updateSessionEVIO";
    try {

        console.log("Call ", call)
        let data = payment;

        let proxy = process.env.HostCharger + process.env.PathUpdateSessionPaymentId;

        axios.put(proxy, data)
            .then((result) => {

                console.log(`[${context}][PUT] Session updated successfully`);

            })
            .catch((error) => {

                console.error(`[${context}][PUT] Error `, error.message);

            });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function getClientTypeAndPlanCeme(userId, sessionUser, evFound, idTag = '') {
    let context = "Function getClientType";
    return new Promise(async (resolve, reject) => {

        try {
            let host = process.env.HostUser + process.env.PathInfoUser;
            let headers = {
                userid: userId ?? sessionUser
            };
            if (evFound !== '-1') {
                const paymentBy = evFound?.listOfDrivers?.find(({ userId }) => userId === sessionUser)?.paymenteBy;
                if (paymentBy && paymentBy !== 'driver') {
                    headers.userid = evFound?.userId
                }
                const enableSendUid = await toggle.isEnable('charge-315-fix-session-cardnumber-associate_d');
                if (enableSendUid && !(sessionUser === userId && sessionUser === evFound?.userId)) {
                    headers.evid = evFound?._id
                }
            }

            if (idTag) {
                headers.idtag = idTag;
            }

            axios.get(host, { headers })
                .then((result) => {

                    //console.log("result", result.data)
                    resolve(result.data);

                })
                .catch((error) => {

                    console.error(`[${context}] [${host}] Error `, error.message);
                    resolve({
                        clientType: "b2c",
                        planCeme: {},
                        planRoaming: []
                    });
                    //reject(error.message);

                });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve({
                clientType: "b2c",
                planCeme: {},
                planRoaming: []
            });
            //reject(error);

        };

    });
};

async function updateSessions(payment) {
    var context = "Function updateSessions";

    payment = JSON.parse(JSON.stringify(payment));

    let sessionsEVIO = await getSessionsIds(payment.listOfSessionsMonthly.filter(session => {
        return session.chargerType !== "004" && session.chargerType !== "010" && session.chargerType !== Enums.ChargerTypes.Hubject
    }));

    let sessionsOCPI = await getSessionsIds(payment.listOfSessionsMonthly.filter(session => {
        return session.chargerType === "004" || session.chargerType === "010" || session.chargerType === Enums.ChargerTypes.Hubject
    }));

    if (sessionsEVIO.length > 0)
        updateMultiSessionEVIOB2B(sessionsEVIO, payment);

    if (sessionsOCPI.length > 0)
        updateMultiSessionOCPI2B(sessionsOCPI, payment);
    //console.log("sessionsEVIO", sessionsEVIO);
    //console.log("sessionsOCPI", sessionsOCPI);
};

function updateMultiSessionEVIOB2B(sessionsEVIO, payment) {
    var context = "Function updateMultiSessionEVIOB2B";
    try {

        let data = {
            paymentId: payment._id,
            sessionId: sessionsEVIO,
            status: payment.status,
            transactionId: payment.transactionId
        };

        let host = process.env.HostCharger + process.env.PathUpdateMonthlyBilling;

        axios.put(host, data)
            .then((result) => {

                //console.log(result.data);
                if (result.data) {
                    console.log(`[${context}] Sessions Updated`);
                } else {
                    console.log(`[${context}] Sessions Not Updated`);
                };

            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
            })

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

//TODO
function updateMultiSessionEVIO(payment) {
    var context = "Function updateMultiSessionEVIO";
    try {

        if (payment.listOfSessions > 0) {

            payment.listOfSessions.map(session => {

                let data = {
                    _id: payment._id,
                    sessionId: session
                };

                let proxy = process.env.HostCharger + process.env.PathUpdateSessionPaymentId;

                axios.put(proxy, data)
                    .then((result) => {

                        console.log(`[${context}][PUT] Session updated successfully`);

                    })
                    .catch((error) => {

                        console.error(`[${context}][PUT] Error `, error.message);

                    });

            });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function getPaymentPeriod(userIdWillPay) {
    var context = "Function getPaymentPeriod";
    return new Promise((resolve, reject) => {
        try {

            let host = process.env.HostUser + process.env.PathGetUser;

            let headers = {
                userid: userIdWillPay
            };

            axios.get(host, { headers })
                .then((result) => {

                    if (result.data) {
                        var user = result.data;
                        switch (user.paymentPeriod) {
                            case process.env.PaymentTypeMonthly:
                                resolve({
                                    userWillPay: false,
                                    paymentType: user.paymentPeriod
                                });
                                break;
                            default:
                                resolve({
                                    userWillPay: true,
                                    paymentType: process.env.PaymentTypeAD_HOC
                                });
                                break;
                        }
                        /*if (user.paymentPeriod === process.env.PaymentTypeMonthly) {

                        }
                        else {

                        };*/
                    }
                    else {
                        resolve({
                            userWillPay: true,
                            paymentType: process.env.PaymentTypeAD_HOC
                        });
                    };

                })
                .catch((error) => {

                    console.error(`[${context}][axios.get] Error `, error.message);
                    resolve({
                        userWillPay: true,
                        paymentType: process.env.PaymentTypeAD_HOC
                    });
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve({
                userWillPay: true,
                paymentType: process.env.PaymentTypeAD_HOC
            });

        };
    });
};

function transactionFindOne(query) {
    var context = "Function transactionFindOne";
    return new Promise((resolve, reject) => {

        Transactions.findOne(query, (err, result) => {

            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };

        });

    });
};

//========== FUNCTION MobiE ==========
//getSessionsMobiE()
function getSessionsMobiE(limit = undefined) {
    let context = "Function getSessionsMobiE";
    return new Promise((resolve, reject) => {

        try {
            const limitQuery = limit ? `limit=${limit}` : '';

            let proxy = `${process.env.HostOcpi}${process.env.PathGetSessionsNoPaymentId}?${limitQuery}`;

            axios.get(proxy)
                .then((result) => {

                    console.log("getSessionsMobiE", result.data.length)
                    resolve(result.data);

                })
                .catch((error) => {

                    if (error.response)

                        console.error(`[${context}] [${proxy}] Error `, error.response);

                    else

                        console.error(`[${context}] [${proxy}] Error `, error.message);
                    resolve([]);
                    //reject(error);

                });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve([]);
            //reject(error);

        };

    });
};

function updateSessionMobiE(payment, call) {
    var context = "Function updateSessionMobiE";
    try {


        console.log("Call ", call)
        let data = payment;

        let proxy = process.env.HostOcpi + process.env.PathUpdateSessionPaymentId;

        axios.put(proxy, data)
            .then((result) => {

                console.log(`[${context}][PUT] Session updated successfully`);

            })
            .catch((error) => {

                console.error(`[${context}][PUT] Error `, error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function updateMultiSessionOCPI2B(sessionsOCPI, payment) {
    var context = "Function updateMultiSessionOCPI2B";
    try {

        let data = {
            paymentId: payment._id,
            sessionId: sessionsOCPI,
            status: payment.status,
            transactionId: payment.transactionId
        };

        let host = process.env.HostOcpi + process.env.PathPaymentStatusMonthlyBilling;

        axios.put(host, data)
            .then((result) => {

                //console.log(result.data);
                if (result.data) {
                    console.log(`[${context}] Sessions Updated`);
                } else {
                    console.log(`[${context}] Sessions Not Updated`);
                };

            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
            })


    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function updateMultiSessionMobiE(payment) {
    var context = "Function updateMultiSessionMobiE";
    try {

        if (payment.listOfSessions > 0) {

            payment.listOfSessions.map(session => {

                let data = {
                    _id: payment._id,
                    sessionId: session
                };

                let proxy = process.env.HostOcpi + process.env.PathUpdateSessionPaymentId;

                axios.put(proxy, data)
                    .then((result) => {

                        console.log(`[${context}][PUT] Session updated successfully`);

                    })
                    .catch((error) => {

                        console.error(`[${context}][PUT] Error `, error.message);

                    });

            });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function getOpcTariffsPrices(data) {
    var context = "Function getOpcTariffsPrices";
    return new Promise((resolve, reject) => {
        try {
            var serviceProxy = process.env.HostOcpi + process.env.PathGetOpcTariffsPrices;

            axios.post(serviceProxy, data)
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getChargerOffset(timeZone, countryCode) {
    let offset = 0
    // IANA tzdata’s TZ-values representing the time zone of the location.
    if (typeof timeZone !== 'undefined' && timeZone !== null) {
        offset = timeZoneMoment.tz(timeZone)._offset
    } else {
        /*
            this method returns negative offsets as it counts the offset of utc to this timezone

            I'm also retrieving the last value assuming that there's only one timezone for each country. In europe works kinda well,
            although there are countries like Spain and Portugal that have more than one timezone because of the Azores(Portugal), Madeira (Portugal) and Canary islands (Spain)
        */
        let countryTimeZones = timeZoneMoment.tz.zonesForCountry(countryCode, true)
        offset = -countryTimeZones[countryTimeZones.length - 1].offset
    }

    return offset
}

function activateContracts(userId) {
    var context = "Function activateContracts";

    try {

        var headers = {
            userid: userId
        };

        var data = {
            key: ""
        }

        var proxyIdentity = process.env.HostUser + process.env.PathActivateContracts

        axios.patch(proxyIdentity, data, { headers })
            .then((result) => {
                console.log(`[${context}] [${proxyIdentity}] Contracts activated`);
            })
            .catch((error) => {
                console.error(`[${context}] [${proxyIdentity}] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

function creditNoteByPaymentId(paymentId) {
    var context = "Function creditNoteByPaymentId";
    return new Promise((resolve) => {
        let billingHost = 'http://billing:3030/api/private/billing/creditNoteByPaymentId';

        axios.post(billingHost, paymentId)
            .then((result) => {
                resolve(true);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(true)
            })
    })

}

function plafondFind(plafondId) {
    var context = "Function creditNoteByPaymentId";
    return new Promise((resolve, reject) => {

        let query = {
            _id: plafondId
        };

        Plafond.findOne(query, (err, plafondFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve(null);
            } else {
                resolve(plafondFound);
            };
        });
    });
};

function removeAmountFromPlafond(payment) {
    const context = "Function removeAmountFromPlafond";
    return new Promise(async (resolve, reject) => {
        try {
            //console.log("payment.sessionsId", payment.sessionId);

            let listOfSessions;

            if (process.env.PublicNetworkChargerType.includes(payment.chargerType)) {
                listOfSessions = await getSessionsOcpi(payment.sessionId);
            } else {
                listOfSessions = await getSessions(payment.sessionId);
            }

            let plafond = await plafondFind({ _id: payment.paymentMethodId });

            //console.log("plafond", plafond);
            //console.log("listOfSessions", listOfSessions);


            if (plafond.amount.value - payment.amount.value >= 0) {

                var transaction = {
                    sessionId: payment.sessionId,
                    chargerType: payment.chargerType,
                    source: ChargerTypes[payment.chargerType],
                    amount: payment.amount,
                    startDate: listOfSessions[0].startDate,
                    stopDate: listOfSessions[0].stopDate,
                    charger: {
                        address: listOfSessions[0].address,
                        hwId: listOfSessions[0].hwId,
                    },
                    status: process.env.TransactionStatusPaidOut,
                    transactionId: payment.transactionId,
                    paymentId: payment._id
                };

                var newTransaction = {
                    $push: {
                        transactionsList: transaction

                    },
                    $inc: {
                        "amount.value": -payment.amount.value,
                        "spentCurrentMonth.value": payment.amount.value
                    }
                };


                Plafond.findOneAndUpdate({ _id: plafond._id }, newTransaction, { new: true }, (err, plafondUpdated) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        resolve(plafondUpdated);
                    };
                });


            } else {

                var totalValue = payment.amount.value

                //console.log("2", totalValue);

                var transaction = {
                    sessionId: payment.sessionId,
                    chargerType: payment.chargerType,
                    source: ChargerTypes[payment.chargerType],
                    amount: {
                        value: parseFloat(plafond.amount.value.toFixed(2)),
                        currency: 'EUR'

                    },
                    startDate: listOfSessions[0].startDate,
                    stopDate: listOfSessions[0].stopDate,
                    charger: {
                        address: listOfSessions[0].address,
                        hwId: listOfSessions[0].hwId,
                    },
                    status: process.env.TransactionStatusPaidOut,
                    transactionId: payment.transactionId,
                    paymentId: payment._id
                };

                var pendingTransaction = {
                    sessionId: payment.sessionId,
                    chargerType: payment.chargerType,
                    source: ChargerTypes[payment.chargerType],
                    amount: {
                        value: parseFloat((totalValue - plafond.amount.value).toFixed(2)),
                        currency: 'EUR'

                    },
                    startDate: listOfSessions[0].startDate,
                    stopDate: listOfSessions[0].stopDate,
                    charger: {
                        address: listOfSessions[0].address,
                        hwId: listOfSessions[0].hwId,
                    },
                    status: process.env.TransactionStatusInPayment,
                    transactionId: payment.transactionId,
                    paymentId: payment._id
                };

                //console.log("pendingTransaction 2", pendingTransaction.amount.value);
                //console.log("transaction 2", transaction.amount.value);

                let transactionUpdated = await transactionsUpdateFilter({ _id: payment.transactionId }, { $set: { amount: transaction.amount } });
                let paymentUpdated = await paymentUpdateFilter({ _id: payment._id }, { $set: { amount: transaction.amount } });

                var newPayments = new Payments({
                    amount: pendingTransaction.amount,
                    paymentType: paymentUpdated.paymentType,
                    userId: paymentUpdated.userId,
                    sessionId: paymentUpdated.sessionId,
                    hwId: paymentUpdated.hwId,
                    chargerType: paymentUpdated.chargerType,
                    paymentMethod: paymentUpdated.paymentMethod,
                    paymentMethodId: paymentUpdated.paymentMethodId,
                    status: paymentUpdated.status,
                    clientName: paymentUpdated.clientName
                });

                var paymentCreated = await createPayments(newPayments);

                var newTransaction = new Transactions({
                    amount: pendingTransaction.amount,
                    userId: transactionUpdated.userId,
                    transactionType: transactionUpdated.transactionType,
                    status: transactionUpdated.status,
                    provider: transactionUpdated.provider,
                    sessionId: transactionUpdated.sessionId,
                    paymentId: paymentCreated._id,
                    clientName: transactionUpdated.clientName
                });

                var transactionCreated = await createNewTransactions(newTransaction);
                paymentCreated = await paymentUpdateFilter({ _id: paymentCreated._id }, { $set: { transactionId: transactionCreated._id } });

                pendingTransaction.transactionId = transactionCreated._id;
                pendingTransaction.paymentId = paymentCreated._id;


                //add to plafond
                var newTransaction = {
                    $push: {
                        transactionsList: transaction,
                        pendingTransactionsList: pendingTransaction

                    },
                    $inc: {
                        "amount.value": -paymentUpdated.amount.value,
                        "spentCurrentMonth.value": paymentUpdated.amount.value
                    }
                };

                Plafond.findOneAndUpdate({ _id: plafond._id }, newTransaction, { new: true }, (err, plafondUpdated) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        resolve(plafondUpdated);
                    };
                });

            };

        }
        catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };

    });
};

function removeAmountFromPlafondAndTransation(transactionCreated) {
    const context = "Function removeAmountFromPlafondAndTransation";
    return new Promise(async (resolve, reject) => {
        try {
            //console.log("payment.sessionsId", payment.sessionId);

            let listOfSessions;

            if (process.env.PublicNetworkChargerType.includes(transactionCreated.chargerType)) {
                try {
                    listOfSessions = await getSessionsOcpi(transactionCreated.sessionId);
                }
                catch (error) {
                    console.error(`[${context}][getSessionsOcpi] Error `, error.message);
                    reject(error);
                };
            } else {
                try {
                    listOfSessions = await getSessions(transactionCreated.sessionId);
                }
                catch (error) {
                    console.error(`[${context}][getSessions] Error `, error.message);
                    reject(error);
                };
            }
            let plafond;
            try {
                plafond = await plafondFind({ _id: transactionCreated.paymentId });
            }
            catch (error) {
                console.error(`[${context}][plafondFind] Error `, error.message);
                reject(error);
            };

            console.log("plafondId", plafond?._id, "transactionId", transactionCreated.paymentId, transactionCreated.amount);

            if (plafond.amount.value - transactionCreated.amount.value >= 0) {

                let transaction = {
                    sessionId: transactionCreated.sessionId,
                    chargerType: transactionCreated.chargerType,
                    source: ChargerTypes[transactionCreated.chargerType],
                    amount: transactionCreated.amount,
                    startDate: listOfSessions[0].startDate,
                    stopDate: listOfSessions[0].stopDate,
                    charger: {
                        address: listOfSessions[0].address,
                        hwId: listOfSessions[0].hwId,
                    },
                    status: process.env.TransactionStatusPaidOut,
                    transactionId: transactionCreated._id,
                    paymentId: transactionCreated.paymentId
                };

                let newTransaction = {
                    $push: {
                        transactionsList: transaction

                    },
                    $inc: {
                        "amount.value": -transactionCreated.amount.value,
                        "spentCurrentMonth.value": transactionCreated.amount.value
                    }
                };
                console.log("plafondIdInside", plafond?._id, "transactionIdInside", transactionCreated.paymentId);

                Plafond.findOneAndUpdate({ _id: plafond._id }, newTransaction, { new: true }, (err, plafondUpdated) => {
                    if (err) {
                        console.error(`[${context}][Plafond.findOneAndUpdate] Error `, err.message);
                        reject(err);
                    } else {
                        resolve(plafondUpdated);
                    };
                });


            } else {

                let totalValue = transactionCreated.amount.value

                //console.log("2", totalValue);

                let transaction = {
                    sessionId: transactionCreated.sessionId,
                    chargerType: transactionCreated.chargerType,
                    source: ChargerTypes[transactionCreated.chargerType],
                    amount: {
                        value: parseFloat(plafond.amount.value.toFixed(2)),
                        currency: 'EUR'

                    },
                    startDate: listOfSessions[0].startDate,
                    stopDate: listOfSessions[0].stopDate,
                    charger: {
                        address: listOfSessions[0].address,
                        hwId: listOfSessions[0].hwId,
                    },
                    status: process.env.TransactionStatusPaidOut,
                    transactionId: transactionCreated._id,
                    paymentId: transactionCreated.paymentId
                };

                let pendingTransaction = {
                    sessionId: transactionCreated.sessionId,
                    chargerType: transactionCreated.chargerType,
                    source: ChargerTypes[transactionCreated.chargerType],
                    amount: {
                        value: parseFloat((totalValue - plafond.amount.value).toFixed(2)),
                        currency: 'EUR'

                    },
                    startDate: listOfSessions[0].startDate,
                    stopDate: listOfSessions[0].stopDate,
                    charger: {
                        address: listOfSessions[0].address,
                        hwId: listOfSessions[0].hwId,
                    },
                    status: process.env.TransactionStatusInPayment,
                    transactionId: transactionCreated._id,
                    paymentId: transactionCreated.paymentId
                };

                //console.log("pendingTransaction 2", pendingTransaction.amount.value);
                //console.log("transaction 2", transaction.amount.value);

                console.log("plafondIdInsideElse", plafond?._id, "transactionIdInsideElse", transactionCreated.paymentId);
                let transactionUpdated;
                try {
                    transactionUpdated = await transactionsUpdateFilter({ _id: transactionCreated._id }, { $set: { amount: transaction.amount } });
                }
                catch (error) {
                    console.error(`[${context}][transactionsUpdateFilter] Error `, error.message);
                    reject(error);
                };

                let newTransaction = new Transactions({
                    amount: pendingTransaction.amount,
                    userId: transactionUpdated.userId,
                    transactionType: transactionUpdated.transactionType,
                    status: transactionUpdated.status,
                    provider: transactionUpdated.provider,
                    sessionId: transactionUpdated.sessionId,
                    paymentId: transactionUpdated.paymentId,
                    clientName: transactionUpdated.clientName
                });

                let newTransactionCreated;
                try {
                    newTransactionCreated = await createNewTransactions(newTransaction);
                }
                catch (error) {
                    console.error(`[${context}][createNewTransactions] Error `, error.message);
                    reject(error);
                };
                pendingTransaction.transactionId = newTransactionCreated._id;
                pendingTransaction.paymentId = newTransactionCreated.paymentId;


                //add to plafond
                let newValues = {
                    $push: {
                        transactionsList: transaction,
                        pendingTransactionsList: pendingTransaction

                    },
                    $inc: {
                        "amount.value": -transaction.amount.value,
                        "spentCurrentMonth.value": transaction.amount.value
                    }
                };

                Plafond.findOneAndUpdate({ _id: plafond._id }, newValues, { new: true }, (err, plafondUpdated) => {
                    if (err) {
                        console.error(`[${context}][Plafond.findOneAndUpdate 1] Error `, err.message);
                        reject(err);
                    } else {
                        resolve(plafondUpdated);
                    };
                });

            };

        }
        catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };

    });
};

function getSessionsOcpi(sessionsId) {
    var context = "Function getSessionsOcpi";
    return new Promise(async (resolve, reject) => {
        try {

            let host = process.env.HostOcpi + process.env.PathGetSessionOCPIById + "/" + sessionsId;

            //console.log("host", host);

            axios.get(host)
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.error(`[${context}] Error `, error.message);
                    resolve([]);
                })
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve([]);
        }

    });
};

async function chagerOwnerStart(userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod,
    chargerType, clientName, cardNumber, userIdToBilling, req, res, plafond) {
    let context = "Function chagerOwnerStart";

    let plafondId = "-1";

    //console.log("plafond", plafond)
    //console.log("plafond.includingInternalCharging", plafond.includingInternalCharging)
    if (plafond) {

        if (plafond.includingInternalCharging) {
            plafondId = await validatePlafond(plafond, userIdWillPay, userIdToBilling, req, res);
        }
    }

    let paymentInfo = {
        paymentMethod: process.env.PaymentMethodNotPay,
        paymentMethodId: "",
        walletAmount: 0,
        reservedAmount: 0,
        confirmationAmount: 0,
        userIdWillPay: userIdWillPay,
        adyenReference: "",
        transactionId: "",
        clientType: clientType,
        clientName: clientName,
        ceme: planCeme,
        viesVAT: viesVAT,
        paymentType: paymentType,
        billingPeriod: billingPeriod,
        userIdToBilling: userIdToBilling,
        plafondId: plafondId,
        cardNumber: cardNumber
    };
    //console.log("paymentInfo", paymentInfo);

    res.status(200).send(paymentInfo);
    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
    return res;

}

async function validateWalletQuantity(
    wallet,
    paymentMethods,
    reservedAmount,
    confirmationAmount,
    userIdWillPay,
    clientType,
    clientName,
    cardNumber,
    planCeme,
    viesVAT,
    paymentType,
    billingPeriod,
    evOwner,
    userIdToBilling,
    myActiveSessions,
    req,
    res,
    plafond
) {
    let context = 'Function validateWalletQuantity';
    try {
        let paymentInfo;
        let plafondId = '-1';
        if (plafond) {
            plafondId = await validatePlafond(plafond, userIdWillPay, userIdToBilling, req, res);
        }
        const isNewValuesFromWalletActive = await toggle.isEnable('bp-372-change_wallet_values');
        const minimumValueToStopSession = isNewValuesFromWalletActive ? walletConfig.minimumAmountTo.startSession : 2.5;
        if (wallet) {
            if (wallet.amount.value <= minimumValueToStopSession) {
                //verify if have payment methods
                if (paymentMethods) {
                    let paymentMethodId = paymentMethods.paymentMethodId;
                    paymentInfo = {
                        paymentMethod: process.env.PaymentMethodCard,
                        paymentMethodId: paymentMethodId,
                        walletAmount: 0,
                        reservedAmount: reservedAmount,
                        confirmationAmount: confirmationAmount,
                        userIdWillPay: userIdWillPay,
                        clientType: clientType,
                        clientName: clientName,
                        ceme: planCeme,
                        viesVAT: viesVAT,
                        paymentType:
                            paymentType === process.env.PaymentTypeMonthly
                                ? clientType === process.env.ClientTypeB2B
                                    ? process.env.PaymentTypeAD_HOC
                                    : paymentType
                                : paymentType,
                        billingPeriod: billingPeriod,
                        userIdToBilling: userIdToBilling,
                        plafondId: plafondId,
                        cardNumber: cardNumber,
                    };

                    makeReservationPaymentAdyen(paymentInfo)
                        .then((paymentInfo) => {
                            if (paymentInfo.auth) {
                                paymentInfo.auth = false;

                                res.status(400).send(paymentInfo);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                return res;
                            } else {

                                res.status(200).send(paymentInfo);
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                return res;
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined) {
                                if (error.response.status === 400) {
                                    var messageResponse;
                                    if (evOwner) {
                                        console.log('Tentativa 9 server_no_balance_paymentMethod_evOwner_required');
                                        messageResponse = {
                                            auth: false,
                                            code: 'server_no_balance_paymentMethod_evOwner_required',
                                            message:
                                                "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method.",
                                            userIdWillPay,
                                            userIdToBilling,
                                        };
                                    } else {
                                        messageResponse = {
                                            auth: false,
                                            code: 'server_no_balance_paymentMethod_required',
                                            message: 'No balance or payment methods available',
                                            redirect: 'payments',
                                            userIdWillPay,
                                            userIdToBilling,
                                        };
                                    }

                                    res.status(400).send(messageResponse);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                    return res;
                                } else {
                                    console.error(
                                        `[${context}][makeReservationPaymentAdyen][.catch] Error`,
                                        error.response
                                    );
                                    Sentry.captureException(error);

                                    return res
                                        .status(500)
                                        .send({ message: error.response, userIdWillPay, userIdToBilling });
                                }
                            } else {
                                Sentry.captureException(error);
                                console.error(`[${context}][makeReservationPaymentAdyen] Error `, error.message);
                                res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
                                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                                return res;
                            }
                        });
                } else {
                    var messageResponse;

                    if (evOwner) {
                        console.log('Tentativa 10 server_no_balance_paymentMethod_evOwner_required');
                        messageResponse = {
                            auth: false,
                            code: 'server_no_balance_paymentMethod_evOwner_required',
                            message:
                                "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method.",
                            userIdWillPay,
                            userIdToBilling,
                        };
                    } else {
                        messageResponse = {
                            auth: false,
                            code: 'server_no_balance_paymentMethod_required',
                            message: 'No balance or payment methods available',
                            redirect: 'payments',
                            userIdWillPay,
                            userIdToBilling,
                        };
                    }

                    res.status(400).send(messageResponse);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                    return res;
                }
            } else {
                let totalReservedAmount = 0;
                if (myActiveSessions.length > 0) {
                    myActiveSessions.map((session) => {
                        totalReservedAmount += session.reservedAmount;
                    });
                }

                let estimateCost = wallet.amount.value + wallet.creditAmount - totalReservedAmount;

                if (estimateCost >= 1) {
                    if (estimateCost < reservedAmount) {
                        reservedAmount = estimateCost;
                    }

                    paymentInfo = {
                        paymentMethod: process.env.PaymentMethodWallet,
                        paymentMethodId: '',
                        walletAmount: wallet.amount.value,
                        reservedAmount: reservedAmount,
                        confirmationAmount: confirmationAmount,
                        userIdWillPay: userIdWillPay,
                        adyenReference: '-1',
                        transactionId: '-1',
                        clientType: clientType,
                        clientName: clientName,
                        ceme: planCeme,
                        viesVAT: viesVAT,
                        paymentType:
                            paymentType === process.env.PaymentTypeMonthly
                                ? clientType === process.env.ClientTypeB2B
                                    ? process.env.PaymentTypeAD_HOC
                                    : paymentType
                                : paymentType,
                        billingPeriod: billingPeriod,
                        userIdToBilling: userIdToBilling,
                        plafondId: plafondId,
                        cardNumber: cardNumber,
                    };

                    res.status(200).send(paymentInfo);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                    return res;
                } else {
                    //verify if have payment methods
                    if (paymentMethods) {
                        let paymentMethodId = paymentMethods.paymentMethodId;

                        paymentInfo = {
                            paymentMethod: process.env.PaymentMethodCard,
                            paymentMethodId: paymentMethodId,
                            walletAmount: 0,
                            reservedAmount: 0,
                            confirmationAmount: 0,
                            userIdWillPay: userIdWillPay,
                            clientType: clientType,
                            clientName: clientName,
                            ceme: planCeme,
                            viesVAT: viesVAT,
                            paymentType:
                                paymentType === process.env.PaymentTypeMonthly
                                    ? clientType === process.env.ClientTypeB2B
                                        ? process.env.PaymentTypeAD_HOC
                                        : paymentType
                                    : paymentType,
                            billingPeriod: billingPeriod,
                            userIdToBilling: userIdToBilling,
                            plafondId: plafondId,
                            cardNumber: cardNumber,
                        };

                        makeReservationPaymentAdyen(paymentInfo)
                            .then((paymentInfo) => {
                                if (paymentInfo.auth) {
                                    paymentInfo.auth = false;

                                    res.status(400).send(paymentInfo);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                    return res;
                                } else {

                                    res.status(200).send(paymentInfo);
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                                    return res;
                                }
                            })
                            .catch((error) => {
                                if (error.response != undefined) {
                                    if (error.response.status === 400) {
                                        var messageResponse;
                                        if (evOwner) {
                                            console.log('Tentativa 11 server_no_balance_paymentMethod_evOwner_required');
                                            messageResponse = {
                                                auth: false,
                                                code: 'server_no_balance_paymentMethod_evOwner_required',
                                                message:
                                                    "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method.",
                                                userIdWillPay,
                                                userIdToBilling,
                                            };
                                        } else {
                                            messageResponse = {
                                                auth: false,
                                                code: 'server_no_balance_paymentMethod_required',
                                                message: 'No balance or payment methods available',
                                                redirect: 'payments',
                                                userIdWillPay,
                                                userIdToBilling,
                                            };
                                        }

                                        res.status(400).send(messageResponse);
                                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                                        return res;
                                    } else {
                                        console.error(
                                            `[${context}][makeReservationPaymentAdyen][.catch] Error`,
                                            error.response
                                        );


                                        return res
                                            .status(500)
                                            .send({ message: error.response, userIdWillPay, userIdToBilling });
                                    }
                                } else {

                                    console.error(`[${context}][makeReservationPaymentAdyen] Error `, error.message);
                                    res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
                                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                                    Sentry.captureException(error);
                                    return res;
                                }
                            });
                    } else {
                        var messageResponse;
                        if (evOwner) {
                            console.log('Tentativa 12 server_no_balance_paymentMethod_evOwner_required');
                            messageResponse = {
                                auth: false,
                                code: 'server_no_balance_paymentMethod_evOwner_required',
                                message:
                                    "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method.",
                                userIdWillPay,
                                userIdToBilling,
                            };
                        } else {
                            messageResponse = {
                                auth: false,
                                code: 'server_no_balance_paymentMethod_required',
                                message: 'No balance or payment methods available',
                                redirect: 'payments',
                                userIdWillPay,
                                userIdToBilling,
                            };
                        }

                        res.status(400).send(messageResponse);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                        return res;
                    }
                }
            }
        } else {
            const messageResponse = {
                auth: false,
                code: 'server_wallet_not_found',
                message: "The wallet wasn't found and therefore no validation could be done.",
            };

            res.status(400).send(messageResponse);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
            return res;
        }
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ message: error.message, userIdWillPay, userIdToBilling });
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
        return res;
    }
};

function paymentMethodCard(paymentMethods, reservedAmount, confirmationAmount, userIdWillPay, clientType, planCeme, viesVAT, paymentType, billingPeriod, evOwner, myActiveSessions, req, res) {
    var context = "Function paymentMethodCard";
    var paymentInfo;

    //verify if have payment methods
    if (paymentMethods) {

        let paymentMethodId = paymentMethods.paymentMethodId;
        paymentInfo = {
            paymentMethod: process.env.PaymentMethodCard,
            paymentMethodId: paymentMethodId,
            walletAmount: 0,
            reservedAmount: reservedAmount,
            confirmationAmount: confirmationAmount,
            userIdWillPay: userIdWillPay,
            clientType: clientType,
            ceme: planCeme,
            viesVAT: viesVAT,
            paymentType: paymentType,
            billingPeriod: billingPeriod
        };

        makeReservationPaymentAdyen(paymentInfo)
            .then((paymentInfo) => {

                if (paymentInfo.auth) {

                    paymentInfo.auth = false;
                    res.status(400).send(paymentInfo);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                    return res;

                }
                else {

                    res.status(200).send(paymentInfo);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, paymentInfo);
                    return res;

                };

            })
            .catch((error) => {
                if (error.response != undefined) {
                    if (error.response.status === 400) {

                        var messageResponse;
                        if (evOwner) {
                            console.log("Tentativa 9 server_no_balance_paymentMethod_evOwner_required")
                            messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_evOwner_required', message: "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method." };
                        }
                        else {
                            messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_required', message: 'No balance or payment methods available', redirect: "payments" };
                        };
                        res.status(400).send(messageResponse);
                        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                        return res;

                    }
                    else {

                        console.error(`[${context}][makeReservationPaymentAdyen][.catch] Error`, error.response);
                        return res.status(500).send(error.response);

                    };
                }
                else {

                    console.error(`[${context}][makeReservationPaymentAdyen] Error `, error.message);
                    res.status(500).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                    return res;

                };
            });

    } else {

        var messageResponse;

        if (evOwner) {

            console.log("Tentativa 10 server_no_balance_paymentMethod_evOwner_required")
            messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_evOwner_required', message: "The selected EV belogns to other user, that doen's have payment methods available. To start charging, the EV owner must add payment  method." };

        } else {

            messageResponse = { auth: false, code: 'server_no_balance_paymentMethod_required', message: 'No balance or payment methods available', redirect: "payments" };

        };

        res.status(400).send(messageResponse);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
        return res;

    };

};

function unlockUser(userId) {
    var context = "Function unlockUser";

    let query = {
        userId: userId,
        $or: [
            { status: "10" },
            { status: "20" },
            { status: "60" },
        ]
    };

    Payments.updateMany(query, { $set: { status: "30" } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        Transaction.updateMany(query, { $set: { status: "30" } }, (err, result) => {

            if (err) {
                console.error(`[${context}] Error `, err.message);
            };


            activateContracts(userId)

        });

    });

};

//addClientName()
function addClientName() {
    let context = "Function addClientName";

    Payments.updateMany({}, { $set: { clientName: process.env.clientNameEVIO } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        console.log(`[${context}] result `, result);
    });

};

//addUserIdToBilling()
function addUserIdToBilling() {
    let context = "Function addUserIdToBilling";
    Payments.find({}, { _id: 1, userId: 1 }, (err, paymentsFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };
        if (paymentsFound.length > 0) {
            paymentsFound.forEach(payment => {
                Payments.updatePayments({ _id: payment._id }, { $set: { userIdToBilling: payment.userId } }, (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    };
                    console.log("Success")
                });
            });
        };
    });
};

async function sendBillingDocumentPhysicalCard(paymentFound) {
    var context = "Function sendBillingDocumentPhysicalCard";
    //return new Promise((resolve, reject) => {
    try {

        let proxyBilling;

        if (paymentFound.clientName === process.env.clientNameEVIO) {
            proxyBilling = process.env.HostBilling + process.env.PathBillingDocument;
        } else {
            proxyBilling = process.env.HostBilling + process.env.PathBillingDocumentWL;
        };

        let data = await Invoices.createInvoiceDatePhysicalCard(paymentFound);

        axios.post(proxyBilling, data)
            .then((result) => {

                updateSessionInvoice(paymentFound, { invoiceId: result.data.invoiceId, invoiceStatus: true });

            })
            .catch((error) => {
                console.error(`[${context}][axiso.post] Error `, error.message);
            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
        //reject(error);
    };
    //})
};

function getUsers(userIds) {
    var context = "Function getUsers";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                _id: userIds
            };

            let host = process.env.HostUser + process.env.PathListOfUsers

            let result = await axiosS.axiosPostBody(host, params)

            resolve(result)
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve([]);
        }
    });
};

function sendFileBufferToEmailFromSupport(buffer, email, fileName) {
    var context = "Function sendFileBufferToEmailFromSupport";

    try {
        var transporter = nodemailer.createTransport({
            service: 'Hotmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        var mailOptions = {
            source: '"evio Support" <support@go-evio.com>',
            from: '"evio Support" <support@go-evio.com>',
            to: email,
            subject: 'List of uncollectibles',
            attachments:
            {
                filename: fileName,
                content: buffer
            }
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent!');
            };
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error.message);
        resolve([]);
    }
}

async function validatePlafond(plafond, userIdWillPay, userIdToBilling, req, res) {
    let context = "Function validatePlafond";
    try {

        let messageResponse = {
            auth: false,
            code: "server_plafond_not_enough",
            message: "Plafond amount is not enough",
            userIdWillPay,
            userIdToBilling,
        };

        if (plafond.amount.value >= plafond.minimumChargingValue.value) {
            console.log("plafond.amount.value >= plafond.minimumChargingValue.value")
            return plafond._id;
        }

        if (plafond.amount.value <= 0) {
            console.log("plafond.amount.value <= 0");

            res.status(400).send(messageResponse);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
            return res;
        } else {
            switch (plafond.actionMinimumValue) {
                case "CHARGINGNEXTPLAFOND":
                    //console.log("CHARGINGNEXTPLAFOND");
                    // This extra SessionTaken logic was changed, temporarily until the rework of plafonds to allow the user to charge sessions that are already runing even if gets to the amount the wallet
                    // so we will not allow to start of new sessions if the user doens't have the minimumChargingValue on the plafond
                    /*if (!plafond.extraSessionTaken) {
                        Plafond.findOneAndUpdate({ _id: plafond._id }, { extraSessionTaken: true }, (err, plafondUpdated) => {
                            if (err) {
                                console.error(`[${context}][Plafond.findOneAndUpdate] Error `, err.message);
                                reject(err);
                            } else {
                                resolve(plafond._id);
                                return;
                            };
                        });
                        break;
                    }

                    res.status(400).send(messageResponse);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                    return res;
                    break;
                    */
                    return plafond._id
                default:

                    res.status(400).send(messageResponse);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
                    return res;
            }
        }
    } catch (error) {
        Sentry.captureException(error);

        console.error(`[${context}] Error: ${error.message}`);
        const messageResponse = {
            message: error.message,
            userIdWillPay,
            userIdToBilling,
        };

        res.status(500).send(messageResponse);
        RequestHistoryLogs.saveRequestHistoryLogs(req, res, messageResponse);
        return res;
    }
}

async function getRecurringProcessingModel(userId, paymentMethodId) {
    const context = "Function getRecurringProcessingModel"
    try {
        const found = await UserPaymentConfiguration.findOne({ userId, paymentMethodId }).lean()
        if (found) {
            return found.recurringProcessingModel
        } else {
            const foundUser = await UserPaymentConfiguration.findOne({ userId }).lean()
            return foundUser ? foundUser.recurringProcessingModel : process.env.RecurringProcessingModelUnscheduledCardOnFile
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return process.env.RecurringProcessingModelUnscheduledCardOnFile
    }
}

async function forceResponseCode(userId, body) {
    const context = "Function forceResponseCode"
    try {
        const found = await UserPaymentConfiguration.findOne({ userId, paymentMethodId: body.paymentMethod.storedPaymentMethodId })
        if (found && found.tester && (found.testResponseCode !== null && found.testResponseCode !== undefined)) {
            body.additionalData = {
                RequestedTestAcquirerResponseCode: found.testResponseCode
            }
        } else {
            const foundUser = await UserPaymentConfiguration.findOne({ userId }).lean()
            if (foundUser && foundUser.tester && (foundUser.testResponseCode !== null && foundUser.testResponseCode !== undefined)) {
                body.additionalData = {
                    RequestedTestAcquirerResponseCode: foundUser.testResponseCode
                }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function needsThreeDSAuthentication(paymentMethodId, refusalReasonCode) {
    const context = "Function needsThreeDSAuthentication"
    try {

        if (['11', '38', '42'].includes(refusalReasonCode)) {
            const found = await PaymentMethod.findOneAndUpdate({ paymentMethodId, needsThreeDSAuthentication: false }, { $set: { needsThreeDSAuthentication: true } }, { new: true }).lean()
            if (found) {
                //TODO Send email or notification to user to warn about the need to authenticate the card through 3DS
                let foundUserPaymentConfig = await UserPaymentConfiguration.findOne({ userId: found.userId, paymentMethodId }).lean()
                if (foundUserPaymentConfig) {
                    if (foundUserPaymentConfig.sendEmail) {
                        const userInfo = await getUser(found.userId)
                        sendEmailToUser(userInfo, 'threeDSAuthentication', { username: userInfo.name }, found.clientName)
                    }
                } else {
                    foundUserPaymentConfig = await UserPaymentConfiguration.findOne({ userId: found.userId }).lean()
                    if (foundUserPaymentConfig) {
                        if (foundUserPaymentConfig.sendEmail) {
                            const userInfo = await getUser(found.userId)
                            sendEmailToUser(userInfo, 'threeDSAuthentication', { username: userInfo.name }, found.clientName)
                        }
                    }
                }
                return true
            }
        }
        return false
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}

async function sendEmailToUser(user, action, message, clientName) {
    const context = "Function sendEmailToUser";
    try {
        const host = process.env.NotificationsHost + process.env.PathSendEmail;
        const mailOptions = {
            to: user.email,
            message,
            type: action,
            mailLanguage: user.language,
        };

        const headers = {
            clientname: clientName
        }
        await axios.post(host, { mailOptions }, { headers })
        console.log("sending email")
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
};

async function findOnePreAuthorize(query) {
    const context = "Function findPreAuthorize";
    try {
        return await PreAuthorize.findOne(query).lean()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function createTransactionEntry(userId, transactionType, status, provider, currency, value, clientName) {
    const context = "Function createTransactionEntry";
    try {
        const newTransaction = new Transactions(
            {
                userId: userId,
                transactionType: transactionType,
                status: status,
                provider: provider,
                amount: {
                    currency: currency,
                    value: value
                },
                clientName
            }
        );
        return await createNewTransactions(newTransaction);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    };
}

async function createAdyenPreAuthBody(adyenMerchantAccountName, transactionId, userId, currency, value, paymentMethodId) {
    const context = "Function createAdyenPreAuthBody";
    try {
        let body = {
            merchantAccount: adyenMerchantAccountName,
            reference: transactionId,
            amount: {
                currency: currency,
                value: value
            },
            paymentMethod: {
                type: "scheme",
                storedPaymentMethodId: paymentMethodId,
                encryptedCardNumber: "",
                encryptedExpiryYear: "",
                encryptedSecurityCode: "",
                holderName: "",
                encryptedExpiryMonth: ""
            },
            shopperReference: userId,
            shopperInteraction: process.env.ShopperInteractionContAuth,
            recurringProcessingModel: await getRecurringProcessingModel(userId),
            additionalData: {
                authorisationType: process.env.AdyenAuthorisationTypePreAuth
            }
        }
        body.amount.value *= 100;
        body.amount.value = Math.abs(body.amount.value);

        return body
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    };
}

async function createPreAuthorize(preAuthorizeBody) {
    const context = "Function createPreAuthorize";
    try {
        const preAuthObject = new PreAuthorize(preAuthorizeBody)
        return await preAuthObject.save()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function createPreAuthorizeEntry(reference, currency, value, paymentMethodId, adyenReference, userId, success, active, clientName, authorizeDate = undefined) {
    const context = "Function createPreAuthorizeEntry";
    try {
        const body = {
            reference,
            amount: {
                currency,
                value,
            },
            paymentMethodId,
            adyenReference,
            userId,
            success,
            active,
            authorizeDate,
            clientName,
        }
        await createPreAuthorize(body)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function adjustPreAuthorize(body, adyenModificationObj) {
    const context = "Funciton walletFindOne";
    try {
        body.modificationAmount.value = Math.abs(body.modificationAmount.value);
        const result = await adyenModificationObj.adjustAuthorisation(body)
        return result.response === '[adjustAuthorisation-received]'
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    };
};

async function editPreAuthorize(data) {
    const context = "Function editPreAuthorize";
    try {
        if (data._id || data.reference) {
            const query = {
                $and: [
                    data._id ? { _id: data._id } : {},
                    data.reference ? { reference: data.reference } : {},
                ]
            }
            delete data._id
            delete data.reference
            return await PreAuthorize.findOneAndUpdate(query, { $set: data }, { new: true }).lean()
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function adjustExistingPreAuthorize(originalReference, currency, value, reference, merchantAccount, adyenModificationObj) {
    const context = "Function adjustExistingPreAuthorize";
    try {
        const body = {
            originalReference,
            modificationAmount: {
                currency,
                value,
            },
            additionalData: {
                industryUsage: "DelayedCharge",
                encryptedCardNumber: "",
                encryptedExpiryYear: "",
                encryptedSecurityCode: "",
                holderName: "",
                encryptedExpiryMonth: ""
            },
            reference,
            merchantAccount,

        }
        return await adjustPreAuthorize(body, adyenModificationObj)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    };
}



module.exports = router;
