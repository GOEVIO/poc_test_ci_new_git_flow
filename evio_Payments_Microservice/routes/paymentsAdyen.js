require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const preAuthorizations = require("../models/preauthorization");
const Payments = require('../models/payments');
const RequestHistoryLogs = require('../models/requestHistoryLogs');
const UUID = require('uuid-js');
const { Client, Config, CheckoutAPI, Modification, Recurring, ClassicIntegrationAPI } = require('@adyen/api-library');
const Transactions = require('../models/transactions');
const Configs = require('../models/configs');
const Wallet = require('../models/wallet');
const PaymentMethod = require('../models/paymentMethod');
const axios = require("axios");
const basicAuth = require('express-basic-auth');
const NotificationsPayments = require('../models/notificationsPayments');
const ObjectId = require('mongoose').Types.ObjectId;
const Invoices = require('../handlers/invoices');
const { SessionsRepository } = require('evio-library-ocpi')
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
const ExternalRequestHandlers = require("../handlers/externalRequest");
const RefusalReasonCode = require('../models/refusalReasonCode');
const UserPaymentConfiguration = require('../models/userPaymentConfigurations')

// Service 
const paymentMethodService = require('../services/paymentMethods');
const { captureException } = require("@sentry/node");

// Services
const { createCachePaymentMethodByUser, getCachePaymentMethodByUser, deleteCachedPaymentMethodsByUserId } = require('../services/paymentMethods');

const { minimumValueToAddCard, verifyIfUserCanAddCard } = require('../common/preauthorization.common');
const  FeatureFlagGuard  = require('../guard/feature.flag.guard');

const paymentsService = require('./payments')

const Constants = require('../utils/constants')
const { Enums } = require('evio-library-commons').default;


//EVIO
var config = new Config();
var client;
var hostAdyen;
var adyenMerchantAccount;

//Salvador Caetano
var configSC = new Config();
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

        console.log("Initing DEV environment")

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
const recurring = new Recurring(client);

//Salvador Caetano
const checkoutSC = new CheckoutAPI(clientSC);
// const modificationSC = new Modification(clientSC);
const modificationSC = new ClassicIntegrationAPI(clientSC);
const recurringSC = new Recurring(clientSC);


//Notification webhooks
//POST - to receive important updates related to your account
router.post('/api/adyen/notificationWebhooks',
    basicAuth({
        users: { 'adyen': process.env.BASIC_AUTH_PASSWORD },
        unauthorizedResponse: getUnauthorizedResponse
    }),
    async (req, res) => {
        var context = "POST /api/adyen/notificationWebhooks";
        try {
            var body = req.body;

            console.log(`[${context}] Notification by Adyen`, body)

            if (body) {
                var notification = body;
                notification.value = notification.value / 100;
                notification.amount = {
                    value: notification.value,
                    currency: notification.currency
                };


                if (notification['additionalData.authCode'] && notification['additionalData.expiryDate'] && notification['additionalData.cardSummary']) {

                    notification.additionalData = {
                        authCode: notification['additionalData.authCode'],
                        expiryDate: notification['additionalData.expiryDate'],
                        cardSummary: notification['additionalData.cardSummary']
                    };

                    delete notification['additionalData.authCode'];
                    delete notification['additionalData.expiryDate'];
                    delete notification['additionalData.cardSummary'];

                } else if (notification['additionalData.authCode'] && notification['additionalData.expiryDate']) {

                    notification.additionalData = {
                        authCode: notification['additionalData.authCode'],
                        expiryDate: notification['additionalData.expiryDate']

                    };

                    delete notification['additionalData.authCode'];
                    delete notification['additionalData.expiryDate'];

                } else if (notification['additionalData.expiryDate'] && notification['additionalData.cardSummary']) {

                    notification.additionalData = {
                        expiryDate: notification['additionalData.expiryDate'],
                        cardSummary: notification['additionalData.cardSummary']
                    };
                    delete notification['additionalData.expiryDate'];
                    delete notification['additionalData.cardSummary'];

                } else if (notification['additionalData.authCode'] && notification['additionalData.cardSummary']) {

                    notification.additionalData = {
                        authCode: notification['additionalData.authCode'],
                        cardSummary: notification['additionalData.cardSummary']
                    };

                    delete notification['additionalData.authCode'];
                    delete notification['additionalData.cardSummary'];

                } else if (notification['additionalData.authCode']) {

                    notification.additionalData = {
                        authCode: notification['additionalData.authCode']
                    };

                    delete notification['additionalData.authCode']

                } else if (notification['additionalData.expiryDate']) {

                    notification.additionalData = {

                        expiryDate: notification['additionalData.expiryDate']
                    };
                    delete notification['additionalData.expiryDate'];

                } else if (notification['additionalData.cardSummary']) {

                    notification.additionalData = {
                        cardSummary: notification['additionalData.cardSummary']
                    };

                    delete notification['additionalData.cardSummary'];

                };

                console.log(`[${context}] Notification:`, JSON.stringify(notification));

                if (ObjectId.isValid(notification.merchantReference)) {
                    let queryTransaction
                    if (notification.eventCode === "CANCELLATION") {
                        queryTransaction = {
                            _id: notification.merchantReference.reference
                        };
                    } else {
                        queryTransaction = {
                            _id: notification.merchantReference
                        };
                    };

                    console.log("queryTransaction", JSON.stringify(queryTransaction));
                    Transactions.findOne(queryTransaction, (err, transactionFound) => {

                        if (err) {

                            console.error("Failed", err.message);
                            res.status(202).send("[accepted]");
                            saveRequestHistoryLogs(req, res, err);
                            return res;

                        } else {

                            if (transactionFound) {

                                console.log("transactionFound", JSON.stringify(transactionFound))
                                switch (transactionFound.transactionType) {
                                    case process.env.TransactionTypeAddCard:

                                        //validateNotificationsCard(transactionFound)
                                        res.status(202).send("[accepted]");
                                        saveRequestHistoryLogs(req, res, 'Card Added');
                                        return res;

                                    case process.env.TransactionTypeEditCard:
                                        res.status(202).send("[accepted]");
                                        saveRequestHistoryLogs(req, res, 'Edit Card');
                                        return res;

                                    case process.env.TransactionTypeCredit:
                                        notificationTransaction(notification, transactionFound)
                                            .then((result) => {

                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, result);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][notificationTransaction] Error `, error.message);
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });
                                        break;
                                    case process.env.TransactionTypeDebit:
                                        notificationPayments(notification)
                                            .then((result) => {

                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, result);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][notificationPayments] Error `, error.message);
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });
                                        break;
                                    case process.env.TransactionTypePreAuthorize:
                                        notificationPreAuthorize(notification)
                                            .then((result) => {
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, result);
                                                return res;
                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][notificationPreAuthorize] Error `, error.message);
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });

                                        break;
                                    case process.env.TransactionTypeRefund:
                                        notificationPreAuthorize(notification)
                                            .then((result) => {
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, 'Failed');
                                                return res;
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][notificationRefund] Error `, error.message);
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;
                                            });
                                        
                                        break;
                                    case process.env.TransactionTypeValidate:
                                        console.error("Failed");
                                        res.status(202).send("[accepted]");
                                        saveRequestHistoryLogs(req, res, 'Failed');
                                        return res;
                                    case process.env.TransactionType2ndWayPhysicalCard:
                                        notificationPayments2ndWayPhysicalCard(notification)
                                            .then((result) => {

                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, result);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][notificationPayments2ndWayPhysicalCard] Error `, error.message);
                                                res.status(202).send("[accepted]");
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });
                                        break;
                                    default:

                                        console.error("Failed");
                                        res.status(202).send("[accepted]");
                                        saveRequestHistoryLogs(req, res, 'Failed');
                                        return res;

                                };

                            } else {

                                console.error("Failed");
                                res.status(202).send("[accepted]");
                                saveRequestHistoryLogs(req, res, 'Failed');
                                return res;
                            };
                        };
                    });

                } else if (notification.eventCode === "REFUND") {
                    console.log(`[${context}] Handling REFUND by originalReference:${notification.originalReference}`);
                    try {
                        const foundTransaction = await Transactions.findOne({
                            "dataReceived.pspReference": notification.originalReference,
                            provider: 'Card'
                        });

                        if (foundTransaction) {
                            console.log(`[${context}] Found payment to refund:`, foundTransaction._id);

                            const existingRefund = await Transactions.findOne({
                                transactionType: process.env.TransactionTypeRefund,
                                sessionId: foundTransaction.sessionId
                            });

                            if (existingRefund) {
                                console.warn(`[${context}] Refund already exists for transaction: ${foundTransaction._id}`);
                                res.status(202).send("[accepted]");
                                return res;
                            }
                            
                            removeInvalidKeysFromNotification(notification);

                            const refundTransaction = await createRefundTransaction(foundTransaction, notification);

                            const foundPayment = await Payments.findOne({
                                _id: foundTransaction.paymentId
                            });

                            if (foundPayment) {
                                console.log(`[${context}] Found payment to copy for refund:`, foundPayment._id);

                                await createRefundPayment(foundPayment, notification, refundTransaction._id);
                                console.log(`[${context}] Refund recorded successfully`);

                                res.status(202).send("[accepted]");
                                return res;
                            } else {
                                console.error(`[${context}] No payment found for refund`);
                                captureException(error);
                                res.status(202).send("[accepted]");
                                return res;
                            }
                        } else {
                            console.error(`[${context}] No transaction found by pspReference`);
                            captureException(error);
                            res.status(202).send("[accepted]");
                            return res;
                        }
                    } catch (err) {
                        console.error(`[${context}] Error finding or saving transaction by pspReference`, err.message);
                        res.status(202).send("[accepted]");
                        saveRequestHistoryLogs(req, res, err);
                        return res;
                    }
                } else if(notification.eventCode === 'CAPTURE') {
                    console.log(`[${context}] Handling CAPTURE by originalReference:${notification.originalReference}`);
                    await Transactions.updateOne(
                        { 'dataReceived.pspReference': notification.pspReference, status: process.env.TransactionStatusInPayment },
                        {
                            $set: {
                                status: notification.success === 'true' ? process.env.TransactionStatusPaidOut : process.env.TransactionStatusFaild,
                            }
                        }
                    )
                    Payments.updatePayments(
                        { adyenReference: notification.originalReference, paymentAdyenId: notification.pspReference, status: process.env.PaymentStatusInPayment },
                        {
                            status: notification.success === 'true' ? process.env.PaymentStatusPaidOut : process.env.PaymentStatusFaild,
                            amount: notification.amount,
                            reservedAmount: notification.amount.value,
                            'dataReceived.captureNotification': notification,
                            ...(notification.reason && { reason: notification.reason }),
                        },
                        (err, result) => { 
                            if (err) {
                                console.error(`[${context}] Error updating payment:`, err);
                                captureException(err);
                                return;
                            }
                            if(!result) {
                                console.log(`[${context}] No payment updated:`, result);
                                return;
                            }
                            const sessionUpdated = SessionsRepository.updateSessionPaymentInfo(result);
                            if (!sessionUpdated) {
                                console.log(`[${context}] Session not updated with payment data payment:`, result);
                            }
                        }
                    )

                    if (notification.success !== 'true') { 
                        await preAuthorizations.updatePreAuthorization(
                            { adyenReference: notification.originalReference },
                            { $set: { active: true, 'paymentData.success': false, 'transactionData.success': false } }
                        );
                    }

                    res.status(202).send("[accepted]");
                    saveRequestHistoryLogs(req, res, notification.success === 'true' ? 'Capture successful' : 'Capture failed');
                    return res;
                } else {
                    console.warn(`[${context}] EventCode:${notification.eventCode}`);
                    res.status(202).send("[accepted]");
                    saveRequestHistoryLogs(req, res, 'Failed');
                    return res;

                };

            } else {

                console.error("Failed");
                res.status(202).send("[accepted]");
                saveRequestHistoryLogs(req, res, 'Failed');
                return res;

            };

        } catch (error) {

            console.error(`[${context}] Error `, error);
            captureException(error);
            res.status(202).send("[accepted]");
            saveRequestHistoryLogs(req, res, error);
            return res;

        };
});

//Post to create a card on payment method
router.post('/api/private/paymentsAdyen/addCard', (req, res, next) => {
    const context = "POST /api/private/paymentsAdyen/addCard";
    try {

        let userId = req.headers['userid'];
        let clientName = req.headers['clientname']
        let received = req.body;
        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

        validateFieldsAddCard(received)
            .then(async () => {

                console.log("clientName", clientName);
                let transaction = new Transactions({
                    userId: userId,
                    transactionType: process.env.TransactionTypeAddCard,
                    status: process.env.TransactionStatusPaidOut,
                    provider: process.env.PaymentMethodCard,
                    clientName: clientName,
                    amount: {
                        value: await minimumValueToAddCard(clientName),
                        currency: "EUR"
                    }
                });

                let transactionCreated = await createTransactions(transaction);

                //Use in test
                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                    //body.merchantAccount = adyenMerchantAccountSC;
                    let body = {

                        paymentMethod: received.paymentMethod,
                        shopperReference: userId,
                        shopperInteraction: process.env.ShopperInteractionEcommerce,
                        recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId),
                        storePaymentMethod: process.env.StorePaymentMethod,
                        amount: {
                            value: await minimumValueToAddCard(clientName)*100,
                            currency: "EUR"
                        },
                        reference: transactionCreated._id.toString(),
                        merchantAccount: adyenMerchantAccountSC,
                        // captureDelayHours: 1

                    };

                    if (received.additionalData != undefined) {
                        body.additionalData = received.additionalData;
                    };
                    await forceResponseCode(userId, body)


                    //console.log("body 1", body);
                    //TODO
                    checkoutSC.payments(body)
                        //checkout.payments(body)
                        .then(async (result) => {

                            //console.log("result 1", result);

                            switch (result.resultCode) {

                                case 'Authorised':
                                    if (result.additionalData != undefined) {

                                        var response = {

                                            amount: result.amount,
                                            merchantReference: result.merchantReference,
                                            pspReference: result.pspReference,
                                            resultCode: result.resultCode,
                                            additionalData: {
                                                recurringProcessingModel: result.additionalData.recurringProcessingModel,
                                                recurring: {
                                                    shopperReference: result.additionalData['recurring.shopperReference'],
                                                    recurringDetailReference: result.additionalData['recurring.recurringDetailReference'] ?? result.pspReference
                                                }
                                            }
                                        };
                                    }
                                    else {

                                        var response = {

                                            amount: result.amount,
                                            merchantReference: result.merchantReference,
                                            pspReference: result.pspReference,
                                            resultCode: result.resultCode
                                        };
                                    };

                                    try {
                                        let modificationsResponse = await modificationSC.cancel({
                                            merchantAccount: adyenMerchantAccountSC,
                                            originalReference: result.pspReference,
                                            reference: {
                                                typeOfReference: process.env.ReferenceAdyenAddCard,
                                                reference: transactionCreated._id.toString()
                                            }
                                        });
                                        response.amount.value = Math.abs(response.amount.value);

                                        var newValues = {
                                            $set: {
                                                amount: response.amount,
                                                adyenReference: response.additionalData.recurring.recurringDetailReference,
                                                dataReceived: modificationsResponse
                                            }
                                        };

                                    } catch (error) {
                                        console.error(`[${context}] Error `, error.message);
                                    };

                                    //console.log("response ", response);
                                    //console.log("result ", result);

                                    createNewPaymentMethod(response, userId, 'addCard', clientName).
                                        then((values) => {

                                            let body = {

                                                merchantAccount: adyenMerchantAccountSC,
                                                shopperReference: userId

                                            };

                                            checkoutSC.paymentMethods(body)
                                                //checkout.paymentMethods(body)
                                                .then(async (paymentsResponse) => {

                                                    //console.log("paymentsResponse", paymentsResponse.storedPaymentMethods);

                                                    if (values) {
                                                        if (paymentsResponse.storedPaymentMethods && paymentsResponse.storedPaymentMethods.length > 0) {

                                                            validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                                .then(async (paymentMethods) => {

                                                                    let query = {
                                                                        _id: transactionCreated._id.toString()
                                                                    };

                                                                    let transactionUpdated = await transactionsUpdate(query, newValues);


                                                                    paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                                                    res.status(200).send(paymentMethods);
                                                                    saveRequestHistoryLogs(req, res, response);
                                                                    return res;

                                                                })
                                                                .catch((error) => {

                                                                    console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                                    captureException(error);
                                                                    res.status(500).send(error.message);
                                                                    saveRequestHistoryLogs(req, res, error);
                                                                    return res;

                                                                });

                                                        } else {
                                                            res.status(200).send([]);
                                                            saveRequestHistoryLogs(req, res, response);
                                                            return res;
                                                        };

                                                    } else {
                                                        var message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
                                                        res.status(400).send(message);
                                                        saveRequestHistoryLogs(req, res, message);
                                                        return res;
                                                    };

                                                })
                                                .catch((error) => {

                                                    console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                                                    captureException(error);
                                                    res.status(500).send(error.message);
                                                    saveRequestHistoryLogs(req, res, error);
                                                    return res;

                                                });
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            captureException(error);
                                            res.status(500).send(error.message);
                                            saveRequestHistoryLogs(req, res, error);
                                            return res;
                                        });

                                    break;

                                case 'Refused':

                                    //console.error(`[${context}][checkoutSC.payments] Error `, result);
                                    var message = { auth: false, code: 'serve_payment_refused', message: result.refusalReason }
                                    res.status(400).send(message);
                                    saveRequestHistoryLogs(req, res, message);
                                    return res;


                                case 'Cancelled':

                                    var message = { auth: false, code: 'serve_payment_fraud_cancelled', message: "FRAUD-CANCELLED" }
                                    res.status(400).send(message);
                                    saveRequestHistoryLogs(req, res, message);
                                    return res;


                                default:

                                    /*
                                    //console.error(`[${context}][checkoutSC.payments] Error `, result);
                                    var message = { auth: false, code: 'serve_paymentMethod_already_exists', message: "Payment method already exists" }
                                    res.status(400).send(message);
                                    saveRequestHistoryLogs(req, res, message);
                                    return res;
                                    */
                                    console.error(`[${context}][checkoutSC.payments] Error `, result);
                                    captureException(result);
                                    res.status(500).send(result);
                                    saveRequestHistoryLogs(req, res, result);
                                    return res;


                            };

                        })
                        .catch((error) => {

                            if (error.statusCode == 400) {

                                console.error(`[${context}][checkoutSC.payments][400] Error `, error.message);
                                res.status(400).send(error);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            }
                            else if (error.statusCode == 500 && error.message.includes('Payment details are not supported')) {

                                var message = { auth: false, code: 'server_paymentDetails_not_supported', message: 'Payment details are not supported' };
                                res.status(400).send(message);
                                saveRequestHistoryLogs(req, res, message);
                                return res;

                            }
                            else {

                                console.error(`[${context}][checkoutSC.payments][1][500] Error `, error.message);
                                captureException(error);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            };

                        });

                } else {

                    let body = {

                        paymentMethod: received.paymentMethod,
                        shopperReference: userId,
                        shopperInteraction: process.env.ShopperInteractionEcommerce,
                        recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId),
                        storePaymentMethod: process.env.StorePaymentMethod,
                        amount: {
                            value: await minimumValueToAddCard(clientName)*100,
                            currency: "EUR"
                        },
                        reference: transactionCreated._id.toString(),
                        merchantAccount: adyenMerchantAccount

                    };

                    if (received.additionalData != undefined) {
                        body.additionalData = received.additionalData;
                    };
                    await forceResponseCode(userId, body)

                    checkout.payments(body)
                        .then(async (result) => {

                            //console.log("result", result);

                            switch (result.resultCode) {

                                case 'Authorised':
                                    if (result.additionalData != undefined) {

                                        var response = {

                                            amount: result.amount,
                                            merchantReference: result.merchantReference,
                                            pspReference: result.pspReference,
                                            resultCode: result.resultCode,
                                            additionalData: {
                                                recurringProcessingModel: result.additionalData.recurringProcessingModel,
                                                recurring: {
                                                    shopperReference: result.additionalData['recurring.shopperReference'],
                                                    recurringDetailReference: result.additionalData['recurring.recurringDetailReference'] ?? result.pspReference
                                                }
                                            }
                                        };
                                    }
                                    else {

                                        var response = {

                                            amount: result.amount,
                                            merchantReference: result.merchantReference,
                                            pspReference: result.pspReference,
                                            resultCode: result.resultCode
                                        };
                                    };

                                    //console.log("response ", response);
                                    //console.log("result ", result);


                                    try {
                                        let modificationsResponse = await modification.cancel({
                                            merchantAccount: adyenMerchantAccount,
                                            originalReference: result.pspReference,
                                            reference: {
                                                typeOfReference: process.env.ReferenceAdyenAddCard,
                                                reference: transactionCreated._id.toString()
                                            }
                                        });
                                        response.amount.value = Math.abs(response.amount.value);

                                        var newValues = {
                                            $set: {
                                                amount: response.amount,
                                                adyenReference: response.additionalData.recurring.recurringDetailReference,
                                                dataReceived: modificationsResponse
                                            }
                                        };

                                    } catch (error) {
                                        console.error(`[${context}] Error `, error.message);
                                        captureException(error);
                                    };

                                    createNewPaymentMethod(response, userId, 'addCard', clientName).
                                        then((values) => {

                                            let body = {

                                                merchantAccount: adyenMerchantAccount,
                                                shopperReference: userId

                                            };

                                            checkout.paymentMethods(body)
                                                .then(async (paymentsResponse) => {
                                                    // console.log("paymentsResponse" , JSON.stringify(paymentsResponse))
                                                    if (values) {
                                                        if (paymentsResponse.storedPaymentMethods != undefined) {

                                                            //console.log("paymentsResponse", paymentsResponse);

                                                            validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                                .then(async (paymentMethods) => {

                                                                    let query = {
                                                                        _id: transactionCreated._id.toString()
                                                                    };
                                                                    var data = {

                                                                        merchantAccount: adyenMerchantAccount,
                                                                        originalReference: result.pspReference,
                                                                        reference: {

                                                                            typeOfReference: process.env.ReferenceAdyenAddCard,
                                                                            reference: transactionCreated._id.toString()

                                                                        }

                                                                    };

                                                                    /* try {

                                                                        let modificationsResponse = await modification.cancel(data);

                                                                        response.amount.value = Math.abs(response.amount.value);

                                                                        var newValues = {
                                                                            $set: {
                                                                                amount: response.amount,
                                                                                adyenReference: response.additionalData.recurring.recurringDetailReference,
                                                                                //status: process.env.TransactionStatusCanceled,
                                                                                dataReceived: modificationsResponse
                                                                            }
                                                                        };
                                                                        //let result = await transactionsUpdate(query, newValues)

                                                                    } catch (error) {

                                                                        console.error(`[${context}] Error `, error.message);

                                                                    }; */


                                                                    /*
                                                                    let newValues = {
                                                                        $set: {
                                                                            amount: response.amount,
                                                                            adyenReference: response.additionalData.recurring.recurringDetailReference
                                                                        }
                                                                    };*/

                                                                    let transactionUpdated = await transactionsUpdate(query, newValues);


                                                                    paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                                                    res.status(200).send(paymentMethods);
                                                                    saveRequestHistoryLogs(req, res, response);
                                                                    return res;

                                                                })
                                                                .catch((error) => {

                                                                    console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                                    captureException(error);
                                                                    res.status(500).send(error.message);
                                                                    saveRequestHistoryLogs(req, res, error);
                                                                    return res;

                                                                });


                                                        }

                                                        else {
                                                            res.status(200).send([]);
                                                            saveRequestHistoryLogs(req, res, response);
                                                            return res;
                                                        };
                                                    }
                                                    else {
                                                        var message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
                                                        res.status(400).send(message);
                                                        saveRequestHistoryLogs(req, res, message);
                                                        return res;
                                                    };

                                                })
                                                .catch((error) => {

                                                    console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                                                    captureException(error);
                                                    res.status(500).send(error.message);
                                                    saveRequestHistoryLogs(req, res, error);
                                                    return res;

                                                });
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            captureException(error);
                                            res.status(500).send(error.message);
                                            saveRequestHistoryLogs(req, res, error);
                                            return res;
                                        });


                                    break;

                                case 'Refused':

                                    //console.error(`[${context}][checkout.payments] Error `, result);
                                    var message = { auth: false, code: 'serve_payment_refused', message: result.refusalReason }
                                    res.status(400).send(message);
                                    saveRequestHistoryLogs(req, res, message);
                                    return res;


                                case 'Cancelled':

                                    var message = { auth: false, code: 'serve_payment_fraud_cancelled', message: "FRAUD-CANCELLED" }
                                    res.status(400).send(message);
                                    saveRequestHistoryLogs(req, res, message);
                                    return res;


                                default:
                                    console.error(`[${context}][checkout.payments] Error `, result);
                                    captureException(error);
                                    res.status(500).send(result);
                                    saveRequestHistoryLogs(req, res, result);
                                    return res;


                            };

                        })
                        .catch((error) => {

                            if (error.statusCode == 400) {

                                console.error(`[${context}][checkout.payments][400] Error `, error.message);
                                res.status(400).send(error);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            }
                            else if (error.statusCode == 500 && error.message.includes('Payment details are not supported')) {

                                var message = { auth: false, code: 'server_paymentDetails_not_supported', message: 'Payment details are not supported' };
                                res.status(400).send(message);
                                saveRequestHistoryLogs(req, res, message);
                                return res;

                            }
                            else {

                                console.error(`[${context}][checkout.payments][500] Error `, error.message);
                                captureException(error);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            };

                        });

                };

            })
            .catch((error) => {

                res.status(400).send(error);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        captureException(error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Post to add balance to the wallet with credit card
router.post('/api/private/paymentsAdyen/addBalanceCard', (req, res, next) => {
    const context = "POST /api/private/paymentsAdyen/addBalanceCard";
    try {

        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        let received = req.body;

        if (!userId) {

            let message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        validateFieldsAddBalance(received)
            .then(() => {

                let transaction = new Transactions({
                    userId: userId,
                    amount: received.amount,
                    provider: process.env.TransactionProviderCreditCard,
                    transactionType: process.env.TransactionTypeCredit,
                    status: process.env.TransactionStatusSentToGenerate,
                    clientName: clientName
                });

                let storedPaymentMethodId = received.paymentMethod.storedPaymentMethodId;

                received.amount.value *= 100;
                received.amount.value = Math.abs(received.amount.value);

                Transactions.createTransactions(transaction, async (err, transactionCreated) => {
                    if (err) {

                        console.error(`[${context}][createTransactions] Error `, err.message);
                        captureException(error);
                        res.status(500).send(err);
                        saveRequestHistoryLogs(req, res, err);
                        return res;
                    };

                    addTransactionToWallet(transactionCreated)
                        .then(async (result) => {

                            if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                                let body = {
                                    merchantAccount: adyenMerchantAccountSC,
                                    reference: transactionCreated._id,
                                    amount: received.amount,
                                    paymentMethod: received.paymentMethod
                                };

                                //Use in test
                                if (received.additionalData != undefined) {
                                    body.additionalData = received.additionalData;
                                };

                                if (received.paymentMethod.storedPaymentMethodId != undefined && received.paymentMethod.storedPaymentMethodId != '') {

                                    body.shopperReference = userId;
                                    body.shopperInteraction = process.env.ShopperInteractionContAuth;
                                    body.recurringProcessingModel = await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId);
                                    
                                    const defaultPaymentId = paymentMethodService.getDefaultPaymentMethod(userId);
                                    if(defaultPaymentId?.paymentMethodId) body.paymentMethod.storedPaymentMethodId = defaultPaymentId.paymentMethodId;
                                };
                                await forceResponseCode(userId, body)

                                //body.merchantAccount = adyenMerchantAccountSC
                                console.log("5 body SC - ", body);
                                //TODO
                                checkoutSC.payments(body)
                                    //checkout.payments(body)
                                    .then(async (result) => {

                                        console.log("result from checkoutSC.payments", result);

                                        //console.log("result from checkoutSC.payments", result);

                                        let status;
                                        let resultCode = result.resultCode;

                                        switch (resultCode) {
                                            case 'Error':
                                                status = process.env.TransactionStatusFaild;
                                                break;
                                            case 'Refused':
                                                status = process.env.TransactionStatusFaild;
                                                break;
                                            default:

                                                var data = {
                                                    merchantAccount: adyenMerchantAccountSC,
                                                    originalReference: result.pspReference,
                                                    modificationAmount: result.amount,
                                                    reference: result.merchantReference
                                                };

                                                //TODO
                                                let resultData = await modificationSC.capture(data);
                                                //let resultData = await modification.capture(data);

                                                status = process.env.TransactionStatusInPayment;
                                                result.amount.value /= 100;

                                                break;
                                        };

                                        let query = {
                                            _id: transactionCreated._id
                                        };

                                        let newValues = {
                                            $set: {
                                                status: status,
                                                data: result
                                            }
                                        };

                                        transactionsUpdate(query, newValues)
                                            .then(async (values) => {

                                                //if (result.resultCode === 'Authorised' && (received.paymentMethod.storedPaymentMethodId === undefined || received.paymentMethod.storedPaymentMethodId === "")) {
                                                if (resultCode === 'Authorised' && !storedPaymentMethodId) {

                                                    addCreditCard(userId, received, clientName);

                                                };

                                                let response = await transactionFindOne(query);
                                                updateTransactionToWallet(response);
                                                res.status(200).send(response);
                                                saveRequestHistoryLogs(req, res, response);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                                captureException(error);
                                                res.status(500).send(error.message);
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][1][checkoutSC.payments] Error `, error.message);
                                        captureException(error);
                                        res.status(500).send(error.message);
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;

                                    });

                            } else {

                                let body = {
                                    merchantAccount: adyenMerchantAccount,
                                    reference: transactionCreated._id,
                                    amount: received.amount,
                                    paymentMethod: received.paymentMethod
                                };

                                //Use in test
                                if (received.additionalData != undefined) {
                                    body.additionalData = received.additionalData;
                                };

                                if (received.paymentMethod.storedPaymentMethodId != undefined && received.paymentMethod.storedPaymentMethodId != '') {

                                    body.shopperReference = userId;
                                    body.shopperInteraction = process.env.ShopperInteractionContAuth;
                                    body.recurringProcessingModel = await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId);
                                    
                                    const defaultPaymentId = paymentMethodService.getDefaultPaymentMethod(userId);
                                    if(defaultPaymentId?.paymentMethodId) body.paymentMethod.storedPaymentMethodId = defaultPaymentId.paymentMethodId;

                                };
                                await forceResponseCode(userId, body)

                                console.log("body payments- ", JSON.stringify(body));

                                checkout.payments(body)
                                    .then(async (result) => {

                                        //console.log("result from checkout.payments", result);

                                        let status;
                                        let resultCode = result.resultCode;

                                        switch (resultCode) {
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

                                                //console.log("data to make modification.capture", data);

                                                let resultData = await modification.capture(data);
                                                //console.log("result from modification.capture", resultData);
                                                status = process.env.TransactionStatusInPayment;
                                                result.amount.value /= 100;

                                                break;
                                        };

                                        let query = {
                                            _id: transactionCreated._id
                                        };

                                        let newValues = {
                                            $set: {
                                                status: status,
                                                data: result
                                            }
                                        };

                                        transactionsUpdate(query, newValues)
                                            .then(async (values) => {

                                                //if (result.resultCode === 'Authorised' && (received.paymentMethod.storedPaymentMethodId === undefined || received.paymentMethod.storedPaymentMethodId === "")) {
                                                if (resultCode === 'Authorised' && !storedPaymentMethodId) {

                                                    addCreditCard(userId, received, clientName);
                                                };

                                                let response = await transactionFindOne(query);
                                                updateTransactionToWallet(response);
                                                res.status(200).send(response);
                                                saveRequestHistoryLogs(req, res, response);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                                captureException(error);
                                                res.status(500).send(error.message);
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkout.payments] Error `, error.message);
                                        captureException(error);
                                        res.status(500).send(error.message);
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;

                                    });

                            };
                        })
                        .catch((error) => {

                            console.error(`[${context}][addTransactionToWallet] Error `, error.message);
                            captureException(error);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });


                });
            })
            .catch((error) => {

                res.status(400).send(error);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        captureException(error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Post para reservar valor no cartão
router.post('/api/private/paymentsAdyen/preAuthorisePayment', async (req, res, next) => {
    var context = "POST /api/private/paymentsAdyen/preAuthorisePayment";
    try {

        let received = req.body;
        var clientName = req.headers['clientname'];

        var newTransaction = new Transactions(
            {
                userId: received.userId,
                transactionType: process.env.TransactionTypePreAuthorize,
                status: process.env.TransactionStatusSentToGenerate,
                provider: process.env.TransactionProviderCreditCard,
                amount: received.amount
            }
        );

        let transactionCreated = await createTransactions(newTransaction);
        let transactionId = transactionCreated._id.toString();


        var body = {

            merchantAccount: adyenMerchantAccount,

            reference: transactionId,
            amount: received.amount,
            paymentMethod: received.paymentMethod,
            shopperReference: received.userId,
            shopperInteraction: process.env.ShopperInteractionContAuth,
            recurringProcessingModel: await getRecurringProcessingModel(received.userId, received.paymentMethod.storedPaymentMethodId)/*,
            additionalData: {
                authorisationType: process.env.AdyenAuthorisationTypePreAuth
            }*/
        };

        if (received.paymentMethod?.storedPaymentMethodId != undefined && received.paymentMethod?.storedPaymentMethodId != '') {
            const defaultPaymentId = paymentMethodService.getDefaultPaymentMethod(userId);
            if( defaultPaymentId?.paymentMethodId ) body.paymentMethod.storedPaymentMethodId = defaultPaymentId.paymentMethodId;
        }

        body.amount.value *= 100;
        body.amount.value = Math.abs(body.amount.value);
        await forceResponseCode(received.userId, body)
        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

            body.merchantAccount = adyenMerchantAccountSC
            //TODO
            console.log("6 body SC - ", body);
            checkoutSC.payments(body)
                //checkout.payments(body)
                .then(async (result) => {
                    needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

                    if (result.resultCode === 'Authorised') {

                        let transaction = await transactionsUpdate({ _id: transactionId }, { $set: { adyenReference: result.pspReference } });

                        res.status(200).send({ adyenReference: result.pspReference, transactionId: transactionId });
                        saveRequestHistoryLogs(req, res, result);
                        return res;
                    }
                    else {
                        res.status(400).send(result);
                        saveRequestHistoryLogs(req, res, result);
                        return res;
                    };
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    captureException(error);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;
                });
        } else {
            checkout.payments(body)
                .then(async (result) => {
                    needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)
                    if (result.resultCode === 'Authorised') {

                        let transaction = await transactionsUpdate({ _id: transactionId }, { $set: { adyenReference: result.pspReference } });

                        res.status(200).send({ adyenReference: result.pspReference, transactionId: transactionId });
                        saveRequestHistoryLogs(req, res, result);
                        return res;
                    }
                    else {
                        res.status(400).send(result);
                        saveRequestHistoryLogs(req, res, result);
                        return res;
                    };
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    captureException(error);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;
                });
        }

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        captureException(error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Post para reservar valor no cartão
router.post('/api/private/paymentsAdyen/finalAuthorisePayment', async (req, res, next) => {
    var context = "POST /api/private/paymentsAdyen/finalAuthorisePayment";
    try {

        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];
        var received = req.body;

        if (received.adyenReference === "" || received.adyenReference === undefined) {

            let body = {
                merchantAccount: adyenMerchantAccount,
                reference: received.transactionId,
                amount: received.amount,
                paymentMethod: received.paymentMethod,
                shopperReference: userId,
                shopperInteraction: process.env.ShopperInteractionContAuth,
                recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId)
            };

            if (received.paymentMethod?.storedPaymentMethodId != undefined && received.paymentMethod?.storedPaymentMethodId != '') {
                const defaultPaymentId = paymentMethodService.getDefaultPaymentMethod(userId);
                if( defaultPaymentId?.paymentMethodId ) body.paymentMethod.storedPaymentMethodId = defaultPaymentId.paymentMethodId;
            }
            
            body.amount.value *= 100;
            body.amount.value = Math.abs(body.amount.value);
            await forceResponseCode(userId, body)

            if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                body.merchantAccount = adyenMerchantAccountSC
                //TODO
                console.log("7 body SC - ", body);
                checkoutSC.payments(body)
                    //checkout.payments(body)
                    .then(async (result) => {
                        needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

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


                        var newValues = {
                            $set: {
                                status: status,
                                data: result
                            }
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


                        res.status(200).send(result);
                        saveRequestHistoryLogs(req, res, result);
                        return res;

                    })
                    .catch((error) => {

                        console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                        captureException(error);
                        res.status(500).send(error.message);
                        saveRequestHistoryLogs(req, res, error);
                        return res;

                    });

            } else {
                checkout.payments(body)
                    .then(async (result) => {
                        needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

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


                        var newValues = {
                            $set: {
                                status: status,
                                data: result
                            }
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


                        res.status(200).send(result);
                        saveRequestHistoryLogs(req, res, result);
                        return res;

                    })
                    .catch((error) => {

                        console.error(`[${context}][checkout.payments] Error `, error.message);
                        captureException(error);
                        res.status(500).send(error.message);
                        saveRequestHistoryLogs(req, res, error);
                        return res;

                    });
            };
        } else {
            if (received.amount.value > received.reservedAmount) {

                received.amount.value = Math.abs(received.amount.value);
                //Primeiro fazer ajuste ao valor reservado se valor de pagamento maior que valor reservado
                let modificationAmount = parseFloat((received.amount.value - received.reservedAmount).toFixed(2))
                //console.log("modificationAmount", typeof modificationAmount);
                let body = {

                    originalReference: received.adyenReference,
                    modificationAmount: {
                        currency: "EUR",
                        value: (received.amount.value * 100)
                    },
                    additionalData: {
                        industryUsage: "DelayedCharge"
                    },
                    reference: received.transactionId,
                    merchantAccount: adyenMerchantAccount

                };

                adjustmentPreAuthorize(body, clientName)
                    .then((result) => {
                        if (result) {
                            //Atualizar valor de reservedAmount no charging session, transaction e payment.
                            /*paymentUpdate({ _id: received.paymentId }, { $set: { reservedAmount: received.amount.value } })
                                .then(() => {*/
                            //console.log("received 1", received.amount.value);
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
                            if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                                data.merchantAccount = adyenMerchantAccountSC
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
                                                ransactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: result
                                            }
                                        };

                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                        res.status(200).send(result);
                                        saveRequestHistoryLogs(req, res, result);
                                        return res;

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][modificationSC.capture] Error `, error.message);
                                        captureException(error);
                                        res.status(500).send(error.message);
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;
                                    });
                            } else {
                                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
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
                                                    ransactionType: process.env.TransactionTypeDebit,
                                                    status: process.env.TransactionStatusInPayment,
                                                    data: result
                                                }
                                            };

                                            let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                            let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                            res.status(200).send(result);
                                            saveRequestHistoryLogs(req, res, result);
                                            return res;

                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][modificationSC.capture] Error `, error.message);
                                            captureException(error);
                                            res.status(500).send(error.message);
                                            saveRequestHistoryLogs(req, res, error);
                                            return res;
                                        });
                                } else {
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
                                                    ransactionType: process.env.TransactionTypeDebit,
                                                    status: process.env.TransactionStatusInPayment,
                                                    data: result
                                                }
                                            };

                                            let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                            let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                            res.status(200).send(result);
                                            saveRequestHistoryLogs(req, res, result);
                                            return res;

                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][modification.capture] Error `, error.message);
                                            captureException(error);
                                            res.status(500).send(error.message);
                                            saveRequestHistoryLogs(req, res, error);
                                            return res;
                                        });
                                };
                            };
                            /*})
                            .catch((error) => {

                                console.error(`[${context}][updatereservedAmount] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            });*/


                        }
                        else {
                            let message = { auth: false, code: "server_can't_adjust", message: "Can't adjust value" }
                            res.status(400).send(message);
                            saveRequestHistoryLogs(req, res, message);
                            return res;
                        };
                    })
                    .catch((error) => {

                        console.error(`[${context}][adjustmentPreAuthorize] Error `, error.message);
                        captureException(error);
                        res.status(500).send(error.message);
                        saveRequestHistoryLogs(req, res, error);
                        return res;

                    });

            }
            else {


                var data = {

                    merchantAccount: adyenMerchantAccount,
                    originalReference: received.adyenReference,
                    modificationAmount: received.amount,
                    reference: received.transactionId

                };

                data.modificationAmount.value *= 100;
                data.modificationAmount.value = Math.abs(data.modificationAmount.value);
                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                    data.merchantAccount = adyenMerchantAccountSC

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

                            let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                            let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);


                            res.status(200).send(result);
                            saveRequestHistoryLogs(req, res, result);
                            return res;

                        })
                        .catch((error) => {

                            console.error(`[${context}] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });
                } else {
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
                                    data: result,
                                    amount: {
                                        currency: received.amount.currency,
                                        value: received.amount.value / 100
                                    }
                                }
                            };

                            let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                            let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);


                            res.status(200).send(result);
                            saveRequestHistoryLogs(req, res, result);
                            return res;

                        })
                        .catch((error) => {

                            console.error(`[${context}] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });
                };

            };
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        captureException(error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});


//Post to create a card on payment method
router.post('/api/private/paymentsAdyen/3ds/addCard', async (req, res, next) => {
    const context = "POST /api/private/paymentsAdyen/3ds/addCard";
    let responseObj = { success: true, statusCode: 200, data: {}, logData: {} }
    let userId = req.headers['userid'];
    let clientName = req.headers['clientname']
    let received = req.body;
    let transactionCreated = null;

    console.info(`[${context}] - Logs`, {
        transactionId: null,
        userId: userId,
        step: 'addCard',
        status: 'start',
        message: received,
        timestamp: new Date().toISOString()
    });

    try {
        let validationError = validateFieldsAdd3DSCard(received, req.headers['client'], userId)

        console.info(`[${context}] - Logs`, {
            transactionId: null,
            userId,
            step: 'validateFieldsAdd3DSCard',
            status: 'success',
            timestamp: new Date().toISOString()
        });

        if (!validationError) {
            const forcedThreeDSAuthentication = received.paymentMethod.storedPaymentMethodId !== null && received.paymentMethod.storedPaymentMethodId !== undefined

            let transaction = new Transactions({
                userId: userId,
                transactionType: forcedThreeDSAuthentication ? process.env.TransactionTypeForce3dsAuth : process.env.TransactionTypeAddCard,
                status: process.env.TransactionStatusWaiting3DS,
                provider: process.env.PaymentMethodCard,
                clientName: clientName,
                amount: {
                    value: received.addBalanceToWallet ? received.amount.value.toFixed(2) : await minimumValueToAddCard(clientName),
                    currency: "EUR"
                },
                addBalanceToWallet: received.addBalanceToWallet === true,
                paymentMethodId: received.paymentMethod.storedPaymentMethodId
            });

            transactionCreated = await createTransactions(transaction);
            
            console.info(`[${context}] - Logs`, {
                transactionId: transactionCreated?._id?.toString(),
                userId,
                step: 'createTransactions',
                status: 'success',
                timestamp: new Date().toISOString()
            });

            let { billingAddress, email } = await getBillingAddress(userId)
            let userInfo = await getUser(userId)

            let adyenCheckoutObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? checkoutSC : checkout;
            let adyenModificationObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? modificationSC : modification;
            let adyenMerchantAccountName = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? adyenMerchantAccountSC : adyenMerchantAccount;
            let reference = transactionCreated._id.toString()

            let body = await authenticationOnlyPaymentBody(
                billingAddress,
                email,
                userInfo,
                received,
                transaction.amount.value * 100,
                transaction.amount.currency,
                userId,
                reference,
                adyenMerchantAccountName,
                process.env.attemptAuthenticationAlways,
                true
            );

            await authenticationOnlyPaymentRequest(
                body,
                adyenCheckoutObj,
                adyenMerchantAccountName,
                adyenModificationObj,
                responseObj,
                transactionCreated,
                userId,
                clientName
            );

            console.info(`[${context}] - Logs`, {
                transactionId: transactionCreated?._id?.toString(),
                userId,
                step: 'authenticationOnlyPaymentRequest',
                status: responseObj.success,
                timestamp: new Date().toISOString()
            });

            if (responseObj.statusCode == 200) {
                let newData = {
                    Adyen: responseObj.data,
                    message: {
                        auth: true,
                        code: responseObj.action ? "paymentMethods_3dsAuthenticationSuccess" : "paymentMethods_AuthenticationSuccess",
                        message: "Autenticação 3DSecure bem-sucedida",
                        type: "topmessage"
                    }
                };
                responseObj.data = newData;
                await deleteCachedPaymentMethodsByUserId(userId);
            } else {
                await transactionsUpdate({ _id: transactionCreated._id.toString() }, { $set: { status: process.env.TransactionStatusFaild } });
            }

            res.status(responseObj.statusCode).send(responseObj.data);
            saveRequestHistoryLogs(req, res, responseObj.logData);

            console.info(`[${context}] - Logs`, {
                transactionId: transactionCreated?._id?.toString(),
                userId,
                step: 'addCard',
                status: 'success',
                timestamp: new Date().toISOString()
            });

            return res;
        } else {
            res.status(400).send(validationError);
            saveRequestHistoryLogs(req, res, validationError);

            (transactionCreated && transactionCreated?._id) ?? await transactionsUpdate({ _id: transactionCreated._id.toString() }, { $set: { status: process.env.TransactionStatusFaild } });

            console.info(`[${context}] - Logs`, {
                transactionId: transactionCreated?._id?.toString(),
                userId,
                step: 'addCard',
                status: 'error',
                timestamp: new Date().toISOString()
            });

            return res;
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        console.error(`[${context}] transactionCreated`, transactionCreated)
        if(transactionCreated && transactionCreated?._id){
            await transactionsUpdate({ _id: transactionCreated._id.toString() }, { $set: { status: process.env.TransactionStatusFaild } })
        }
        captureException(error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);

        console.info(`[${context}] - Logs`, {
            transactionId: transactionCreated?._id?.toString(),
            userId,
            step: 'addCard',
            status: 'error',
            message: error,
            timestamp: new Date().toISOString()
        });

        return res;
    };
});

router.post('/api/private/paymentsAdyen/startTestsPayments', async (req, res, next) => {
    const context = "POST /api/private/paymentsAdyen/startTestsPayments";
    try {

        let received = req.body;
        let response = await startTestesAdyen(received.paymentMethodId, received.recurringProcessingModel)
        //console.log("response", response);
        res.status(200).send(response);
        saveRequestHistoryLogs(req, res, response);
        return res;

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.post('/api/private/paymentsAdyen/stopTestsPayments', async (req, res, next) => {
    const context = "POST /api/private/paymentsAdyen/stopTestsPayments";
    try {

        let response = await stopTestesAdyen(req)
        //console.log("response", response);
        res.status(200).send(response);
        saveRequestHistoryLogs(req, res, response);
        return res;

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== GET ==========
//Verify if card valid
router.get('/api/private/paymentsAdyen/validateCard', async (req, res, next) => {
    var context = "GET /api/private/paymentsAdyen/validateCard";
    try {

        var received = req.body;
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

        validateFieldsAddCard(received)
            .then(async () => {
                //Created a new transaction
                var newTransaction = new Transactions(
                    {
                        userId: userId,
                        transactionType: process.env.TransactionTypeValidate,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderCreditCard,
                        amount: {
                            value: 1,
                            currency: "EUR"
                        }

                    }
                );

                var body = {

                    merchantAccount: adyenMerchantAccount,
                    reference: {

                        typeOfReference: process.env.ReferenceAdyenValidate,
                        reference: newTransaction._id.toString()

                    },
                    amount: {
                        value: 1,
                        currency: "EUR"
                    },
                    paymentMethod: received.paymentMethod

                };

                //Use in test
                if (received.additionalData != undefined) {

                    body.additionalData = received.additionalData;

                };
                let transactionCreated = await createTransactions(newTransaction);

                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                    body.merchantAccount = adyenMerchantAccountSC

                    //TODO
                    checkoutSC.payments(body)
                        //checkout.payments(body)
                        .then((result) => {

                            var statusTransaction;
                            var response;
                            switch (result.resultCode) {
                                case 'Authorised':

                                    statusTransaction = process.env.TransactionStatusInPayment;
                                    response = true;
                                    break;

                                default:

                                    statusTransaction = process.env.TransactionStatusFaild;
                                    response = false;
                                    break;
                            };

                            var query = {
                                _id: transactionCreated._id
                            };

                            var newValues = {
                                $set: {
                                    status: statusTransaction,
                                    data: result
                                }
                            };

                            transactionsUpdate(query, newValues)
                                .then(async (value) => {

                                    var data = {

                                        merchantAccount: adyenMerchantAccountSC,
                                        originalReference: result.pspReference,
                                        reference: {

                                            typeOfReference: process.env.ReferenceAdyenValidate,
                                            reference: newTransaction._id.toString()

                                        }

                                    };

                                    try {

                                        //TODO
                                        let modificationsResponse = await modificationSC.cancel(data);
                                        //let modificationsResponse = await modification.cancel(data);

                                        var newValues = {
                                            $set: {
                                                status: process.env.TransactionStatusCanceled,
                                                dataReceived: modificationsResponse
                                            }
                                        };
                                        let result = await transactionsUpdate(query, newValues)

                                    } catch (error) {

                                        console.error(`[${context}] Error `, error.message);

                                    };


                                    res.status(200).send(response);
                                    saveRequestHistoryLogs(req, res, response);
                                    return res;

                                })
                                .catch((error) => {

                                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                    res.status(500).send(error.message);
                                    captureException(error);
                                    saveRequestHistoryLogs(req, res, error);
                                    return res;

                                });

                        })
                        .catch((error) => {

                            console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                            res.status(500).send(error.message);
                            captureException(error);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });
                } else {
                    checkout.payments(body)
                        .then((result) => {

                            var statusTransaction;
                            var response;
                            switch (result.resultCode) {
                                case 'Authorised':

                                    statusTransaction = process.env.TransactionStatusInPayment;
                                    response = true;
                                    break;

                                default:

                                    statusTransaction = process.env.TransactionStatusFaild;
                                    response = false;
                                    break;
                            };

                            var query = {
                                _id: transactionCreated._id
                            };

                            var newValues = {
                                $set: {
                                    status: statusTransaction,
                                    data: result
                                }
                            };

                            transactionsUpdate(query, newValues)
                                .then(async (value) => {

                                    var data = {

                                        merchantAccount: adyenMerchantAccount,
                                        originalReference: result.pspReference,
                                        reference: {

                                            typeOfReference: process.env.ReferenceAdyenValidate,
                                            reference: newTransaction._id.toString()

                                        }

                                    };

                                    try {

                                        let modificationsResponse = await modification.cancel(data);

                                        var newValues = {
                                            $set: {
                                                status: process.env.TransactionStatusCanceled,
                                                dataReceived: modificationsResponse
                                            }
                                        };
                                        let result = await transactionsUpdate(query, newValues)

                                    } catch (error) {

                                        console.error(`[${context}] Error `, error.message);

                                    };


                                    res.status(200).send(response);
                                    saveRequestHistoryLogs(req, res, response);
                                    return res;

                                })
                                .catch((error) => {

                                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                    res.status(500).send(error.message);
                                    saveRequestHistoryLogs(req, res, error);
                                    return res;

                                });

                        })
                        .catch((error) => {

                            console.error(`[${context}][checkout.payments] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });
                };

            })
            .catch((error) => {

                res.status(400).send(error);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        captureException(error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Get paymentMethods by user
router.get('/api/private/paymentsAdyen/paymentMethods', async (req, res, next) => {
    let context = "GET /api/private/paymentsAdyen/paymentMethods";
    try {

        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];

        console.log(`[${context}] called with userId: ${userId} and clientName: ${clientName}`);

        if (!userId) {
            let message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;
        }

        const cachedResult = await getCachePaymentMethodByUser(userId);
        console.log(`[${context}] Cached result: ${cachedResult}`);

        if (cachedResult) {
            console.log(`[${context}] Serving cached content: ${cachedResult}`);
            return res.status(200).send(cachedResult);
        }

        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

            let body = {
                merchantAccount: adyenMerchantAccountSC,
                shopperReference: userId
            };

            checkoutSC.paymentMethods(body)
                .then(async (paymentsResponse) => {

                    //console.log("paymentsResponse", paymentsResponse)
                    if (paymentsResponse.storedPaymentMethods != undefined) {

                        validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                            .then(async (paymentMethods) => {

                                await createCachePaymentMethodByUser(userId, paymentMethods);
                                res.status(200).send(paymentMethods);
                                saveRequestHistoryLogs(req, res, paymentMethods);
                                return res;

                            })
                            .catch((error) => {
                                captureException(error);
                                console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);

                                return res;
                            });


                    } else {
                        await createCachePaymentMethodByUser(userId, []);
                        res.status(200).send([]);
                        saveRequestHistoryLogs(req, res, []);

                        return res;
                    }

                })
                .catch((error) => {
                    captureException(error);
                    console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                    res.status(200).send([]);
                    saveRequestHistoryLogs(req, res, error);

                    return res;
                });

        } else {

            let body = {
                merchantAccount: adyenMerchantAccount,
                shopperReference: userId
            };

            checkout.paymentMethods(body)
                .then(async (paymentsResponse) => {

                    if (paymentsResponse.storedPaymentMethods != undefined) {

                        validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                            .then(async (paymentMethods) => {

                                await createCachePaymentMethodByUser(userId, paymentMethods);

                                res.status(200).send(paymentMethods);
                                saveRequestHistoryLogs(req, res, paymentMethods);
                                return res;

                            })
                            .catch((error) => {
                                captureException(error);
                                console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);

                                return res;
                            });


                    } else {
                        await createCachePaymentMethodByUser(userId, []);
                        res.status(200).send([]);
                        saveRequestHistoryLogs(req, res, []);

                        return res;
                    }

                })
                .catch((error) => {
                    captureException(error);
                    console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                    //res.status(500).send(error.message);
                    res.status(200).send([]);
                    saveRequestHistoryLogs(req, res, error);

                    return res;
                });

        }

    } catch (error) {
        captureException(error);
        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);

        return res;
    }
});

//Validate paymentMethods
router.get('/api/private/paymentsAdyen/validatePaymentMethods', (req, res, next) => {
    var context = "POST /api/private/paymentsAdyen/validatePaymentMethods";
    try {

        var params = req.query;
        var clientName = req.headers['clientname'];

        var amount = {
            currency: params.currency,
            value: 0
        };

        if (params.shopperLocale != undefined) {

            var body = {
                countryCode: params.countryCode,
                channel: params.channel,
                shopperLocale: params.shopperLocale,
                merchantAccount: adyenMerchantAccount,
                amount: amount
            };

        } else {

            var body = {
                countryCode: params.countryCode,
                channel: params.channel,
                merchantAccount: adyenMerchantAccount,
                amount: amount
            };

        };

        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
            body.merchantAccount = adyenMerchantAccountSC
            //TODO
            checkoutSC.paymentMethods(body)
                //checkout.paymentMethods(body)
                .then((paymentsResponse) => {

                    res.status(200).send(paymentsResponse);
                    saveRequestHistoryLogs(req, res, paymentsResponse);
                    return res;

                })
                .catch((error) => {

                    console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });
        } else {
            checkout.paymentMethods(body)
                .then((paymentsResponse) => {

                    res.status(200).send(paymentsResponse);
                    saveRequestHistoryLogs(req, res, paymentsResponse);
                    return res;

                })
                .catch((error) => {

                    console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});


//Get paymentMethods adyen 3ds
router.get('/api/private/paymentsAdyen/3ds/paymentMethods', async (req, res, next) => {
    var context = "POST /api/private/paymentsAdyen/3ds/paymentMethods";
    try {

        const params = req.query;
        const clientName = req.headers['clientname'];
        const userId = req.headers['userid'];
        const adyenCheckoutObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? checkoutSC : checkout
        const adyenMerchantAccountName = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? adyenMerchantAccountSC : adyenMerchantAccount

        
        const userInfo = await getUser(userId);
        if(await FeatureFlagGuard.canActivate('blockcreditcard')){
            const blockCreditCard = await verifyIfUserCanAddCard(userInfo); 
            console.log('[',context,'] blockCreditCard: ', blockCreditCard);       
    
            if (blockCreditCard) {
                    const currentDate = new Date();
                    // Subtract one month from the current date
                    const minPastDate = new Date(currentDate.getTime() - blockCreditCard.minAccoutCreatedDays * 24 * 60 * 60 * 1000);
                    const userCreatedDate = new Date(userInfo.createdAt);
                    console.log('[',context,']','datas: ', minPastDate, userCreatedDate, userCreatedDate > minPastDate);
                    // Compare the dates
                    if (userCreatedDate > minPastDate) {
                        console.log('[',context,']','retorna block', userInfo.createdAt > minPastDate, minPastDate, userCreatedDate);
                        return res.status(400).send({code: "payments_blockedCreditCardRegistration"})
                    }
            }    
        }
        
        var amount = {
            currency: params.currency,
            value: 0
        };

        if (params.shopperLocale != undefined) {

            var body = {
                countryCode: params.countryCode,
                channel: params.channel,
                shopperLocale: params.shopperLocale,
                merchantAccount: adyenMerchantAccountName,
                amount: amount,
            };
        } else {

            var body = {
                countryCode: params.countryCode,
                channel: params.channel,
                merchantAccount: adyenMerchantAccountName,
                amount: amount,
            };
        };

        adyenCheckoutObj.paymentMethods(body)
            .then((paymentsResponse) => {
                // console.log("paymentMethods", JSON.stringify(paymentsResponse))
                delete paymentsResponse.oneClickPaymentMethods
                const paymentMethods = paymentsResponse.paymentMethods.filter(elem => elem.type === "scheme")
                res.status(200).send({ paymentMethods });
                saveRequestHistoryLogs(req, res, { paymentMethods });
                return res;
            })
            .catch((error) => {

                console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                res.status(500).send(error.message);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.get('/api/private/paymentsAdyen/3ds/storedPaymentMethods', (req, res, next) => {
    var context = "POST /api/private/paymentsAdyen/3ds/storedPaymentMethods";
    try {

        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];

        if (!userId) {
            let message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;
        };

        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

            let body = {
                merchantAccount: adyenMerchantAccountSC,
                shopperReference: userId
            };

            checkoutSC.paymentMethods(body)
                .then((paymentsResponse) => {

                    //console.log("paymentsResponse", paymentsResponse)
                    if (paymentsResponse.storedPaymentMethods != undefined) {

                        validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                            .then((paymentMethods) => {

                                // paymentsResponse.storedPaymentMethods = paymentMethods
                                res.status(200).send({ storedPaymentMethods: paymentMethods });
                                saveRequestHistoryLogs(req, res, paymentsResponse);
                                return res;

                            })
                            .catch((error) => {

                                console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            });


                    } else {
                        res.status(200).send([]);
                        saveRequestHistoryLogs(req, res, []);
                        return res;
                    };

                })
                .catch((error) => {

                    console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                    res.status(200).send([]);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        } else {

            let body = {
                merchantAccount: adyenMerchantAccount,
                shopperReference: userId
            };

            checkout.paymentMethods(body)
                .then(async (paymentsResponse) => {

                    if (paymentsResponse.storedPaymentMethods != undefined) {

                        validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                            .then((paymentMethods) => {

                                // paymentsResponse.storedPaymentMethods = paymentMethods
                                res.status(200).send({ storedPaymentMethods: paymentMethods });
                                saveRequestHistoryLogs(req, res, paymentsResponse);
                                return res;

                            })
                            .catch((error) => {

                                console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            });


                    } else {
                        res.status(200).send([]);
                        saveRequestHistoryLogs(req, res, []);
                        return res;
                    };

                })
                .catch((error) => {

                    console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                    //res.status(500).send(error.message);
                    res.status(200).send([]);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});


router.get('/api/private/paymentsAdyen/3ds/cardsToAuthenticate', (req, res, next) => {
    var context = "POST /api/private/paymentsAdyen/3ds/cardsToAuthenticate";
    try {

        const userId = req.headers['userid'];
        const clientName = req.headers['clientname'];
        const { storedPaymentMethodId } = req.query
        const adyenCheckoutObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? checkoutSC : checkout
        const adyenMerchantAccountName = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? adyenMerchantAccountSC : adyenMerchantAccount

        const body = {
            merchantAccount: adyenMerchantAccountName,
            shopperReference: userId
        };

        adyenCheckoutObj.paymentMethods(body)
            .then(async (paymentsResponse) => {

                if (paymentsResponse.storedPaymentMethods != undefined) {

                    validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                        .then((paymentMethods) => {

                            let cardsToAuthenticate = paymentMethods.filter(elem => storedPaymentMethodId ? storedPaymentMethodId === elem.id && elem.needsThreeDSAuthentication : elem.needsThreeDSAuthentication)
                            res.status(200).send({ storedPaymentMethods: cardsToAuthenticate, paymentMethods: [] });
                            saveRequestHistoryLogs(req, res, { storedPaymentMethods: cardsToAuthenticate, paymentMethods: [] });
                            return res;

                        })
                        .catch((error) => {

                            console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });


                } else {
                    res.status(200).send({ storedPaymentMethods: [], paymentMethods: [] });
                    saveRequestHistoryLogs(req, res, { storedPaymentMethods: [], paymentMethods: [] });
                    return res;
                };

            })
            .catch((error) => {

                console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                //res.status(500).send(error.message);
                res.status(200).send({ storedPaymentMethods: [], paymentMethods: [] });
                saveRequestHistoryLogs(req, res, error);
                return res;

            });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== PUT ==========
//Make default card
router.put('/api/private/paymentsAdyen/makeDefaultPaymentMethod', (req, res, next) => {
    var context = "PUT /api/private/paymentsAdyen/makeDefaultPaymentMethod";
    try {

        var userId = req.headers['userid'];
        var received = req.body;
        var clientName = req.headers['clientname'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        } else if (!received.recurringDetailReference) {

            var message = { auth: false, code: 'server_recurringDetailReference_required', message: "Recurring Detail Reference is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        } else {
            PaymentMethod.markAllDefaultPaymentMethodFalse(userId, (err, result) => {

                if (err) {

                    console.error(`[${context}][markAllDefaultPaymentMethodFalse] Error `, err.message);
                    res.status(500).send(err);
                    saveRequestHistoryLogs(req, res, err);
                    return res;
                    //return res.status(500).send(err);

                } else {

                    PaymentMethod.markAsDefaultPaymentMethod(received.recurringDetailReference, (err, result) => {

                        if (err) {

                            console.error(`[${context}][markAsDefaultPaymentMethod] Error `, err.message);
                            res.status(500).send(err);
                            saveRequestHistoryLogs(req, res, err);
                            return res;
                            //return res.status(500).send(err);

                        } else {

                            let data = {
                                userId: userId,
                                paymentMethodId: received.recurringDetailReference
                            };

                            updatePaymentMethodContract(data)

                            var body = {

                                merchantAccount: adyenMerchantAccount,
                                shopperReference: userId

                            };

                            if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                                body.merchantAccount = adyenMerchantAccountSC
                                //TODO
                                checkoutSC.paymentMethods(body)
                                    //checkout.paymentMethods(body)
                                    .then(async (paymentsResponse) => {

                                        if (paymentsResponse.storedPaymentMethods != undefined) {

                                            validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                .then(async (paymentMethods) => {
                                                    await deleteCachedPaymentMethodsByUserId(userId);

                                                    res.status(200).send(paymentMethods);
                                                    saveRequestHistoryLogs(req, res, paymentMethods);

                                                    return res;
                                                })
                                                .catch((error) => {

                                                    console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                    res.status(500).send(error.message);
                                                    saveRequestHistoryLogs(req, res, error);
                                                    return res;

                                                });


                                        } else {

                                            res.status(200).send([]);
                                            saveRequestHistoryLogs(req, res, []);
                                            return res;

                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                                        res.status(500).send(error.message);
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;

                                    });
                            } else {
                                checkout.paymentMethods(body)
                                    .then(async (paymentsResponse) => {

                                        if (paymentsResponse.storedPaymentMethods != undefined) {

                                            validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                .then(async (paymentMethods) => {
                                                    await deleteCachedPaymentMethodsByUserId(userId);

                                                    res.status(200).send(paymentMethods);
                                                    saveRequestHistoryLogs(req, res, paymentMethods);
                                                    return res;

                                                })
                                                .catch((error) => {

                                                    console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                    res.status(500).send(error.message);
                                                    saveRequestHistoryLogs(req, res, error);
                                                    return res;

                                                });


                                        } else {

                                            res.status(200).send([]);
                                            saveRequestHistoryLogs(req, res, []);
                                            return res;

                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                                        res.status(500).send(error.message);
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;

                                    });
                            };

                        };

                    });

                };

            });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== PATCH ==========
//Edit a credit card saved
router.patch('/api/private/paymentsAdyen/editCard', (req, res, next) => {
    const context = "PATCH /api/private/paymentsAdyen/editCard";
    try {

        let userId = req.headers['userid'];
        let received = req.body;
        let clientName = req.headers['clientname'];

        if (!userId) {

            let message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };
        validateFieldsValidateCard(received)
            .then(async () => {

                var transaction = new Transactions({
                    userId: userId,
                    transactionType: process.env.TransactionTypeEditCard,
                    status: process.env.TransactionStatusPaidOut,
                    provider: process.env.PaymentMethodCard,
                    clientName: clientName
                });

                let transactionCreated = await createTransactions(transaction);
                //console.log("body", body)
                console.log("clientName", clientName)

                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                    let body = {

                        merchantAccount: adyenMerchantAccountSC,
                        shopperReference: userId,
                        reference: transactionCreated._id.toString(),
                        amount: {
                            value: 0,
                            currency: "EUR"
                        },
                        paymentMethod: received.paymentMethod,
                        shopperInteraction: process.env.ShopperInteractionContAuth,
                        recurringProcessingModel: await getRecurringProcessingModel(userId, received?.paymentMethod?.storedPaymentMethodId),
                    };

                    //console.log("body 1 ", body)
                    //TODO
                    checkoutSC.payments(body)
                        //checkout.payments(body)
                        .then((disableResponse) => {

                            delete body.paymentMethod;
                            delete body.amount;
                            delete body.reference;
                            delete body.shopperInteraction;

                            //TODO
                            checkoutSC.paymentMethods(body)
                                //checkout.paymentMethods(body)
                                .then((paymentsResponse) => {

                                    if (paymentsResponse.storedPaymentMethods != undefined) {

                                        validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                            .then((paymentMethods) => {

                                                res.status(200).send(paymentMethods);
                                                saveRequestHistoryLogs(req, res, paymentMethods);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                res.status(500).send(error.message);
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });

                                    }
                                    else {

                                        res.status(200).send([]);
                                        saveRequestHistoryLogs(req, res, []);
                                        return res;

                                    };

                                })
                                .catch((error) => {

                                    console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                                    res.status(500).send(error.message);
                                    saveRequestHistoryLogs(req, res, error);
                                    return res;

                                });


                        })
                        .catch((error) => {

                            console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });

                } else {

                    let body = {

                        merchantAccount: adyenMerchantAccount,
                        shopperReference: userId,
                        reference: transactionCreated._id.toString(),
                        amount: {
                            value: 0,
                            currency: "EUR"
                        },
                        paymentMethod: received.paymentMethod,
                        shopperInteraction: process.env.ShopperInteractionContAuth,
                        recurringProcessingModel: await getRecurringProcessingModel(userId, received?.paymentMethod?.storedPaymentMethodId),
                    };
                    checkout.payments(body)
                        .then((disableResponse) => {

                            delete body.paymentMethod;
                            delete body.amount;
                            delete body.reference;
                            delete body.shopperInteraction;
                            checkout.paymentMethods(body)
                                .then((paymentsResponse) => {

                                    if (paymentsResponse.storedPaymentMethods != undefined) {

                                        validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                            .then((paymentMethods) => {

                                                res.status(200).send(paymentMethods);
                                                saveRequestHistoryLogs(req, res, paymentMethods);
                                                return res;

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                res.status(500).send(error.message);
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });

                                    } else {

                                        res.status(200).send([]);
                                        saveRequestHistoryLogs(req, res, []);
                                        return res;

                                    };

                                })
                                .catch((error) => {

                                    console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                                    res.status(500).send(error.message);
                                    saveRequestHistoryLogs(req, res, error);
                                    return res;

                                });


                        })
                        .catch((error) => {

                            console.error(`[${context}][checkout.payments] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;

                        });
                };

            })
            .catch((error) => {

                res.status(400).send(error);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.patch('/api/private/paymentsAdyen/3ds/addCard', async (req, res, next) => {
    const context = "PATCH /api/private/paymentsAdyen/3ds/addCard";
    let responseObj = { success: true, statusCode: 200, data: {}, logData: {} }

    try {
        console.info(`[${context}] Request received`);

        let userId = req.headers['userid'];
        let clientName = req.headers['clientname']
        let received = req.body;

        console.info(`[${context}] userId: ${userId}, clientName: ${clientName} | Body received:`, received);

        let validationError = validateFieldsAdd3DSCardDetails(received)
        console.info(`[${context}] Validation result:`, validationError);

        let foundTransaction = await transactionFindOne({ _id: received.transactionId })
        console.info(`[${context}] Found transaction:`, foundTransaction?._id?.toString());

        if (!validationError) {
            let adyenCheckoutObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? checkoutSC : checkout
            let adyenModificationObj = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? modificationSC : modification
            let adyenMerchantAccountName = (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) ? adyenMerchantAccountSC : adyenMerchantAccount
            let body = authenticationOnlyPaymentDetailsBody(received, true, foundTransaction)
            
            console.info(`[${context}] Body to send to Adyen:`, body);
            await authenticationOnlyPaymentDetailsRequest(
                body,
                adyenCheckoutObj,
                adyenMerchantAccountName,
                adyenModificationObj,
                responseObj,
                foundTransaction,
                userId,
                clientName
            );

            console.info(`[${context}] Response from Adyen: ${JSON.stringify(responseObj)}`);

            if (responseObj.statusCode == 200) {
                let newData = {
                    Adyen: responseObj.data,
                    message: {
                        auth: true,
                        code: "paymentMethods_3dsAuthenticationSuccess",
                        message: "Autenticação 3DSecure bem-sucedida",
                        type: "topmessage"
                    }
                }
                responseObj.data = newData

                await transactionsUpdate(
                    { _id: foundTransaction._id.toString() },
                    { $set: { status: process.env.TransactionStatusPaidOut } }
                );
                console.info(`[${context}] Transaction marked as PaidOut`);

                await deleteCachedPaymentMethodsByUserId(userId);
                console.info(`[${context}] Cached payment methods deleted for user: ${userId}`);
            } else {
                await transactionsUpdate(
                    { _id: foundTransaction._id.toString() },
                    { $set: { status: process.env.TransactionStatusFaild } }
                );
                console.warn(`[${context}] Transaction marked as Failed due to Adyen response`);
            }

            res.status(responseObj.statusCode).send(responseObj.data);
            saveRequestHistoryLogs(req, res, responseObj.logData);
            return res;
        } else {
            if (foundTransaction?._id) {
                await transactionsUpdate(
                    { _id: foundTransaction._id.toString() },
                    { $set: { status: process.env.TransactionStatusFaild } }
                );
                console.warn(`[${context}] Transaction marked as Failed due to validation`);
            }

            res.status(400).send(validationError);
            saveRequestHistoryLogs(req, res, validationError);
            return res;
        }
    } catch (error) {
        console.error(`[${context}] Error:`, error);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;
    }
});

//Cancel value add card
router.patch('/api/private/paymentsAdyen/cancelValueAddCard', async (req, res, next) => {
    const context = "PATCH /api/private/paymentsAdyen/cancelValueAddCard";
    try {

        let clientName = req.headers['clientname'];
        let data;
        let transactionId = req.body.transactionId;
        let pspReference = req.body.pspReference;

        let transactions = await Transactions.findOne({ _id: transactionId });


        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
            data = {

                merchantAccount: adyenMerchantAccountSC,
                originalReference: pspReference ? pspReference : transactions.adyenReference,
                reference: {

                    typeOfReference: process.env.ReferenceAdyenAddCard,
                    reference: transactionId

                }

            };
        } else {
            data = {

                merchantAccount: adyenMerchantAccount,
                originalReference: pspReference ? pspReference : transactions.adyenReference,
                reference: {

                    typeOfReference: process.env.ReferenceAdyenAddCard,
                    reference: transactionId

                }

            };
        };

        let modificationsResponse = await modification.cancel(data);

        let newValues = {
            $set: {
                amount: {
                    value: 31,
                    currency: "EUR"
                },
                adyenReference: pspReference ? pspReference : transactions.adyenReference,
                dataReceived: modificationsResponse
            }
        };

        let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transactionId }, newValues, { new: true });

        res.status(200).send(transactionUpdated);
        saveRequestHistoryLogs(req, res, transactionUpdated);
        return res;


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== DELETE ==========
//Delete one card from the saved Adyen
router.delete('/api/private/paymentsAdyen/removeCard', async (req, res, next) => {
    var context = "DELETE /api/private/paymentsAdyen/removeCard";
    try {

        var userId = req.headers['userid'];
        var received = req.body;
        var clientName = req.headers['clientname'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        } else if (!received.recurringDetailReference) {

            var message = { auth: false, code: 'server_recurringDetailReference_required', message: "Recurring Detail Reference is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        } else {

            console.log(`received.recurringDetailReference: `,received.recurringDetailReference, '   ', userId)
            const defaultCard = await paymentMethodsFind({userId: userId, defaultPaymentMethod: true});
            console.log(`${context}, defaultCard: ${JSON.stringify(defaultCard)} `);
            if(defaultCard && received.recurringDetailReference === defaultCard.paymentMethodId.toString()) {
                const message = { auth: false, code: 'server_paymentMethod_default', message: "You can't delete your default card until you set a new one." }
                res.status(400).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;
            }


            getChargingSessions(received.recurringDetailReference)
                .then((result) => {
                    if (result.length === 0) {

                        verifyIfInUseOnContract(received.recurringDetailReference, userId)
                            .then(async result => {
                                console.log(result);

                                if (result) {
                                    const message = { auth: false, code: 'server_paymentMethod_associated_contract', message: "It is not possible to remove payment method. Payment associated with a contracte" }
                                    res.status(400).send(message);
                                    saveRequestHistoryLogs(req, res, message);
                                    return res;
                                }
                                else {
                                    var body = {

                                        merchantAccount: adyenMerchantAccount,
                                        shopperReference: userId,
                                        recurringDetailReference: received.recurringDetailReference
                                    };

                                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                                        body.merchantAccount = adyenMerchantAccountSC
                                        //TODO
                                        recurringSC.disable(body)
                                            //recurring.disable(body)
                                            .then((disableResponse) => {

                                                removePaymentMethod(received.recurringDetailReference, userId);

                                                delete body.recurringDetailReference;

                                                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                                                    //TODO
                                                    checkoutSC.paymentMethods(body)
                                                        //checkout.paymentMethods(body)
                                                        .then((paymentsResponse) => {

                                                            if (paymentsResponse.storedPaymentMethods != undefined) {

                                                                validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                                    .then(async (paymentMethods) => {
                                                                        await deleteCachedPaymentMethodsByUserId(userId);
                                                                        res.status(200).send(paymentMethods);
                                                                        saveRequestHistoryLogs(req, res, paymentMethods);

                                                                        return res;
                                                                    })
                                                                    .catch((error) => {

                                                                        console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                                        res.status(500).send(error.message);
                                                                        saveRequestHistoryLogs(req, res, error);
                                                                        return res;

                                                                    });

                                                            } else {

                                                                res.status(200).send([]);
                                                                saveRequestHistoryLogs(req, res, []);
                                                                return res;

                                                            };

                                                        })
                                                        .catch((error) => {

                                                            console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                                                            res.status(500).send(error.message);
                                                            saveRequestHistoryLogs(req, res, error);
                                                            return res;

                                                        });
                                                } else {
                                                    checkout.paymentMethods(body)
                                                        .then((paymentsResponse) => {

                                                            if (paymentsResponse.storedPaymentMethods != undefined) {

                                                                validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                                    .then(async (paymentMethods) => {
                                                                        await deleteCachedPaymentMethodsByUserId(userId);
                                                                        res.status(200).send(paymentMethods);
                                                                        saveRequestHistoryLogs(req, res, paymentMethods);

                                                                        return res;

                                                                    })
                                                                    .catch((error) => {

                                                                        console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                                        res.status(500).send(error.message);
                                                                        saveRequestHistoryLogs(req, res, error);
                                                                        return res;

                                                                    });

                                                            }
                                                            else {

                                                                res.status(200).send([]);
                                                                saveRequestHistoryLogs(req, res, []);
                                                                return res;

                                                            };

                                                        })
                                                        .catch((error) => {

                                                            console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                                                            res.status(500).send(error.message);
                                                            saveRequestHistoryLogs(req, res, error);
                                                            return res;

                                                        });
                                                };

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][recurringSC.disable] Error `, error.message);
                                                res.status(500).send(error.message);
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });
                                    } else {
                                        recurring.disable(body)
                                            .then((disableResponse) => {

                                                removePaymentMethod(received.recurringDetailReference, userId);

                                                delete body.recurringDetailReference;

                                                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                                                    //TODO
                                                    checkoutSC.paymentMethods(body)
                                                        //checkout.paymentMethods(body)
                                                        .then((paymentsResponse) => {

                                                            if (paymentsResponse.storedPaymentMethods != undefined) {

                                                                validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                                    .then(async (paymentMethods) => {
                                                                        await deleteCachedPaymentMethodsByUserId(userId);
                                                                        res.status(200).send(paymentMethods);
                                                                        saveRequestHistoryLogs(req, res, paymentMethods);

                                                                        return res;

                                                                    })
                                                                    .catch((error) => {

                                                                        console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                                        res.status(500).send(error.message);
                                                                        saveRequestHistoryLogs(req, res, error);
                                                                        return res;

                                                                    });

                                                            }
                                                            else {

                                                                res.status(200).send([]);
                                                                saveRequestHistoryLogs(req, res, []);
                                                                return res;

                                                            };

                                                        })
                                                        .catch((error) => {

                                                            console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);
                                                            res.status(500).send(error.message);
                                                            saveRequestHistoryLogs(req, res, error);
                                                            return res;

                                                        });
                                                } else {
                                                    checkout.paymentMethods(body)
                                                        .then((paymentsResponse) => {

                                                            if (paymentsResponse.storedPaymentMethods != undefined) {

                                                                validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                                    .then(async (paymentMethods) => {
                                                                        await deleteCachedPaymentMethodsByUserId(userId);
                                                                        res.status(200).send(paymentMethods);
                                                                        saveRequestHistoryLogs(req, res, paymentMethods);

                                                                        return res;

                                                                    })
                                                                    .catch((error) => {

                                                                        console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);
                                                                        res.status(500).send(error.message);
                                                                        saveRequestHistoryLogs(req, res, error);
                                                                        return res;

                                                                    });

                                                            }
                                                            else {

                                                                res.status(200).send([]);
                                                                saveRequestHistoryLogs(req, res, []);
                                                                return res;

                                                            };

                                                        })
                                                        .catch((error) => {

                                                            console.error(`[${context}][checkout.paymentMethods] Error `, error.message);
                                                            res.status(500).send(error.message);
                                                            saveRequestHistoryLogs(req, res, error);
                                                            return res;

                                                        });
                                                };

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][recurring.disable] Error `, error.message);
                                                res.status(500).send(error.message);
                                                saveRequestHistoryLogs(req, res, error);
                                                return res;

                                            });
                                    };

                                };
                            })
                            .catch(error => {
                                console.error(`[${context}][verifyIfInUseOnContract] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;
                            });

                    }
                    else {

                        var message = { auth: false, code: 'server_paymentMethod_in_use', message: "It is not possible to remove payment method. Payment method in use" }
                        res.status(400).send(message);
                        saveRequestHistoryLogs(req, res, message);
                        return res;

                    };

                })

                .catch((error) => {

                    console.error(`[${context}][getChargingSessions] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.delete('/api/private/paymentsAdyen/preAuthorisePayment', async (req, res, next) => {
    var context = "DELETE /api/private/paymentsAdyen/preAuthorisePayment";
    try {

        var received = req.body;
        var clientName = req.headers['clientname'];
        //console.log("received", received);

        let transaction = await transactionFindOne({ _id: received.transactionId });

        if (!clientName) {
            clientName = transaction.clientName;
        }

        //console.log("transaction", transaction);

        let data = {

            merchantAccount: adyenMerchantAccount,
            originalReference: transaction.adyenReference,
            reference: transaction._id
        };

        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
            body.merchantAccount = adyenMerchantAccountSC
            //TODO
            modificationSC.cancel(data)
                //modification.cancel(data)
                .then((result) => {
                    transactionsUpdate({ _id: transaction._id }, { data: result })
                        .then(() => {
                            res.status(200).send(result);
                            saveRequestHistoryLogs(req, res, result);
                            return res;
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;
                        })
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;
                })
        } else {
            modification.cancel(data)
                .then((result) => {
                    transactionsUpdate({ _id: transaction._id }, { data: result })
                        .then(() => {
                            res.status(200).send(result);
                            saveRequestHistoryLogs(req, res, result);
                            return res;
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error);
                            return res;
                        })
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;
                })
        }

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Endpoint jobs
//Job Send email card valida card date
router.post('/api/private/paymentsAdyen/job/checkValidaCardDate/startJob', (req, res) => {
    var context = "POST /api/private/paymentsAdyen/job/checkValidaCardDate/startJob";
    var timer = "* 01 01 * *";

    if (req.body.timer)
        timer = req.body.timer;

    initJogCheckValidaCardDate(timer).then(() => {
        taskCards.start();
        console.log("Send email card Job Started")
        return res.status(200).send('Send email card Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });

});

router.post('/api/private/paymentsAdyen/job/checkValidaCardDate/stopJob', (req, res) => {
    var context = "POST /api/private/paymentsAdyen/job/checkValidaCardDate/stopJob";

    taskCards.stop();
    console.log("Send email card Job Stopped")
    return res.status(200).send('Send email card Job Stopped');

});

router.post('/api/private/paymentsAdyen/job/checkValidaCardDate/statusJob', (req, res) => {
    var context = "POST /api/private/paymentsAdyen/job/checkValidaCardDate/statusJob";

    var status = "Stopped";
    if (taskCards != undefined) {
        status = taskCards.status;
    }

    return res.status(200).send({ "Send email card Job Status": status });
});

router.post('/api/private/paymentsAdyen/job/checkValidaCardDate/forceRun', (req, res) => {
    var context = "POST /api/private/paymentsAdyen/job/checkValidaCardDate/forceRun";

    checkValidateCard()

    console.log("Check valida card Ddte Job Status was executed")
    return res.status(200).send("Check valida card Ddte Job Status was executed");
});

//========== FUNCTIONS ==========

function makePaymentCard(received, userId, clientName) {
    var context = "Funciton makePaymentCard";
    return new Promise(async (resolve, reject) => {
        try {

            var transactionId;

            var queryPayment = {
                _id: received.paymentId,
                sessionId: received.sessionId,
                userId: userId
            };

            let paymentFound = await paymentFindOne(queryPayment);

            if (received.transactionId === undefined || received.transactionId === "" || payment.transactionId == "-1") {
                var newTransaction = new Transactions(
                    {
                        userId: userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderCreditCard,
                        amount: received.amount,
                        sessionId: received.sessionId,
                        paymentId: received.paymentId

                    }
                );

                let transactionCreated = await createTransactions(newTransaction);

                transactionId = transactionCreated._id.toString();
            }
            else {
                transactionId = received.transactionId;
            };


            var queryTransaction = {
                _id: transactionId
            };

            if (paymentFound.paymentMethod === process.env.PaymentMethodWallet) {

                var body = {

                    paymentMethod: received.paymentMethod,
                    shopperReference: userId,
                    shopperInteraction: process.env.ShopperInteractionEcommerce,
                    recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId),
                    storePaymentMethod: process.env.StorePaymentMethod,
                    amount: paymentFound.amount,
                    reference: transactionId,
                    merchantAccount: adyenMerchantAccount,
                };

                body.amount.value *= 100;
                body.amount.value = Math.abs(body.amount.value);
                await forceResponseCode(userId, body)

                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                    body.merchantAccount = adyenMerchantAccountSC
                    //TODO
                    checkoutSC.payments(body)
                        //checkout.payments(body)
                        .then((result) => {
                            needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

                            if (result.resultCode === 'Authorised') {

                                var data = {
                                    merchantAccount: adyenMerchantAccountSC,
                                    originalReference: result.pspReference,
                                    modificationAmount: body.amount,
                                    reference: transactionId
                                };

                                //TODO
                                modificationSC.capture(data)
                                    //modification.capture(data)
                                    .then(async (responseCapture) => {

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                data: responseCapture
                                            }
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: responseCapture,
                                                amount: {
                                                    currency: result.amount.currency,
                                                    value: result.amount.value / 100
                                                }
                                            }
                                        };
                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                        resolve(responseCapture);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });
                } else {
                    checkout.payments(body)
                        .then((result) => {
                            needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

                            if (result.resultCode === 'Authorised') {

                                var data = {
                                    merchantAccount: adyenMerchantAccount,
                                    originalReference: result.pspReference,
                                    modificationAmount: body.amount,
                                    reference: transactionId
                                };

                                modification.capture(data)
                                    .then(async (responseCapture) => {

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                data: responseCapture
                                            }
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: responseCapture,
                                                amount: {
                                                    currency: result.amount.currency,
                                                    value: result.amount.value / 100
                                                }
                                            }
                                        };
                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                        resolve(responseCapture);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });
                };

            } else {

                if (paymentFound.amount.value > paymentFound.reservedAmount) {

                    let modificationAmount = parseFloat((received.amount.value - received.reservedAmount).toFixed(2));

                    //console.log("modificationAmount", typeof modificationAmount);

                    received.amount.value = Math.abs(received.amount.value);

                    let body = {

                        originalReference: paymentFound.adyenReference,
                        modificationAmount: {
                            currency: "EUR",
                            value: (received.amount.value * 100)
                        },
                        additionalData: {
                            industryUsage: "DelayedCharge"
                        },
                        reference: paymentFound.transactionId,
                        merchantAccount: adyenMerchantAccount

                    };

                    adjustmentPreAuthorize(body, clientName)
                        .then((result) => {
                            if (result) {

                                /*paymentUpdate(queryPayment, { $set: { reservedAmount: paymentFound.amount.value } })
                                    .then(() => {*/

                                var data = {
                                    merchantAccount: adyenMerchantAccount,
                                    modificationAmount: {
                                        currency: "EUR",
                                        value: paymentFound.amount.value * 100
                                    },
                                    originalReference: paymentFound.adyenReference,
                                    reference: paymentFound.transactionId
                                };

                                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                                    body.merchantAccount = adyenMerchantAccountSC
                                    //TODO
                                    modificationSC.capture(data)
                                        //modification.capture(data)
                                        .then(async (result) => {
                                            let valuesPaymet = {
                                                $set: {
                                                    status: process.env.PaymentStatusInPayment,
                                                    paymentMethod: process.env.PaymentMethodCard,
                                                    paymentAdyenId: result.pspReference,
                                                    data: result
                                                }
                                            };

                                            let valuesTransation = {
                                                $set: {
                                                    ransactionType: process.env.TransactionTypeDebit,
                                                    status: process.env.TransactionStatusInPayment,
                                                    data: result
                                                }
                                            };

                                            let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                            let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);
                                            resolve(result);

                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][ modificationSC.capture] Error `, error.message);
                                            reject(error);
                                        });
                                } else {
                                    modification.capture(data)
                                        .then(async (result) => {
                                            let valuesPaymet = {
                                                $set: {
                                                    status: process.env.PaymentStatusInPayment,
                                                    paymentMethod: process.env.PaymentMethodCard,
                                                    paymentAdyenId: result.pspReference,
                                                    data: result
                                                }
                                            };

                                            let valuesTransation = {
                                                $set: {
                                                    ransactionType: process.env.TransactionTypeDebit,
                                                    status: process.env.TransactionStatusInPayment,
                                                    data: result
                                                }
                                            };

                                            let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                            let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);
                                            resolve(result);

                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][ modification.capture] Error `, error.message);
                                            reject(error);
                                        });
                                };

                                /*})
                                .catch((error) => {
                                    console.error(`[${context}][paymentUpdate] Error `, error.message);
                                    reject(error);
                                })*/

                            }
                            else {
                                let message = { auth: false, code: "server_can't_adjust", message: "Can't adjust value" }
                                reject(message);
                            };

                        })
                        .catch((error) => {
                            console.error(`[${context}][adjustmentPreAuthorize] Error `, error.message);
                            reject(error);
                        })
                }
                else {

                    var data = {

                        merchantAccount: adyenMerchantAccount,
                        originalReference: paymentFound.adyenReference,
                        modificationAmount: paymentFound.amount,
                        reference: paymentFound.transactionId

                    };

                    data.modificationAmount.value *= 100;
                    data.modificationAmount.value = Math.abs(data.modificationAmount.value);

                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                        data.merchantAccount = adyenMerchantAccountSC
                        //TODO
                        modificationSC.capture(data)
                            //modification.capture(data)
                            .then(async (result) => {
                                let valuesPaymet = {
                                    $set: {
                                        status: process.env.PaymentStatusInPayment,
                                        paymentMethod: process.env.PaymentMethodCard,
                                        paymentAdyenId: result.pspReference,
                                        data: result
                                    }
                                };

                                let valuesTransation = {
                                    $set: {
                                        transactionType: process.env.TransactionTypeDebit,
                                        status: process.env.TransactionStatusInPayment,
                                        data: result,
                                        amount: {
                                            currency: paymentFound.amount.currency,
                                            value: paymentFound.amount.value / 100
                                        }
                                    }
                                };

                                let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                resolve(result);


                            })
                            .catch((error) => {

                                console.error(`[${context}][modificationSC.capture(] Error `, error.message);
                                reject(error);

                            });
                    } else {
                        modification.capture(data)
                            .then(async (result) => {
                                let valuesPaymet = {
                                    $set: {
                                        status: process.env.PaymentStatusInPayment,
                                        paymentMethod: process.env.PaymentMethodCard,
                                        paymentAdyenId: result.pspReference,
                                        data: result
                                    }
                                };

                                let valuesTransation = {
                                    $set: {
                                        transactionType: process.env.TransactionTypeDebit,
                                        status: process.env.TransactionStatusInPayment,
                                        data: result,
                                        amount: {
                                            currency: paymentFound.amount.currency,
                                            value: paymentFound.amount.value / 100
                                        }
                                    }
                                };

                                let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                resolve(result);


                            })
                            .catch((error) => {

                                console.error(`[${context}][modification.capture(] Error `, error.message);
                                reject(error);

                            });
                    };
                };
            };

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

function makePaymentCardNotifications(received, userId, clientName) {
    var context = "Funciton makePaymentCardNotifications";
    return new Promise(async (resolve, reject) => {
        try {

            var transactionId;

            var queryPayment = {
                _id: received.paymentId,
                sessionId: received.sessionId,
                userId: userId
            };

            let paymentFound = await paymentFindOne(queryPayment);

            if (received.transactionId === undefined || received.transactionId === "" || payment.transactionId == "-1") {
                var newTransaction = new Transactions(
                    {
                        userId: userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderCreditCard,
                        amount: received.amount,
                        sessionId: received.sessionId,
                        paymentId: received.paymentId

                    }
                );

                let transactionCreated = await createTransactions(newTransaction);

                transactionId = transactionCreated._id.toString();
            } else {
                transactionId = received.transactionId;
            };

            var queryTransaction = {
                _id: transactionId
            };

            if (paymentFound.paymentMethod === process.env.PaymentMethodWallet) {

                var body = {

                    paymentMethod: received.paymentMethod,
                    shopperReference: userId,
                    shopperInteraction: process.env.ShopperInteractionEcommerce,
                    recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId),
                    storePaymentMethod: process.env.StorePaymentMethod,
                    amount: paymentFound.amount,
                    reference: transactionId,
                    merchantAccount: adyenMerchantAccount,
                };

                body.amount.value *= 100;
                body.amount.value = Math.abs(body.amount.value);
                await forceResponseCode(userId, body)

                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                    body.merchantAccount = adyenMerchantAccountSC

                    //TODO
                    checkoutSC.payments(body)
                        //checkout.payments(body)
                        .then((result) => {
                            needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

                            if (result.resultCode === 'Authorised') {

                                var data = {
                                    merchantAccount: adyenMerchantAccountSC,
                                    originalReference: result.pspReference,
                                    modificationAmount: body.amount,
                                    reference: transactionId
                                };

                                //TODO
                                modificationSC.capture(data)
                                    //modification.capture(data)
                                    .then(async (responseCapture) => {

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                data: responseCapture
                                            }
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                data: responseCapture,
                                                amount: {
                                                    currency: result.amount.currency,
                                                    value: result.amount.value / 100
                                                }
                                            }
                                        };
                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                        resolve(responseCapture);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });
                } else {
                    checkout.payments(body)
                        .then((result) => {
                            needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)
                            if (result.resultCode === 'Authorised') {

                                var data = {
                                    merchantAccount: adyenMerchantAccount,
                                    originalReference: result.pspReference,
                                    modificationAmount: body.amount,
                                    reference: transactionId
                                };

                                modification.capture(data)
                                    .then(async (responseCapture) => {

                                        let valuesPaymet = {
                                            $set: {
                                                status: process.env.PaymentStatusInPayment,
                                                paymentMethod: process.env.PaymentMethodCard,
                                                paymentAdyenId: result.pspReference,
                                                data: responseCapture
                                            }
                                        };

                                        let valuesTransation = {
                                            $set: {
                                                transactionType: process.env.TransactionTypeDebit,
                                                status: process.env.TransactionStatusInPayment,
                                                transactionType: process.env.PaymentMethodCard,
                                                data: responseCapture,
                                                amount: {
                                                    currency: result.amount.currency,
                                                    value: result.amount.value / 100
                                                }
                                            }
                                        };
                                        let resultPayment = await paymentUpdate(queryPayment, valuesPaymet);
                                        let resultTransaction = await transactionsUpdate(queryTransaction, valuesTransation);

                                        resolve(responseCapture);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });
                };

            } else {

                var userId = paymentFound.userId;

                var received = {

                    paymentId: paymentFound._id,
                    sessionId: paymentFound.sessionId,
                    amount: amoutToCard,
                    paymentMethod: {
                        type: "scheme",
                        storedPaymentMethodId: paymentFound.paymentMethodId,
                        encryptedCardNumber: "",
                        encryptedExpiryYear: "",
                        encryptedSecurityCode: "",
                        holderName: "",
                        encryptedExpiryMonth: ""
                    },
                    transactionId: paymentFound.transactionId,
                    adyenReference: paymentFound.adyenReference,
                    reservedAmount: paymentFound.reservedAmount

                };

                //console.log("2 - received", received);

                if (received.adyenReference == "-1" || received.adyenReference == "" || received.adyenReference == undefined) {


                    let body = {
                        merchantAccount: adyenMerchantAccount,
                        reference: received.transactionId,
                        amount: received.amount,
                        paymentMethod: received.paymentMethod,
                        shopperReference: userId,
                        shopperInteraction: process.env.ShopperInteractionContAuth,
                        recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId)/*,
                        additionalData: {
                            authorisationType: process.env.AdyenAuthorisationTypePreAuth
                        }*/
                    };

                    body.amount.value *= 100;

                    body.amount.value = Math.abs(body.amount.value);
                    await forceResponseCode(userId, body)

                    console.log("body", body);

                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                        body.merchantAccount = adyenMerchantAccountSC
                        //TODO
                        checkoutSC.payments(body)
                            //checkout.payments(body)
                            .then(async (result) => {
                                needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

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
                                needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

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
                    };

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

                        adjustmentPreAuthorize(body, clientName)
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

                                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                                        data.merchantAccount = adyenMerchantAccountSC
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
                                    }
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

                    } else {

                        received.amount.value = Math.abs(received.amount.value);
                        var data = {

                            merchantAccount: adyenMerchantAccount,
                            originalReference: received.adyenReference,
                            modificationAmount: received.amount,
                            reference: received.transactionId

                        };

                        //data.modificationAmount.value = parseFloat(data.modificationAmount.value.toFixed(2)) * 100;

                        data.modificationAmount.value *= 100;
                        console.log("data", data);
                        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                            data.merchantAccount = adyenMerchantAccountSC

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
            };

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

function paymentFindOne(query) {
    var context = "Funciton paymentFindOne";
    return new Promise((resolve, reject) => {
        Payments.findOne(query, (err, result) => {
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

function getUnauthorizedResponse(req) {

    //console.log("req", req);
    return req.auth
        ? ('Credentials ' + req.auth.user + ':' + req.auth.password + ' rejected')
        : 'No credentials provided'
};

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

async function saveRequestHistoryLogs(req, res, body) {
    var context = "Function saveRequestHistoryLogs paymentsAdyen";

    //console.log("body", body);

    let newBody = await removeObject(body);
    //newBody = await removeObjectReqBody(newBody);

    let reqBody = await removeObjectReqBody(req.body);

    var requestHistoryLogs = new RequestHistoryLogs({
        userId: req.headers['userid'],
        path: req.url,
        reqID: UUID.create(),
        clientType: req.headers['client'],
        requestType: req.method,
        queryData: req.query,
        paramsData: req.params,
        bodyData: JSON.stringify(req.body),
        responseStatus: res.statusCode,
        responseBody: JSON.stringify(body)
    });

    RequestHistoryLogs.createRequestHistoryLogs(requestHistoryLogs, (err, result) => {
        if (err) {

            console.error(`[${context}][createRequestHistoryLogs] Error `, err.message);

        }
        else {

            console.log("Request history log saved");

        };
    });

};

function notificationTransaction(notification, transaction) {
    var context = "Function notificationTransaction";
    return new Promise(async (resolve, reject) => {
        try {
            let status;
            //console.log("notifications", notification)
            //var merchantReference = JSON.parse(notification.merchantReference);
            var query = {
                _id: transaction._id
            };
            var transactionType = process.env.TransactionTypeCredit;

            switch (notification.eventCode) {

                case 'AUTHORISATION':

                    console.log("Notificação por parte da Adyen de AUTHORISATION (Convertido valor para euros)", notification)

                    if (notification.success == "true") {

                        status = process.env.PaymentStatusInPayment;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    }
                    else {

                        status = process.env.TransactionStatusFaild;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    };
                    break;

                case 'CAPTURE':

                    console.log("Notificação por parte da Adyen de CAPTURE (Convertido valor para euros)", notification)
                    if (notification.success == "true") {

                        status = process.env.TransactionStatusPaidOut;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            amount: {
                                currency: transaction.amount.currency, value: transaction.amount.value
                            },
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        sendEmailTopUpBilling(transaction);
                        addBalanceToWallet(addWallet);

                    }
                    else {

                        status = process.env.TransactionStatusFaild;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    };

                    break;

                case 'CANCELLATION':

                    if (notification.success == "true") {

                        status = process.env.TransactionStatusCanceled;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    }
                    else {

                        status = process.env.TransactionStatusFaild;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    };

                    break;

                case 'REFUND':

                    if (notification.success == "true") {

                        transactionType = process.env.TransactionTypeRefund;
                        status = process.env.TransactionStatusRefund;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            amount: {
                                currency: transaction.amount.currency, value: transaction.amount.value
                            },
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        removeBalanceToWallet(addWallet);

                    }
                    else {

                        status = process.env.TransactionStatusFaild;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    };

                    break;

                case 'CANCEL_OR_REFUND':

                    if (notification.success == "true") {

                        if (transaction.status === process.env.TransactionStatusPaidOut) {

                            transactionType = process.env.TransactionTypeRefund;
                            status = process.env.TransactionStatusRefund;
                            var addWallet = {
                                _id: transaction._id,
                                status: status,
                                amount: {
                                    currency: transaction.amount.currency, value: transaction.amount.value
                                },
                                userId: transaction.userId,
                                transactionType: transactionType
                            };
                            removeBalanceToWallet(addWallet);
                        }
                        else {

                            status = process.env.TransactionStatusCanceled;
                            var addWallet = {
                                _id: transaction._id,
                                status: status,
                                userId: transaction.userId,
                                transactionType: transactionType
                            };
                            updateTransactionToWallet(addWallet);

                        };

                    }
                    else {

                        status = process.env.TransactionStatusFaild;
                        var addWallet = {
                            _id: transaction._id,
                            status: status,
                            userId: transaction.userId,
                            transactionType: transactionType
                        };
                        updateTransactionToWallet(addWallet);

                    };

                    break;

                default:

                    status = process.env.TransactionStatusFaild;
                    var addWallet = {
                        _id: transaction._id,
                        status: status,
                        userId: transaction.userId,
                        transactionType: transactionType
                    };
                    updateTransactionToWallet(addWallet);

                    break;

            };

            var newValues = {
                $set: {
                    status: status,
                    dataReceived: notification,
                    transactionType: transactionType
                }
            };

            transactionsUpdate(query, newValues)
                .then(async (transactionsUpdated) => {

                    let response = await transactionFindOne({ _id: transactionsUpdated._id });
                    //addBalanceToWallet(response);
                    resolve(response);
                })
                .catch((error) => {

                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                    reject(error);

                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function notificationPayments(notification) {
    const context = "Function notificationPayments";
    return new Promise(async (resolve, reject) => {

        try {

            let statusTransaction;
            let statusPayment;

            console.info(`[${context}] Received notification`, notification);

            let paymentFound = await paymentFindOne({ transactionId: notification.merchantReference });
            let transactionType = process.env.TransactionTypeDebit;

            switch (notification.eventCode) {

                case 'AUTHORISATION':

                    if (notification.success == "true") {

                        statusTransaction = process.env.TransactionStatusInPayment;
                        statusPayment = process.env.PaymentStatusInPayment;

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusStartPayment;

                    };

                    break;

                case 'CAPTURE':

                    if (notification.success == "true") {

                        statusTransaction = process.env.TransactionStatusPaidOut;
                        statusPayment = process.env.PaymentStatusPaidOut;
                
                        validateNotificationsCard(paymentFound);
                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusStartPayment;

                    };

                    break;

                case 'CANCELLATION':

                    if (notification.success == "true") {

                        statusTransaction = process.env.TransactionStatusCanceled;
                        statusPayment = process.env.PaymentStatusStartPayment;

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusStartPayment;

                    };

                    break;

                case 'REFUND':

                    if (notification.success == "true") {
                        transactionType = process.env.TransactionTypeRefund;
                        statusTransaction = process.env.TransactionStatusRefund;
                        statusPayment = process.env.PaymentStatusRefund;
                        console.info(`[${context}] REFUND successful`);
                    }
                    else {
                        statusTransaction = process.env.TransactionStatusRefundFaild;
                        statusPayment = process.env.PaymentStatusRefundFaild;
                        console.info(`[${context}] REFUND failed`);
                    };

                    break;

                case 'CANCEL_OR_REFUND':

                    if (notification.success == "true") {

                        let transaction = await transactionFindOne({ _id: paymentFound.transactionId });

                        if (transaction.status === process.env.TransactionStatusPaidOut) {

                            transactionType = process.env.TransactionTypeRefund;
                            statusTransaction = process.env.TransactionStatusRefund;
                            statusPayment = process.env.PaymentStatusStartPayment;

                        }
                        else {

                            statusTransaction = process.env.TransactionStatusCanceled;
                            statusPayment = process.env.PaymentStatusStartPayment;

                        };

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusStartPayment;

                    };

                    break;

                default:

                    statusTransaction = process.env.TransactionStatusFaild;
                    statusPayment = process.env.PaymentStatusStartPayment;

                    break;
            };
            if (paymentFound) {

                let queryTransaction = {
                    _id: paymentFound.transactionId
                };

                let queryPayments = {
                    _id: paymentFound._id
                };

                let newTransaction = {
                    $set: {
                        status: statusTransaction,
                        dataReceived: notification,
                        transactionType: transactionType
                    }
                };

                let newPayments = {
                    $set: {
                        status: statusPayment,
                        dataReceived: notification
                    }
                };

                let transactionsUpdated = await transactionsUpdate(queryTransaction, newTransaction);
                let paymentsUpdated = await paymentUpdate(queryPayments, newPayments);

                let response = {
                    transaction: transactionsUpdated,
                    payment: paymentsUpdated
                };

                if (statusPayment === process.env.PaymentStatusPaidOut) {
                    updateChargingSession(queryPayments);
                };

                console.info(`[${context}] Update completed successfully`, response);
                resolve(response);

            } else {
                console.info(`[${context}] No payment found for transactionId: ${notification.merchantReference}`);
                resolve({});
            };

        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(error);
        };

    });
};

function notificationPayments2ndWayPhysicalCard(notification) {
    var context = "Function notificationPayments2ndWayPhysicalCard";
    return new Promise(async (resolve, reject) => {

        try {

            let statusTransaction;
            let statusPayment;

            let paymentFound = await paymentFindOne({ transactionId: notification.merchantReference });
            let transactionType = process.env.TransactionType2ndWayPhysicalCard;

            switch (notification.eventCode) {

                case 'AUTHORISATION':

                    if (notification.success == "true") {

                        statusTransaction = process.env.TransactionStatusInPayment;
                        statusPayment = process.env.PaymentStatusInPayment;

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusFaild;

                    };

                    break;

                case 'CAPTURE':

                    if (notification.success == "true") {

                        statusTransaction = process.env.TransactionStatusPaidOut;
                        statusPayment = process.env.PaymentStatusPaidOut;
                        //TODO send Billing

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusFaild;

                    };

                    break;

                case 'CANCELLATION':

                    if (notification.success == "true") {

                        statusTransaction = process.env.TransactionStatusCanceled;
                        statusPayment = process.env.PaymentStatusCanceled;

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusFaild;

                    };

                    break;

                case 'REFUND':

                    if (notification.success == "true") {

                        transactionType = process.env.TransactionTypeRefund;
                        statusTransaction = process.env.TransactionStatusRefund;
                        statusPayment = process.env.PaymentStatusRefund;

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusFaild;

                    };

                    break;

                case 'CANCEL_OR_REFUND':

                    if (notification.success == "true") {

                        let transaction = await transactionFindOne({ _id: paymentFound.transactionId });

                        if (transaction.status === process.env.TransactionStatusPaidOut) {

                            transactionType = process.env.TransactionTypeRefund;
                            statusTransaction = process.env.TransactionStatusRefund;
                            statusPayment = process.env.PaymentStatusRefund;

                        }
                        else {

                            statusTransaction = process.env.TransactionStatusCanceled;
                            statusPayment = process.env.PaymentStatusCanceled;

                        };

                    }
                    else {

                        statusTransaction = process.env.TransactionStatusFaild;
                        statusPayment = process.env.PaymentStatusFaild;

                    };

                    break;

                default:

                    statusTransaction = process.env.TransactionStatusFaild;
                    statusPayment = process.env.PaymentStatusFaild;

                    break;
            };
            //console.log("paymentFound", paymentFound)
            if (paymentFound) {

                let queryTransaction = {
                    _id: paymentFound.transactionId
                };

                let queryPayments = {
                    _id: paymentFound._id
                };

                let newTransaction = {
                    $set: {
                        status: statusTransaction,
                        dataReceived: notification,
                        transactionType: transactionType
                    }
                };

                let newPayments = {
                    $set: {
                        status: statusPayment,
                        dataReceived: notification
                    }
                };

                let transactionsUpdated = await Transactions.findOneAndUpdate(queryTransaction, newTransaction, { new: true });
                let paymentsUpdated = await Payments.findOneAndUpdate(queryPayments, newPayments, { new: true });

                let response = {
                    transaction: transactionsUpdated,
                    payment: paymentsUpdated
                };

                updateContract(paymentsUpdated)

                resolve(response);

            } else {

                let response = {};

                resolve(response);

            };

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };

    });
};

function notificationPreAuthorize(notification) {
    let context = "Function notificationPreAuthorize";
    return new Promise(async (resolve, reject) => {
        try {
            let statusTransaction;
            switch (notification.eventCode) {

                case 'AUTHORISATION':
                    if (notification.success == "true") {
                        statusTransaction = process.env.TransactionStatusInPayment;
                    } else {
                        statusTransaction = process.env.TransactionStatusFaild;
                    };

                    break;

                case 'AUTHORISATION_ADJUSTMENT':

                    if (notification.success == "true") {
                        statusTransaction = process.env.TransactionStatusInPayment;
                    } else {
                        statusTransaction = process.env.TransactionStatusFaild;
                    };

                    break;

                case 'CAPTURE':
                    if (notification.success == "true") {
                        statusTransaction = process.env.TransactionStatusInPayment;

                    } else {
                        statusTransaction = process.env.TransactionStatusFaild;
                    };

                    break;

                case 'CANCELLATION':
                    statusTransaction = process.env.TransactionStatusFaild;
                    break;

                case 'REFUND':
                    if (notification.success == "true") {
                        statusTransaction = process.env.TransactionStatusRefund;

                    } else {
                        statusTransaction = process.env.TransactionStatusRefundFaild;
                    };
                    break;

                case 'CANCEL_OR_REFUND':
                    statusTransaction = process.env.TransactionStatusFaild;
                    break;

                default:
                    statusTransaction = process.env.TransactionStatusFaild;
                    break;
            };

            let query = {
                _id: notification.merchantReference
            };

            let newTransaction = {
                $set: {
                    status: statusTransaction,
                    dataReceived: notification
                }
            };

            await Transactions.findOneAndUpdate(query, newTransaction, { new: true });
            resolve(notification);

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };

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

function addBalanceToWallet(transaction) {
    const context = "Function addBalanceToWallet";
    console.log(`[${context}] transaction: ${JSON.stringify(transaction)}`);

    const query = {
        userId: transaction.userId,
        "transactionsList.transactionId": transaction._id
    };

    const newTransaction = {
        $set: {
            "transactionsList.$.status": transaction.status,
            "transactionsList.$.transactionType": transaction.transactionType
        }
    };

    const amountWallet = [{
        $set: {
            "amount.value": {
                $round: [{ $add: ["$amount.value", transaction.amount.value] }, 2]
            }
        }
    }];

    const data = {
        userId: transaction.userId,
        newWalletValue: transaction.amount.value
    };
    
    updateWalletOnChargingSession(data);

    Wallet.updateOne(query, newTransaction, (err, result) => {
        if (err) {
            console.error(`[${context}][updateOne] Error `, err.message);
        }
        else {
            Wallet.updateOne(query, amountWallet, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateOne] Error `, err.message);
                }
                else {                    
                    validateNotificationsWallet(transaction.userId);
                    console.log(`[${context}][updateOne]  Updated`);
                };
            });
        };
    });


};

function removeBalanceToWallet(transaction) {
    const context = "Function removeBalanceToWallet";
    console.log(`[${context}] transaction: ${JSON.stringify(transaction)}`);

    const query = {
        userId: transaction.userId,
        "transactionsList.transactionId": transaction._id
    };

    const newTransaction = {
        $set: {
            "transactionsList.$.status": transaction.status,
            "transactionsList.$.transactionType": transaction.transactionType
        }
    };


    const amountWallet = [{
        $set: {
            "amount.value": {
                $round: [{ $subtract: ["$amount.value", transaction.amount.value] }, 2]
            }
        }
    }];

    Wallet.updateOne(query, newTransaction, (err, result) => {
        if (err) {
            console.error(`[${context}][updateOne] Error `, err.message);
        }
        else {
            Wallet.updateOne(query, amountWallet, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateOne] Error `, err.message);
                }
                else {                    
                    console.log(`[${context}][updateOne]  Updated`);
                };
            });
        };
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

                resolve(result);

            };
        });
    });
};

function createNewPaymentMethod(response, userId, flag, clientName) {
    var context = "Funciton createNewPaymentMethod";
    return new Promise((resolve, reject) => {
        var query = {
            userId: userId
        };

        PaymentMethod.find(query, async (err, paymentMethodFound) => {
            if (err) {
                console.error(`[${context}][PaymentMethod.find] Error `, err.message);
                reject(err);
            }

            let paymentMethodId = response.additionalData.recurring.recurringDetailReference;

            var paymentMethod = new PaymentMethod(
                {
                    userId: userId,
                    paymentMethodId: paymentMethodId,
                    paymentMethodType: process.env.PaymentMethodCard,
                    clientName: clientName,
                    defaultPaymentMethod: true
                }
            );

            if(paymentMethodFound.length === 0){
                await addPaymentMethodFromContract(paymentMethod.paymentMethodId, userId)
            }else{
                PaymentMethod.markAllDefaultPaymentMethodFalse(userId, (err, result) => {
                    console.log(`All card set to default false, ${result}`);
                });
                const data = {
                    userId: userId,
                    paymentMethodId: paymentMethod.paymentMethodId
                };

                console.log(`[${context}][] data `, data)
                await updatePaymentMethodContract(data)
                console.log(`[${context}][] Payment Method changed`);
            }

            

            var query = {
                userId: userId,
                paymentMethodId: response.additionalData.recurring.recurringDetailReference
            };

            //console.log(`[${context}][] query `, query, dateNow)
            PaymentMethod.findOne(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][PaymentMethod.findOne] Error `, err.message);
                    reject(err);
                }

                //console.log("result", result);

                if (!result) {
                    PaymentMethod.createPaymentMethod(paymentMethod, (err, result) => {

                        if (err) {
                            console.error(`[${context}][PaymentMethod.createPaymentMethod] Error `, err.message);
                            reject(err);
                        }
                        console.log("response", response, '  flag: ', flag);
                        if (flag === 'addCard') {
                            verifyNotificationsPayments(response, userId, result);
                            // ExternalRequestHandlers.verifyBlockedRFID(userId);
                        }
                        console.log(`[${context}][PaymentMethod.createPaymentMethod] Card adyen create `);
                        resolve(true);
                    });
                } else {
                    console.log(`[${context}][PaymentMethod.createPaymentMethod] Card already exists `);
                    if (flag === process.env.TransactionTypeForce3dsAuth) {
                        verifyNotificationsPayments(response, userId, result);
                        // ExternalRequestHandlers.verifyBlockedRFID(userId);
                    }
                    resolve(false);
                };

            });


        });
    });
};

function createNewPaymentMethodAddCard(response, userId, flag, clientName) {
    var context = "Funciton createNewPaymentMethodAddCard";
    return new Promise((resolve, reject) => {
        var query = {
            userId: userId
        };

        PaymentMethod.find(query, (err, paymentMethodFound) => {

            if (err) {

                console.error(`[${context}][PaymentMethod.find] Error `, err.message);
                reject(err);

            }

            var paymentMethod = new PaymentMethod(
                {
                    userId: userId,
                    paymentMethodId: response.pspReference,
                    paymentMethodType: process.env.PaymentMethodCard,
                    clientName: clientName
                }
            );

            if (paymentMethodFound.length === 0) {

                addPaymentMethodFromContract(paymentMethod.paymentMethodId, userId);
                paymentMethod.defaultPaymentMethod = true;
                //resolve(true);

            }

            var query = {
                userId: userId,
                paymentMethodId: response.pspReference
            };

            let dateNow = new Date()

            //console.log(`[${context}][] query `, query, dateNow)
            PaymentMethod.findOne(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][PaymentMethod.findOne] Error `, err.message);
                    reject(err);
                }

                //console.log("result", result);

                if (!result) {
                    PaymentMethod.createPaymentMethod(paymentMethod, (err, result) => {

                        if (err) {

                            console.error(`[${context}][PaymentMethod.createPaymentMethod] Error `, err.message);
                            reject(err);

                        }
                        //console.log("response", response);
                        if (flag === 'addCard') {
                            verifyNotificationsPayments(response, userId, result);
                        }
                        console.log(`[${context}][PaymentMethod.createPaymentMethod] Card adyen create `);
                        resolve(true);

                    });
                } else {
                    console.log(`[${context}][PaymentMethod.createPaymentMethod] Card already exists `);
                    resolve(false);
                };

            });


        });
    });
};

function validateDefaultPaymentMethod(paymentMethods, userId) {
    var context = "Funciton validateDefaultPaymentMethod";
    return new Promise(async (resolve, reject) => {

        let paymentMethodFounds = await paymentMethodService.paymentMethodFind(userId);

        console.log("paymentMethodFounds", paymentMethodFounds);
        Promise.all(
            paymentMethods.map(paymentMethod => {
                return new Promise((resolve, reject) => {

                    var found = paymentMethodFounds.indexOf(paymentMethodFounds.find(card => {
                        return card.paymentMethodId === paymentMethod.id;
                    }));

                    if (found >= 0) {

                        paymentMethod.defaultPaymentMethod = paymentMethodFounds[found].defaultPaymentMethod;
                        paymentMethod.status = paymentMethodFounds[found].status;
                        paymentMethod.needsThreeDSAuthentication = paymentMethodFounds[found].needsThreeDSAuthentication;
                        resolve(true);

                    } else {

                        paymentMethod.defaultPaymentMethod = false;
                        paymentMethod.status = process.env.PaymentMethodStatusApproved;
                        paymentMethod.needsThreeDSAuthentication = false;
                        resolve(true);

                    };

                });
            })
        ).then(() => {

            paymentMethods.sort((x, y) => { return x.defaultPaymentMethod - y.defaultPaymentMethod });
            paymentMethods.reverse();

            resolve(paymentMethods);

        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });

    });
};

function removePaymentMethod(recurringDetailReference, userId) {
    var context = "Funciton removePaymentMethod";

    var query = {
        paymentMethodId: recurringDetailReference
    };

    PaymentMethod.removePaymentMethod(query, (err, result) => {

        if (err) {

            console.error(`[${context}][PaymentMethod.removePaymentMethod] Error `, err.message);

        }
        else {

            removePaymentMethodFromContract(recurringDetailReference, userId)
            console.log(`[${context}][PaymentMethod.removePaymentMethod] Card adyen removed `);

        };

    });

};

//removePaymentMethodFromContract('8316116505889300', '5f3a44301903e4002af2b77e');
async function removePaymentMethodFromContract(recurringDetailReference, userId) {
    var context = "Funciton removePaymentMethodFromContract";

    let listOfPaymentMethods = await paymentMethodService.paymentMethodFind(userId);
    let newPaymentMethodId;

    if (listOfPaymentMethods.length != 0) {

        var paymentMethod = listOfPaymentMethods.find(payment => {
            return payment.defaultPaymentMethod === true;
        });

        if (paymentMethod) {
            newPaymentMethodId = paymentMethod.paymentMethodId;
        }
        else {
            newPaymentMethodId = listOfPaymentMethods[0].paymentMethodId;
        }
    }
    else {
        newPaymentMethodId = "";
    };

    var headers = {
        userid: userId
    };

    var proxyIdentity = process.env.HostUser + process.env.PathupdatePaymentMethodContract;

    var data = {
        paymentMethodId: recurringDetailReference,
        newPaymentMethodId: newPaymentMethodId
    };

    axios.patch(proxyIdentity, data, { headers })
        .then(() => {
            console.log(`[${context}][${proxyIdentity}] Payment Method changed`);
        })
        .catch((error) => {
            console.error(`[${context}][${proxyIdentity}]Error `, error.message);
        });
};

function verifyIfInUseOnContract(paymentMethodId, userId) {
    var context = "Funciton verifyIfInUseOnContract";
    return new Promise((resolve, reject) => {
        try {

            let proxyIdentity = process.env.HostUser + process.env.PathGetCheckPaymentMethodContract;
            let params = {
                userId: userId,
                paymentMethod: paymentMethodId
            }

            axios.get(proxyIdentity, { params })
                .then((result) => {

                    if (result.data.length > 0) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}]Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}]Error `, error.message);
            reject(error);
        };
    });
};

async function addPaymentMethodFromContract(paymentMethodId, userId) {
    var context = "Funciton addPaymentMethodFromContract";

    var headers = {
        userid: userId
    };
    var data = {
        paymentMethodId: paymentMethodId
    };

    var proxyIdentity = process.env.HostUser + process.env.PathAddPaymentMethodContract;

    axios.patch(proxyIdentity, data, { headers })
        .then(() => {
            console.log(`[${context}][${proxyIdentity}] Payment Method changed`);
        })
        .catch((error) => {
            console.error(`[${context}][${proxyIdentity}]Error `, error.message);
        });
};

function validateFields(received) {
    var context = "Function validateFields";
    return new Promise((resolve, reject) => {

        if (!received)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!received.sessionId)
            reject({ auth: false, code: 'server_sessionId_required', message: 'Session Id is required' });

        else if (!received.paymentId)
            reject({ auth: false, code: 'server_paymentId_required', message: 'Payment Id is required' });

        else if (!received.amount)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });

        else if (!received.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency is required' });

        else if (received.amount.value === undefined || received.amount.value === "")
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else if (!received.paymentMethod)
            reject({ auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' });

        else if (!received.paymentMethod.type)
            reject({ auth: false, code: 'server_type_required', message: 'Payment method type is required' });
        /*
        else if (!received.paymentMethod.encryptedCardNumber)
            reject({ auth: false, code: 'server_encryptedCardNumber_required', message: 'Encrypted card number is required' });

        else if (!received.paymentMethod.encryptedExpiryMonth)
            reject({ auth: false, code: 'server_encryptedExpiryMonth_required', message: 'Encrypted expiry month is required' });

        else if (!received.paymentMethod.encryptedExpiryYear)
            reject({ auth: false, code: 'server_encryptedExpiryYear_required', message: 'Encrypted expiry year is required' });

        else if (!received.paymentMethod.encryptedSecurityCode)
            reject({ auth: false, code: 'server_encryptedSecurityCode_required', message: 'Encrypted security code is required' });
            */

        else
            resolve(true);

    });
};

function validateFieldsAddCard(received) {
    var context = "Function validateFieldsAddCard";
    return new Promise((resolve, reject) => {

        if (!received)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!received.paymentMethod)
            reject({ auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' });

        else if (!received.paymentMethod.type)
            reject({ auth: false, code: 'server_type_required', message: 'Payment method type is required' });

        else if (!received.paymentMethod.encryptedCardNumber)
            reject({ auth: false, code: 'server_encryptedCardNumber_required', message: 'Encrypted card number is required' });

        else if (!received.paymentMethod.encryptedExpiryMonth)
            reject({ auth: false, code: 'server_encryptedExpiryMonth_required', message: 'Encrypted expiry month is required' });

        else if (!received.paymentMethod.encryptedExpiryYear)
            reject({ auth: false, code: 'server_encryptedExpiryYear_required', message: 'Encrypted expiry year is required' });
        /*
        else if (!received.paymentMethod.encryptedSecurityCode)
            reject({ auth: false, code: 'server_encryptedSecurityCode_required', message: 'Encrypted security code is required' });
        */
        else
            resolve(true);

    });
};

function validateFieldsAddBalance(received) {
    var context = "Function validateFieldsAddBalance";
    return new Promise((resolve, reject) => {

        if (!received)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!received.amount)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });

        else if (!received.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency is required' });

        else if (!received.amount.value)
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else if (!received.paymentMethod)
            reject({ auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' });

        else if (!received.paymentMethod.type)
            reject({ auth: false, code: 'server_type_required', message: 'Payment method type is required' });

        else if (!received.paymentMethod.storedPaymentMethodId) {

            if (!received.paymentMethod.encryptedCardNumber)
                reject({ auth: false, code: 'server_encryptedCardNumber_required', message: 'Encrypted card number is required' });

            else if (!received.paymentMethod.encryptedExpiryMonth)
                reject({ auth: false, code: 'server_encryptedExpiryMonth_required', message: 'Encrypted expiry month is required' });

            else if (!received.paymentMethod.encryptedExpiryYear)
                reject({ auth: false, code: 'server_encryptedExpiryYear_required', message: 'Encrypted expiry year is required' });

            else if (!received.paymentMethod.encryptedSecurityCode)
                reject({ auth: false, code: 'server_encryptedSecurityCode_required', message: 'Encrypted security code is required' });

            else
                resolve(true);
        }

        else
            resolve(true);

    });
};

function validateFieldsValidateCard(received) {
    var context = "Function validateFieldsAddCard";
    return new Promise((resolve, reject) => {

        if (!received)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!received.paymentMethod)
            reject({ auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' });

        else if (!received.paymentMethod.type)
            reject({ auth: false, code: 'server_type_required', message: 'Payment method type is required' });

        else if (!received.paymentMethod.storedPaymentMethodId)
            reject({ auth: false, code: 'server_storedPaymentMethodId_required', message: 'Stored payment method Id is required' });

        else if (!received.paymentMethod.encryptedExpiryMonth)
            reject({ auth: false, code: 'server_encryptedExpiryMonth_required', message: 'Encrypted expiry month is required' });

        else if (!received.paymentMethod.encryptedExpiryYear)
            reject({ auth: false, code: 'server_encryptedExpiryYear_required', message: 'Encrypted expiry year is required' });

        else
            resolve(true);

    });
};

async function addCreditCard(userId, received, clientName) {
    const context = "Function addCreditCard";

    //console.log("received", received);

    let transaction = new Transactions({
        userId: userId,
        transactionType: process.env.TransactionTypeAddCard,
        status: process.env.TransactionStatusPaidOut,
        provider: process.env.PaymentMethodCard,
        clientName: clientName,
        amount: {
            value: 31,
            currency: "EUR"
        }
    });

    let transactionCreated = await createTransactions(transaction);

    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

        let body = {

            paymentMethod: received.paymentMethod,
            shopperReference: userId,
            shopperInteraction: process.env.ShopperInteractionEcommerce,
            recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId),
            storePaymentMethod: process.env.StorePaymentMethod,
            amount: {
                value: 500,
                currency: "EUR"
            },
            reference: transactionCreated._id.toString(),
            merchantAccount: adyenMerchantAccountSC,
            // captureDelayHours: 1

        };
        await forceResponseCode(userId, body)

        checkoutSC.payments(body)
            //checkout.payments(body)
            .then(async (result) => {

                // let response;

                switch (result.resultCode) {

                    case 'Authorised':

                        let response;
                        if (result.additionalData != undefined) {

                            response = {
                                amount: result.amount,
                                merchantReference: result.merchantReference,
                                pspReference: result.pspReference,
                                resultCode: result.resultCode,
                                additionalData: {
                                    recurringProcessingModel: result.additionalData.recurringProcessingModel,
                                    recurring: {
                                        shopperReference: result.additionalData['recurring.shopperReference'],
                                        recurringDetailReference: result.additionalData['recurring.recurringDetailReference'] ?? result.pspReference
                                    }
                                }
                            };
                        }
                        else {

                            response = {
                                amount: result.amount,
                                merchantReference: result.merchantReference,
                                pspReference: result.pspReference,
                                resultCode: result.resultCode
                            };
                        };

                        try {
                            let modificationsResponse = await modificationSC.cancel({
                                merchantAccount: adyenMerchantAccountSC,
                                originalReference: result.pspReference,
                                reference: {
                                    typeOfReference: process.env.ReferenceAdyenAddCard,
                                    reference: transactionCreated._id.toString()
                                }
                            });
                            response.amount.value = Math.abs(response.amount.value);

                            var newValues = {
                                $set: {
                                    amount: response.amount,
                                    adyenReference: response.additionalData.recurring.recurringDetailReference,
                                    dataReceived: modificationsResponse
                                }
                            };

                        } catch (error) {
                            console.error(`[${context}] Error `, error.message);
                        };

                        //console.log("response ", response);
                        //console.log("result ", result);

                        createNewPaymentMethod(response, userId, 'addBalance', clientName)
                            .then((values) => {

                                let body = {

                                    merchantAccount: adyenMerchantAccountSC,
                                    shopperReference: userId

                                };

                                //TODO
                                checkoutSC.paymentMethods(body)
                                    //checkout.paymentMethods(body)
                                    .then(async (paymentsResponse) => {

                                        if (values) {
                                            if (paymentsResponse.storedPaymentMethods != undefined) {

                                                //console.log("paymentsResponse", paymentsResponse);

                                                validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                    .then(async (paymentMethods) => {

                                                        let query = {
                                                            _id: transactionCreated._id.toString()
                                                        };
                                                        // let data = {

                                                        //     merchantAccount: adyenMerchantAccountSC,
                                                        //     originalReference: result.pspReference,
                                                        //     reference: {

                                                        //         typeOfReference: process.env.ReferenceAdyenAddCard,
                                                        //         reference: transactionCreated._id.toString()

                                                        //     }

                                                        // };
                                                        // let newValues;
                                                        // try {

                                                        //     //TODO
                                                        //     let modificationsResponse = await modificationSC.cancel(data);
                                                        //     //let modificationsResponse = await modification.cancel(data);

                                                        //     response.amount.value = Math.abs(response.amount.value);

                                                        //     newValues = {
                                                        //         $set: {
                                                        //             amount: response.amount,
                                                        //             adyenReference: response.additionalData.recurring.recurringDetailReference,
                                                        //             //status: process.env.TransactionStatusCanceled,
                                                        //             dataReceived: modificationsResponse
                                                        //         }
                                                        //     };
                                                        //     //let result = await transactionsUpdate(query, newValues)

                                                        // } catch (error) {

                                                        //     console.error(`[${context}] Error `, error.message);

                                                        // };


                                                        /*
                                                        let newValues = {
                                                            $set: {
                                                                amount: response.amount,
                                                                adyenReference: response.additionalData.recurring.recurringDetailReference
                                                            }
                                                        };*/

                                                        let transactionUpdated = await transactionsUpdate(query, newValues);


                                                        paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                                        console.log(`[${context}][validateDefaultPaymentMethod] Card Add`)

                                                    })
                                                    .catch((error) => {

                                                        console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);


                                                    });


                                            }

                                        }
                                        else {
                                            console.log(`[${context}][checkoutSC.paymentMethods] Card already exists`);

                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);


                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);

                            });

                        break;

                    case 'Refused':

                        console.error(`[${context}][checkoutSC.payments][Refused] Error `, result);

                        break;

                    case 'Cancelled':

                        console.error(`[${context}][checkoutSC.payments][Cancelled] Error `, result);

                        break;

                    default:

                        console.error(`[${context}][checkoutSC.payments] Error `, result);

                        break;

                };

            })
            .catch((error) => {

                console.error(`[${context}][checkoutSC.payments] Error `, error.message);

            });
    } else {

        let body = {

            paymentMethod: received.paymentMethod,
            shopperReference: userId,
            shopperInteraction: process.env.ShopperInteractionEcommerce,
            recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId),
            storePaymentMethod: process.env.StorePaymentMethod,
            amount: {
                value: 500,
                currency: "EUR"
            },
            reference: transactionCreated._id.toString(),
            merchantAccount: adyenMerchantAccount

        };
        await forceResponseCode(userId, body)

        checkout.payments(body)
            .then(async (result) => {

                let response;
                switch (result.resultCode) {

                    case 'Authorised':
                        if (result.additionalData != undefined) {

                            response = {

                                amount: result.amount,
                                merchantReference: result.merchantReference,
                                pspReference: result.pspReference,
                                resultCode: result.resultCode,
                                additionalData: {
                                    recurringProcessingModel: result.additionalData.recurringProcessingModel,
                                    recurring: {
                                        shopperReference: result.additionalData['recurring.shopperReference'],
                                        recurringDetailReference: result.additionalData['recurring.recurringDetailReference'] ?? result.pspReference
                                    }
                                }
                            };
                        }
                        else {

                            response = {

                                amount: result.amount,
                                merchantReference: result.merchantReference,
                                pspReference: result.pspReference,
                                resultCode: result.resultCode
                            };
                        };

                        //console.log("response ", response);
                        //console.log("result ", result);

                        createNewPaymentMethod(response, userId, 'addBalance', clientName)
                            .then((values) => {

                                let body = {

                                    merchantAccount: adyenMerchantAccount,
                                    shopperReference: userId

                                };

                                checkout.paymentMethods(body)
                                    .then(async (paymentsResponse) => {

                                        if (values) {
                                            if (paymentsResponse.storedPaymentMethods != undefined) {

                                                //console.log("paymentsResponse", paymentsResponse);

                                                validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                                    .then(async (paymentMethods) => {

                                                        let query = {
                                                            _id: transactionCreated._id.toString()
                                                        };
                                                        let data = {

                                                            merchantAccount: adyenMerchantAccount,
                                                            originalReference: result.pspReference,
                                                            reference: {

                                                                typeOfReference: process.env.ReferenceAdyenAddCard,
                                                                reference: transactionCreated._id.toString()

                                                            }

                                                        };
                                                        let newValues
                                                        try {

                                                            let modificationsResponse = await modification.cancel(data);

                                                            response.amount.value = Math.abs(response.amount.value);

                                                            newValues = {
                                                                $set: {
                                                                    amount: response.amount,
                                                                    adyenReference: response.additionalData.recurring.recurringDetailReference,
                                                                    //status: process.env.TransactionStatusCanceled,
                                                                    dataReceived: modificationsResponse
                                                                }
                                                            };
                                                            //let result = await transactionsUpdate(query, newValues)

                                                        } catch (error) {

                                                            console.error(`[${context}] Error `, error.message);

                                                        };


                                                        /*
                                                        let newValues = {
                                                            $set: {
                                                                amount: response.amount,
                                                                adyenReference: response.additionalData.recurring.recurringDetailReference
                                                            }
                                                        };*/

                                                        let transactionUpdated = await transactionsUpdate(query, newValues);


                                                        paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                                        console.log(`[${context}][validateDefaultPaymentMethod] Card Add`)

                                                    })
                                                    .catch((error) => {

                                                        console.error(`[${context}][validateDefaultPaymentMethod] Error `, error.message);


                                                    });


                                            }

                                        }
                                        else {
                                            console.log(`[${context}][checkout.paymentMethods] Card already exists`);

                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][checkout.paymentMethods] Error `, error.message);


                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);

                            });


                        break;

                    case 'Refused':

                        console.error(`[${context}][checkout.payments][Refused] Error `, result);

                        break;

                    case 'Cancelled':

                        console.error(`[${context}][checkout.payments][Cancelled] Error `, result);

                        break;

                    default:

                        console.error(`[${context}][checkout.payments] Error `, result);

                        break;

                };

            })
            .catch((error) => {

                console.error(`[${context}][checkout.payments] Error `, error.message);

            });
    };

};

function sendEmailTopUpBilling(transaction) {
    var context = "Function sendEmailTopUpBilling";

    var proxyBilling = process.env.HostBilling + process.env.PathTopUpEmail;

    var headers = {
        userId: transaction.userId,
        clientName: transaction.clientName
    };

    var data = {
        headers: headers,
        payment: transaction.amount.value,
        currency: transaction.amount.currency,
        transactionId: transaction._id
    };

    console.log("data", data)

    axios.post(proxyBilling, data)
        .then((result) => {
            console.log(`[${context}] `, result.data.message);
        })
        .catch((error) => {
            console.error(`[${context}] Error`, error.message);
        });
};

async function sendBillingDocument_old(paymentFound) {
    var context = "Function sendBillingDocument";
    // return new Promise((resolve, reject) => {
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

                    var payments = {
                        payment: paymentFound.totalPrice.excl_vat,//paymentFound.dataReceived.amount.value,
                        currency: paymentFound.amount.currency, //paymentFound.dataReceived.amount.currency,
                        paymentRef: paymentFound._id,//dataReceived.reference,
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
                            //resolve(result.data)
                        })
                        .catch((error) => {
                            console.error(`[${context}][axiso.post] Error `, error.message);
                            updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
                            //reject(error)
                        });

                })
                .catch((error) => {
                    console.error(`[${context}][getChargerIva] Error `, error.message);
                    updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
                    //reject(error)
                })

            //var dataReceived = JSON.parse(paymentFound.dataReceived.merchantReference);
        } else {
            console.log(`[${context}] Monthly Billing `);
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
        //reject(error)
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

        var proxyBilling = process.env.HostBilling + process.env.PathBillingDocument;

        let data = await Invoices.createInvoiceDate(paymentFound);

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

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
        //reject(error);
    };
    //})
};

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
                console.log("Invoice updated");
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

function removeObject(body) {
    var context = "Function removeObject";
    return new Promise((resolve, reject) => {
        if (body) {
            if (body.transactionsList) {
                Promise.all(
                    body.transactionsList.map(transaction => {
                        return new Promise((resolve, reject) => {


                            if (transaction.transaction.dataReceived != undefined) {

                                if (transaction.transaction.dataReceived['additionalData.authCode']) {

                                    transaction.transaction.dataReceived.additionalData = {
                                        authCode: transaction.transaction.dataReceived['additionalData.authCode']
                                    };

                                    delete transaction.transaction.dataReceived['additionalData.authCode']
                                    resolve(true);

                                }
                                if (transaction.transaction.dataReceived['additionalData.expiryDate']) {

                                    transaction.transaction.dataReceived.additionalData = {

                                        expiryDate: transaction.transaction.dataReceived['additionalData.expiryDate']
                                    };

                                    delete transaction.transaction.dataReceived['additionalData.expiryDate'];
                                    resolve(true);

                                }
                                if (transaction.transaction.dataReceived['additionalData.cardSummary']) {

                                    transaction.transaction.dataReceived.additionalData = {
                                        cardSummary: transaction.transaction.dataReceived['additionalData.cardSummary']
                                    };

                                    delete transaction.transaction.dataReceived['additionalData.cardSummary'];
                                    resolve(true);

                                }
                                if (transaction.transaction.dataReceived['additionalData.threeds2.cardEnrolled']) {

                                    var threeds2 = {
                                        cardEnrolled: transaction.transaction.dataReceived['additionalData.threeds2.cardEnrolled']
                                    };
                                    transaction.transaction.dataReceived.additionalData = {
                                        threeds2: threeds2
                                    };
                                    delete transaction.transaction.dataReceived['additionalData.threeds2.cardEnrolled'];
                                    resolve(true);
                                }
                                if (transaction.transaction.dataReceived['additionalData.recurringProcessingModel']) {
                                    transaction.transaction.dataReceived.additionalData.recurringProcessingModel = transaction.transaction.dataReceived['additionalData.recurringProcessingModel'];
                                    delete transaction.transaction.dataReceived['additionalData.recurringProcessingModel'];
                                    resolve(true);
                                }
                                else {
                                    resolve(true);
                                };
                            }
                            else {
                                resolve(true);
                            };

                        });
                    })
                ).then(() => {
                    if (body.transaction != undefined) {
                        if (body.transaction.dataReceived != undefined) {
                            if (body.transaction.dataReceived['additionalData.recurringProcessingModel']) {
                                body.transaction.recurringProcessingModel = body.transaction.dataReceived['additionalData.recurringProcessingModel'];
                                delete body.transaction.dataReceived['additionalData.recurringProcessingModel']
                            }
                        }
                    }
                    if (body.payment != undefined) {
                        if (body.payment.dataReceived != undefined) {
                            if (body.payment.dataReceived['additionalData.recurringProcessingModel']) {
                                body.payment.recurringProcessingModel = body.payment.dataReceived['additionalData.recurringProcessingModel'];
                                delete body.payment.dataReceived['additionalData.recurringProcessingModel'];
                            }
                        }
                    }
                    if (body['additionalData.recurringProcessingModel']) {

                        body.recurringProcessingModel = body['additionalData.recurringProcessingModel'];
                        delete body['additionalData.recurringProcessingModel'];
                    }
                    if (body.dataReceived != undefined) {
                        if (body.dataReceived['additionalData.recurringProcessingModel']) {

                            body.dataReceived.recurringProcessingModel = body.dataReceived['additionalData.recurringProcessingModel'];
                            delete body.dataReceived['additionalData.recurringProcessingModel'];
                        }
                    }
                    resolve(body);
                });
            }
            else {
                if (body.dataReceived != undefined) {
                    if (body.dataReceived['additionalData.recurringProcessingModel']) {

                        body.dataReceived.recurringProcessingModel = body.dataReceived['additionalData.recurringProcessingModel'];
                        delete body.dataReceived['additionalData.recurringProcessingModel'];
                    }
                }
                if (body.transaction != undefined) {
                    if (body.transaction.dataReceived != undefined) {
                        if (body.transaction.dataReceived['additionalData.recurringProcessingModel']) {
                            body.transaction.recurringProcessingModel = body.transaction.dataReceived['additionalData.recurringProcessingModel'];
                            delete body.transaction.dataReceived['additionalData.recurringProcessingModel']
                        }
                    }
                }
                if (body.payment != undefined) {
                    if (body.payment.dataReceived != undefined) {
                        if (body.payment.dataReceived['additionalData.recurringProcessingModel']) {
                            body.payment.recurringProcessingModel = body.payment.dataReceived['additionalData.recurringProcessingModel'];
                            delete body.payment.dataReceived['additionalData.recurringProcessingModel'];
                        }
                    }
                }
                if (body['additionalData.recurringProcessingModel']) {

                    body.recurringProcessingModel = body['additionalData.recurringProcessingModel'];
                    delete body['additionalData.recurringProcessingModel'];
                }
                if (body['additionalData.visaTemplate']) {
                    body.visaTemplate = body['additionalData.visaTemplate'];
                    delete body['additionalData.visaTemplate'];
                }

                if (body['additionalData.scaExemptionRequested']) {
                    body.scaExemptionRequested = body['additionalData.scaExemptionRequested'];
                    delete body['additionalData.scaExemptionRequested'];
                }
                resolve(body);
            };
        } else {
            resolve(body);
        }
    });
};

async function removeObjectReqBody(body) {
    var context = "Function removeObject";
    return new Promise((resolve, reject) => {

        body = JSON.parse(JSON.stringify(body));
        if (!body.additionalData) {
            body.additionalData = {}
        }
        const recurringDetailReference = body['additionalData.recurring.recurringDetailReference'] ?? body.pspReference
        if (recurringDetailReference) {
            body.additionalData.recurringDetailReference = recurringDetailReference;
            delete body['additionalData.recurring.recurringDetailReference'];
            delete body.pspReference
        }

        if (body['additionalData.recurring.shopperReference']) {
            body.additionalData.shopperReference = body['additionalData.recurring.shopperReference'];
            delete body['additionalData.recurring.shopperReference'];
        }

        if (body['additionalData.recurringProcessingModel']) {

            body.recurringProcessingModel = body['additionalData.recurringProcessingModel'];
            delete body['additionalData.recurringProcessingModel'];
        }

        if (body['additionalData. NAME1 ']) {
            body.additionalData.name1 = body['additionalData. NAME1 '];
            delete body['additionalData. NAME1 '];
        }

        if (body['additionalData.totalFraudScore']) {
            body.additionalData.totalFraudScore = body['additionalData.totalFraudScore'];
            delete body['additionalData.totalFraudScore'];
        }

        if (body['additionalData.fraudCheck-6-ShopperIpUsage']) {
            body.additionalData.fraudCheck6ShopperIpUsage = body['additionalData.fraudCheck-6-ShopperIpUsage'];
            delete body['additionalData.fraudCheck-6-ShopperIpUsage'];
        }

        if (body['additionalData.NAME2']) {
            body.additionalData.NAME2 = body['additionalData.NAME2'];
            delete body['additionalData.NAME2'];
        }

        if (body['additionalData.recurringProcessingModel']) {

            body.recurringProcessingModel = body['additionalData.recurringProcessingModel'];
            delete body['additionalData.recurringProcessingModel'];
        }

        if (body['additionalData.visaTemplate']) {
            body.visaTemplate = body['additionalData.visaTemplate'];
            delete body['additionalData.visaTemplate'];
        }

        if (body['additionalData.scaExemptionRequested']) {
            body.scaExemptionRequested = body['additionalData.scaExemptionRequested'];
            delete body['additionalData.scaExemptionRequested'];
        }

        resolve(body);
    });
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

function updateWalletOnChargingSession(data) {
    var context = "Function updateWalletOnChargingSession";

    var host = process.env.HostCharger + process.env.PathUpdateWalletOnChargingSession;

    axios.patch(host, data)
        .then((result) => {
            console.log(`[${context}] Updated `);
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error);
        });

};

function paymentMethodAddBrand(creditCardGroups, response, storedPaymentMethods, userId) {
    const context = "Function paymentMethodAddBrand";

    try {

        var paymentMethodId = response.additionalData.recurring.recurringDetailReference;

        if (!paymentMethodId) {
            paymentMethodId = response.pspReference;
        }
        /*
        console.log("response", response);
        console.log("paymentMethodId", paymentMethodId);
        console.log("creditCardGroups", creditCardGroups);
        console.log("storedPaymentMethods", storedPaymentMethods);
        */

        var creditCardBrand = creditCardGroups ? creditCardGroups.find(group => {
            return group.name === process.env.CreditCardGroupsName;
        }) : null;

        var newPaymentMethod = storedPaymentMethods.find(paymentMethod => {
            return paymentMethod.id === paymentMethodId;
        });

        var foundCreditCard = creditCardBrand && newPaymentMethod ? creditCardBrand.brands.find(cardBrand => {
            return cardBrand === newPaymentMethod.brand;
        }) : null;

        let newValues;

        if (foundCreditCard) {
            newValues = {
                $set: {
                    cardBrand: newPaymentMethod.brand,
                    creditCard: true
                }
            };
        }
        else {
            newValues = {
                $set: {
                    cardBrand: newPaymentMethod.brand,
                    creditCard: false
                }
            };
        };


        var query = {
            paymentMethodId: paymentMethodId
        };

        PaymentMethod.updatePaymentMethod(query, newValues, (err, result) => {

            if (err) {

                console.error(`[${context}][PaymentMethod.createPaymentMethod] Error `, err.message);

            }
            else {
                // verifyNotificationsPayments(response, userId);
                // ExternalRequestHandlers.verifyBlockedRFID(userId);
                console.log(`[${context}][PaymentMethod.createPaymentMethod] Update adyen create `);

            };

        });
    } catch (error) {
        console.error(`[${context}][] Error `, error.message);
    };

};

//validateNotificationsWallet('5f3a44301903e4002af2b77e');
function validateNotificationsWallet(userId) {
    var context = "Function validateNotificationsWallet";
    try {
        var query = {
            userId: userId,
            //paymentMethod: process.env.PaymentMethodWallet,
            active: true
        };

        NotificationsPayments.find(query, async (err, notificationsFound) => {

            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                //console.log("notificationsFound", notificationsFound);
                if (notificationsFound.length > 0) {

                    Promise.all(
                        notificationsFound.map(notification => {
                            return new Promise(async (resolve, reject) => {
                                var query = {
                                    _id: notification.paymentId
                                };

                                let payment = await paymentFindOne(query);

                                makePaymentWallet(payment)
                                    .then((result) => {

                                        NotificationsPayments.updateNotificationsPayments({ _id: notification._id }, { $set: { active: false } }, (err, result) => {
                                            if (err) {

                                                console.error(`[${context}][updateNotificationsPayments] Error `, err.message);
                                                reject(err);

                                            }
                                            else {
                                                resolve(true);
                                            };

                                        });

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][makePaymentWallet] Error `, error.message);
                                        reject(error);

                                    });
                            });

                        })
                    ).then((result) => {

                        var query = {
                            userId: userId,
                            active: true
                        };

                        NotificationsPayments.find(query, async (err, notificationsFound) => {
                            if (err) {

                                console.error(`[${context}][find] Error `, err.message);

                            };

                            let walletFound = await Wallet.findOne({ userId: userId });

                            if (walletFound.amount.value >= 20) {
                                ExternalRequestHandlers.verifyBlockedRFID(userId);
                            };

                            if (notificationsFound.length === 0) {
                                activateContracts(userId);
                            };

                        });

                    }).catch((error) => {

                        console.error(`[${context}][] Error `, error.message);

                    });

                } else {
                    let walletFound = await Wallet.findOne({ userId: userId });

                    if (walletFound.amount.value >= 20) {
                        ExternalRequestHandlers.verifyBlockedRFID(userId);
                    };
                }

            };

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

function makePaymentWallet(payment) {
    var context = "Function makePaymentWallet";
    return new Promise(async (resolve, reject) => {
        try {

            let queryTransaction
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
                        paymentId: payment._id

                    }
                );

                let transactionCreated = await createTransactions(newTransaction);

                //Query to transaction
                queryTransaction = {
                    _id: transactionCreated._id
                };

            }
            else {

                queryTransaction = {
                    _id: payment.transactionId
                };

            };

            var transaction = {
                $set: {
                    status: process.env.TransactionStatusPaidOut,
                    data: process.env.ReasonSuccessBalance,
                    provider: process.env.PaymentMethodWallet
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
                    removeBalanceFromWallet(result)
                        .then((value) => {

                            if (value) {

                                var newValuesPayments = {
                                    $set: {
                                        status: process.env.TransactionStatusPaidOut,
                                        reason: process.env.ReasonSuccessBalance,
                                        transactionId: result._id,

                                        paymentMethod: process.env.PaymentMethodWallet,
                                        paymentMethod: process.env.PaymentMethodWallet
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
                                                transactionId: result._id,
                                                paymentMethod: process.env.PaymentMethodWallet,
                                                paymentMethod: process.env.PaymentMethodWallet
                                            }
                                        };

                                        //Update payment
                                        paymentUpdate(queryPayment, newValuesPayments)
                                            .then(async (paymentsUpdated) => {

                                                let response = await paymentFindOne(queryPayment);

                                                reject(response);

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
                    console.error(`[${context}][transactionsUpdate] Error 1`, error);
                    reject(error);

                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
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

function removeBalanceFromWallet(transaction) {
    var context = "Function removeBalanceFromWallet";
    return new Promise(async (resolve, reject) => {
        console.log(`[${context}] transaction: ${JSON.stringify(transaction)}`);

        let wallet = await walletFindOne({ userId: transaction.userId });

        //console.log("transaction", transaction);
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
                    }
                };

                const amountWallet = [{
                    $set: {
                        "amount.value": {
                            $round: [{ $subtract: ["$amount.value", transaction.amount.value] }, 2]
                        }
                    }
                }];

                Wallet.updateOne(query, newTransaction, (err, result) => {
                    if (err) {
                        console.error(`[${context}][updateOne] Error `, err.message);
                        reject(err);
                    }
                    else {
                        Wallet.updateOne(query, amountWallet, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateOne] Error `, err.message);
                                reject(err);
                            }
                            else {                    
                                console.log(`[${context}][updateOne]  Updated`);
                                resolve(true);
                            };
                        });

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

            //console.log("Found", found);
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
                    }
                };

                const amountWallet = [{
                    $set: {
                        "amount.value": {
                            $round: [{ $subtract: ["$amount.value", transaction.amount.value] }, 2]
                        }
                    }
                }];

                Wallet.addTansationsList(query, newTransaction, (err, result) => {
                    if (err) {
                        console.error(`[${context}][updateOne] Error `, err.message);
                        reject(err);
                    }
                    else {
                        Wallet.updateOne(query, amountWallet, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateOne] Error `, err.message);
                                reject(err);
                            }
                            else {                    
                                console.log(`[${context}][updateOne]  Updated`);
                                resolve(true);
                            };
                        });
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

function validateNotificationsCard(paymentFound) {

    var context = "Funciton walletFindOne";

    var query = {
        userId: paymentFound.userId,
        //paymentMethod: process.env.PaymentMethodCard,
        paymentId: paymentFound._id,
        sessionId: paymentFound.sessionId,
        transactionId: paymentFound.transactionId,
        active: true
    };

    var newValues = {
        $set: {
            active: false,
            paymentMethod: process.env.PaymentMethodCard
        }
    };

    NotificationsPayments.updateNotificationsPayments(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][updateNotificationsPayments] Error `, err.message);
        }
        else {

            var query = {
                userId: paymentFound.userId,
                active: true
            };

            NotificationsPayments.find(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][NotificationsPayments.find] Error `, err.message);
                }
                else {
                    if (result.length === 0) {
                        activateContracts(paymentFound.userId)
                    };
                };
            });
            console.log(`[${context}][updateNotificationsPayments] Notification updated!`);
        };
    });

};

function getChargingSessions(recurringDetailReference) {
    var context = "Funciton walletFindOne";
    return new Promise((resolve, reject) => {

        var proxyChargingSession = process.env.HostCharger + process.env.PathGetCheckPaymentMethod;

        var params = {
            paymentMethodId: recurringDetailReference
        };

        axios.get(proxyChargingSession, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error);
                reject(error);
            });

    });
};

function verifyNotificationsPayments_old(paymentMethods, userId) {
    let context = "Funciton verifyNotificationsPayments";

    let paymentMethodId = paymentMethods.additionalData.recurring.recurringDetailReference;

    let query = {
        active: true,
        //paymentMethod: process.env.PaymentMethodCard,
        userId: userId
    };

    console.log(`[${context}]`);

    NotificationsPayments.find(query, (err, notificationPaymentsFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        if (notificationPaymentsFound.length > 0) {

            notificationPaymentsFound.map(async notification => {

                console.log(`[${context}]`, notification);
                let payment = await paymentUpdate({ _id: notification.paymentId }, { $set: { paymentMethodId: paymentMethodId } });

                if (payment) {
                    let data = {
                        paymentId: payment._id,
                        sessionId: payment.sessionId,
                        amount: payment.amount,
                        paymentMethod: {
                            type: "scheme",
                            storedPaymentMethodId: paymentMethodId
                        },
                        transactionId: payment.transactionId
                    };

                    makePaymentCardNotifications(data, userId, notification.clientName)
                        .then((result) => {
                            console.log(`[${context}] Payment in process `);
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                        });

                };

            });

        };
    });

};

async function verifyNotificationsPayments(paymentMethods, userId, result) {
    let context = "Funciton verifyNotificationsPayments";
    try {

        let paymentMethodId = paymentMethods.additionalData.recurring.recurringDetailReference;

        let query = {
            active: true,
            //paymentMethod: process.env.PaymentMethodCard,
            userId: userId
        };

        let notificationPaymentsFound = await NotificationsPayments.find(query);

        console.log(context, ', notificationPaymentsFound: ', notificationPaymentsFound)

        let notificationsResponse = [];

        if (notificationPaymentsFound.length > 0) {

            notificationPaymentsFound.forEach(async notification => {
                notificationsResponse.push(makePaymentCardAsync(notification, result));
            })

            Promise.all(notificationsResponse)
                .then(async (result) => {
                    try {
                        if (notificationPaymentsFound.length === result.length) {

                            let query = {
                                userId: userId,
                                active: true
                            };

                            let notificationsFound = await NotificationsPayments.find(query);
                            if (notificationsFound.length === 0) {
                                console.log(`[${context}] Contracts activated`);
                                activateContracts(userId);
                            };
                        };
                    } catch (error) {
                        console.error(`[${context}] Error `, error.message);
                    };
                })
                .catch(error => {
                    console.error(`[${context}] Error `, error.message);
                });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

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

function adjustmentPreAuthorize(body, clientName) {
    var context = "Funciton walletFindOne";
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

async function updateChargingSession(queryPayments) {
    var context = "Funciton updateChargingSession";

    try {

        let payment = await paymentFindOne(queryPayments);

        if (payment.paymentType === process.env.PaymentTypeAD_HOC) {

            if (
                payment.chargerType === process.env.MobieCharger ||
                payment.chargerType === Enums.ChargerTypes.Gireve ||
                payment.chargerType === Enums.ChargerTypes.Hubject
            ) {
                updateSessionMobiE(payment);
            } else {
                updateSessionEVIO(payment);
            };

        }
        else {

            updateSessions(payment);

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

function updateSessionEVIO(payment) {
    var context = "Function updateSessionEVIO";
    try {

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

function updateSessionMobiE(payment) {
    var context = "Function updateSessionMobiE";
    try {

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

function cancelTransactionAdyen(result) {
    var context = "Funciton walletFindOne";
    return new Promise((resolve, reject) => {

        //console.log("result", result);

    });
};

var taskCards = null;

initJogCheckValidaCardDate('0 01 01 * *')
    .then(() => {
        taskCards.start();
        console.log("Validate card date Job Started")
    })
    .catch(error => {
        console.log("Error starting validate card date Job: " + error.message)
    });

function initJogCheckValidaCardDate(timer) {
    return new Promise((resolve, reject) => {

        taskCards = cron.schedule(timer, () => {
            console.log('Running Job validate card date: ' + new Date().toISOString());


            checkValidateCard();
        }, {
            scheduled: false
        });

        resolve();

    });
};

//checkValidateCard();
function checkValidateCard_old() {
    let context = "Function checkValidateCard";
    try {

        PaymentMethod.find({}, { "userId": "$userId", "_id": 0 }, (err, paymentMethodsFound) => {

            if (err) {

                console.error(`[${context}] Error `, err.message);

            } else {

                if (paymentMethodsFound.length > 0) {

                    let dateNow = new Date();

                    let month = dateNow.getMonth();
                    let year = dateNow.getFullYear();

                    //console.log("month",month);
                    //console.log("year",year);

                    if (month + 1 < 10) {
                        month += 1
                        month = "0" + month;
                    };

                    /*
                    month = "04";
                    year = "2030";

                    */
                    //console.log("typeof Full year", typeof year);
                    //console.log("typeof month", typeof month);
                    //console.log("Full year", year);
                    //console.log("month", month);

                    paymentMethodsFound.forEach(paymentMethod => {

                        let body = {

                            merchantAccount: adyenMerchantAccount,
                            shopperReference: paymentMethod.userId

                        };

                        let clientName = paymentMethod.clientName;

                        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                            body.merchantAccount = adyenMerchantAccountSC;

                            //TODO
                            checkoutSC.paymentMethods(body)
                                //checkout.paymentMethods(body)
                                .then(async (paymentsResponse) => {

                                    if (paymentsResponse) {


                                        if (paymentsResponse.storedPaymentMethods) {
                                            if (paymentsResponse.storedPaymentMethods.length > 0) {

                                                let expiredCard = paymentsResponse.storedPaymentMethods.filter(paymentMethodFound => {

                                                    if (paymentMethodFound.expiryYear < year) {

                                                        return paymentMethodFound;

                                                    } else if (paymentMethodFound.expiryMonth < month && paymentMethodFound.expiryYear == year) {

                                                        return paymentMethodFound;

                                                    };

                                                });


                                                let expiredMonthCard = paymentsResponse.storedPaymentMethods.filter(paymentMethodFound => {

                                                    return paymentMethodFound.expiryMonth == month && paymentMethodFound.expiryYear == year;

                                                });

                                                //console.log("expiredCard", expiredCard.length);
                                                //console.log("expiredMonthCard", expiredMonthCard.length);

                                                if (expiredCard.length > 0) {

                                                    expiredCard.forEach(card => {

                                                        PaymentMethod.updatePaymentMethod({ paymentMethodId: card.id, status: { $ne: process.env.PaymentMethodStatusExpired } }, { $set: { status: process.env.PaymentMethodStatusExpired } }, (err, cardResult) => {

                                                            if (err) {

                                                                console.error(`[${context}] Error `, err.message);

                                                            };

                                                            console.log("Card Updated");

                                                        });

                                                    });

                                                };

                                                if (expiredMonthCard.length > 0) {

                                                    expiredMonthCard.forEach(card => {

                                                        PaymentMethod.updatePaymentMethod({ paymentMethodId: card.id, status: { $ne: process.env.PaymentMethodStatusExpiredMonth } }, { $set: { status: process.env.PaymentMethodStatusExpiredMonth } }, (err, cardResult) => {

                                                            if (err) {

                                                                console.error(`[${context}] Error `, err.message);

                                                            };

                                                            console.log("Card Updated");

                                                        });

                                                    });

                                                };

                                            };
                                        };

                                    };

                                })
                                .catch((error) => {

                                    console.error(`[${context}][checkoutSC.paymentMethods] Error `, error.message);

                                });

                        } else {
                            checkout.paymentMethods(body)
                                .then(async (paymentsResponse) => {

                                    if (paymentsResponse) {


                                        if (paymentsResponse.storedPaymentMethods) {
                                            if (paymentsResponse.storedPaymentMethods.length > 0) {

                                                let expiredCard = paymentsResponse.storedPaymentMethods.filter(paymentMethodFound => {

                                                    if (paymentMethodFound.expiryYear < year) {

                                                        return paymentMethodFound;

                                                    } else if (paymentMethodFound.expiryMonth < month && paymentMethodFound.expiryYear == year) {

                                                        return paymentMethodFound;

                                                    };

                                                });


                                                let expiredMonthCard = paymentsResponse.storedPaymentMethods.filter(paymentMethodFound => {

                                                    return paymentMethodFound.expiryMonth == month && paymentMethodFound.expiryYear == year;

                                                });

                                                //console.log("expiredCard", expiredCard.length);
                                                //console.log("expiredMonthCard", expiredMonthCard.length);

                                                if (expiredCard.length > 0) {

                                                    expiredCard.forEach(card => {

                                                        PaymentMethod.updatePaymentMethod({ paymentMethodId: card.id, status: { $ne: process.env.PaymentMethodStatusExpired } }, { $set: { status: process.env.PaymentMethodStatusExpired } }, (err, cardResult) => {

                                                            if (err) {

                                                                console.error(`[${context}] Error `, err.message);

                                                            };

                                                            console.log("Card Updated");

                                                        });

                                                    });

                                                };

                                                if (expiredMonthCard.length > 0) {

                                                    expiredMonthCard.forEach(card => {

                                                        PaymentMethod.updatePaymentMethod({ paymentMethodId: card.id, status: { $ne: process.env.PaymentMethodStatusExpiredMonth } }, { $set: { status: process.env.PaymentMethodStatusExpiredMonth } }, (err, cardResult) => {

                                                            if (err) {

                                                                console.error(`[${context}] Error `, err.message);

                                                            };

                                                            console.log("Card Updated");

                                                        });

                                                    });

                                                };

                                            };
                                        };

                                    };

                                })
                                .catch((error) => {

                                    console.error(`[${context}][checkout.paymentMethods] Error `, error.message);

                                });
                        };

                    });

                };

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

async function checkValidateCard() {
    let context = "Function checkValidateCard";
    try {


        let paymentMethodsFound = await PaymentMethod.find({}, { "userId": "$userId", "_id": 0 });

        if (paymentMethodsFound.length > 0) {

            let dateNow = new Date();

            let month = dateNow.getMonth();
            //Adyen changed expiry year from 2023 to 23
            let year = dateNow.getFullYear() - 2000

            //console.log("month",month);
            //console.log("year",year);

            if (month + 1 < 10) {
                month += 1
                month = "0" + month;
            };


            paymentMethodsFound.forEach(async paymentMethod => {

                let clientName = paymentMethod.clientName;
                if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
                    let body = {
                        merchantAccount: adyenMerchantAccountSC,
                        shopperReference: paymentMethod.userId

                    };

                    let paymentsResponse = await checkoutSC.paymentMethods(body);

                    if (paymentsResponse) {
                        checkValidateCardResponse(paymentsResponse, dateNow, month, year)
                    };

                } else {
                    let body = {
                        merchantAccount: adyenMerchantAccount,
                        shopperReference: paymentMethod.userId

                    };

                    let paymentsResponse = await checkout.paymentMethods(body);

                    if (paymentsResponse) {
                        checkValidateCardResponse(paymentsResponse, dateNow, month, year)
                    };

                };

            });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
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

function updatePaymentMethodContract(data) {
    const context = "Function updatePaymentMethodContract";
    try {

        let host = process.env.HostUser + process.env.PathEditPaymentMethodContract;
        console.log(`-------------- host`)
        axios.put(host, data)
            .then((result) => {

                console.log("Contracts updated");

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

async function updateContract(payment) {
    const context = "Function updateContract";
    try {
        let host = process.env.HostUser + process.env.PathUpdatePaymentContract;
        let data = payment;
        let response = await axios.patch(host, data);

        console.log("Contract Updated")

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

async function checkValidateCardResponse(paymentsResponse, dateNow, month, year) {
    let context = "Function checkValidateCardResponse";
    try {

        if (paymentsResponse.storedPaymentMethods) {
            if (paymentsResponse.storedPaymentMethods.length > 0) {

                let expiredCard = paymentsResponse.storedPaymentMethods.filter(paymentMethodFound => {

                    if (paymentMethodFound.expiryYear < year) {

                        return paymentMethodFound;

                    } else if (paymentMethodFound.expiryMonth < month && paymentMethodFound.expiryYear == year) {

                        return paymentMethodFound;

                    };

                });

                let expiredMonthCard = paymentsResponse.storedPaymentMethods.filter(paymentMethodFound => {

                    return paymentMethodFound.expiryMonth == month && paymentMethodFound.expiryYear == year;

                });

                if (expiredCard.length > 0) {

                    expiredCard.forEach(card => {

                        PaymentMethod.updatePaymentMethod({ paymentMethodId: card.id, status: { $ne: process.env.PaymentMethodStatusExpired } }, { $set: { status: process.env.PaymentMethodStatusExpired } }, (err, cardResult) => {

                            if (err) {

                                console.error(`[${context}] Error `, err.message);

                            };

                            console.log("Card Updated");

                        });

                    });

                };

                if (expiredMonthCard.length > 0) {

                    expiredMonthCard.forEach(card => {

                        PaymentMethod.updatePaymentMethod({ paymentMethodId: card.id, status: { $ne: process.env.PaymentMethodStatusExpiredMonth } }, { $set: { status: process.env.PaymentMethodStatusExpiredMonth } }, (err, cardResult) => {

                            if (err) {

                                console.error(`[${context}] Error `, err.message);

                            };

                            console.log("Card Updated");

                        });

                    });

                };

            };
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function makePaymentCardAsync(notification, paymentMethod) {
    const context = "Function makePaymentCardAsync";
    return new Promise(async (resolve, reject) => {
        let query = {
            $and : [
                {_id: notification.paymentId },
                {
                    $or: [
                        { status: process.env.PaymentStatusRefused },
                        { status: process.env.PaymentStatusFaild },
                        { status: process.env.PaymentStatusStartPayment },
                    ]
                },
                { transactionType: { $ne: process.env.TransactionType2ndWayPhysicalCard } },
            ]
        };

        let payment;
        let result;
        try {
            payment = await paymentFindOne(query);
            if (payment) {
                await paymentUpdate(query, { $set: { paymentMethodId: paymentMethod.paymentMethodId } });
                payment.paymentMethodId = paymentMethod.paymentMethodId
                result = await paymentCardAsync(payment);
                console.log('[makePaymentCardAsync] makePaymentCardAsync - payment: ', result)
                if (result) {
                    NotificationsPayments.updateNotificationsPayments({ _id: notification._id }, { $set: { active: false } }, (err, result) => {
                        if (err) {
                            console.error(`[${context}][updateNotificationsPayments] Error `, err.message);
                            reject(err);
                        };

                        resolve(result);
                        console.log("Notifications updated!");

                    });
                }
            } else {
                resolve({});
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };

    });
};

function paymentCardAsync(payment) {
    let context = "Function paymentCardAsync PaymentsAdyen";
    return new Promise(async (resolve, reject) => {
        try {
            let clientName = payment.clientName;
            if (payment.transactionId === undefined || payment.transactionId === "" || payment.transactionId == "-1") {
                //Created a new transaction
                let newTransaction = new Transactions(
                    {
                        userId: payment.userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderCreditCard,
                        amount: payment.amount,
                        sessionId: payment.sessionId,
                        paymentId: payment._id

                    }
                );

                let transactionCreated = await createTransactions(newTransaction);
                payment.transactionId = transactionCreated._id.toString();
                let newPayments = await paymentUpdate({ _id: payment._id }, { $set: { transactionId: transactionCreated._id.toString() } });

            };

            let amoutToCard;

            if (payment.amountToCard && payment.amountToCard.value > 0) {
                amoutToCard = payment.amountToCard;
            } else {
                amoutToCard = payment.amount;
            };

            if (amoutToCard.value == 0) {
                //var host = 'http://localhost:3017' + '/api/private/paymentsAdyen/preAuthorisePayment';

                let transaction = await transactionFindOne({ _id: payment.transactionId });
                if (transaction.adyenReference == "-1" || transaction.adyenReference == "" || transaction.adyenReference == undefined) {

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

                } else {

                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
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

                //console.log("2 - received", received);

                if (received.adyenReference == "-1" || received.adyenReference == "" || received.adyenReference == undefined) {


                    let body = {
                        merchantAccount: adyenMerchantAccount,
                        reference: received.transactionId,
                        amount: received.amount,
                        paymentMethod: received.paymentMethod,
                        shopperReference: userId,
                        shopperInteraction: process.env.ShopperInteractionContAuth,
                        recurringProcessingModel: await getRecurringProcessingModel(userId, received.paymentMethod.storedPaymentMethodId)/*,
                        additionalData: {
                            authorisationType: process.env.AdyenAuthorisationTypePreAuth
                        }*/
                    };
                    await forceResponseCode(userId, body)

                    body.amount.value *= 100;

                    body.amount.value = Math.abs(body.amount.value);

                    console.log("body", body);
                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

                        body.merchantAccount = adyenMerchantAccountSC;

                        //TODO
                        checkoutSC.payments(body)
                            //checkout.payments(body)
                            .then(async (result) => {
                                needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

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
                                if (status === process.env.TransactionStatusFaild) {
                                    reject({ message: result.resultCode + " Payment failed" });
                                } else {
                                    resolve(response);
                                }

                            })
                            .catch((error) => {

                                console.error(`[${context}][checkoutSC.payments] Error `, error.message);
                                reject(error);

                            });
                    } else {
                        checkout.payments(body)
                            .then(async (result) => {
                                needsThreeDSAuthentication(received.paymentMethod.storedPaymentMethodId, result.refusalReasonCode)

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
                                if (status === process.env.TransactionStatusFaild) {
                                    reject({ message: result.resultCode + " Payment failed" });
                                } else {
                                    resolve(response);
                                }

                            })
                            .catch((error) => {

                                console.error(`[${context}][checkout.payments] Error `, error.message);
                                reject(error);

                            });
                    }
                } else {

                    received.amount.value = Math.abs(received.amount.value);
                    var data = {

                        merchantAccount: adyenMerchantAccount,
                        originalReference: received.adyenReference,
                        modificationAmount: received.amount,
                        reference: received.transactionId

                    };

                    //data.modificationAmount.value = parseFloat(data.modificationAmount.value.toFixed(2)) * 100;

                    data.modificationAmount.value *= 100;
                    console.log("###################### paymentCardAsync - data", data);

                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {

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

        } catch (error) {
            console.error(`[${context}][catch] Error `, error.message);
            reject(error);
        };
    });
};


function validateFieldsAdd3DSCard(received, client, userId) {
    var context = "Function validateFieldsAdd3DSCard";
    if (!userId) {
        return { auth: false, code: 'server_userId_required', message: "User id is required" }
    }

    if (!received) {
        return { auth: false, code: 'server_data_required', message: 'Data is required' }
    }

    if (!received.paymentMethod) {
        return { auth: false, code: 'server_paymentMethod_required', message: 'Payment method is required' }
    }

    if (received.paymentMethod.storedPaymentMethodId !== null && received.paymentMethod.storedPaymentMethodId !== undefined) {
        if (!received.paymentMethod.type) {
            return { auth: false, code: 'server_type_required', message: 'Payment method type is required' }
        }

        if (!received.paymentMethod.encryptedSecurityCode) {
            return { auth: false, code: 'server_encryptedSecurityCode_required', message: 'Encrypted CCV is required' }
        }

        if (received.addBalanceToWallet) {
            return { auth: false, code: 'server_addBalanceToWallet_required', message: 'Can not add balance to wallet' }
        }

        if (received.amount !== null && received.amount !== undefined) {
            return { auth: false, code: 'server_amount_required', message: 'Amount can not be set' }
        }

    } else {
        if (!received.paymentMethod.type) {
            return { auth: false, code: 'server_type_required', message: 'Payment method type is required' }
        }

        if (!received.paymentMethod.encryptedCardNumber) {
            return { auth: false, code: 'server_encryptedCardNumber_required', message: 'Encrypted card number is required' }
        }

        if (!received.paymentMethod.encryptedExpiryMonth) {
            return { auth: false, code: 'server_encryptedExpiryMonth_required', message: 'Encrypted expiry month is required' }
        }

        if (!received.paymentMethod.encryptedExpiryYear) {
            return { auth: false, code: 'server_encryptedExpiryYear_required', message: 'Encrypted expiry year is required' }
        }

    }

    if (!received.browserInfo) {
        return { auth: false, code: 'server_browserInfo_required', message: 'browserInfo is required' }
    }

    if (!received.channel) {
        return { auth: false, code: 'server_channel_required', message: 'channel is required' }
    }

    if (!received.returnUrl) {
        return { auth: false, code: 'server_returnUrl_required', message: 'returnUrl is required' }
    }

    if ((received.addBalanceToWallet === true)) {
        if (received.amount === null || received.amount === undefined) {
            return { auth: false, code: 'server_amount_required', message: 'Amount data is required' }
        }

        if (received.amount.value === null || received.amount.value === undefined) {
            return { auth: false, code: 'server_value_required', message: 'Amount value is required' }
        }

        if (typeof received.amount.value !== 'number') {
            return { auth: false, code: 'server_value_required', message: 'Amount value is required' }
        }
    } else {
        if (received.amount !== null && received.amount !== undefined) {
            return { auth: false, code: 'server_addBalanceToWallet_required', message: 'Add balance is required' }
        }
    }

    // if (!received.threeDS2RequestData) {
    //     return { auth: false, code: 'server_threeDS2RequestData_required', message: 'threeDS2RequestData is required' }
    // }

    if (!client) {
        return { auth: false, code: 'server_client_required', message: 'client is required' }
    } else if (client.includes('iOS') || client.includes('android')) {

        // if (!received.browserInfo.acceptHeader) {
        //     return { auth: false, code: 'server_acceptHeader_required', message: 'acceptHeader is required' }
        // }

        if (!received.browserInfo.userAgent) {
            return { auth: false, code: 'server_userAgent_required', message: 'userAgent is required' }
        }

        if (client.includes('iOS')) {
            if (received.channel !== 'iOS') {
                return { auth: false, code: 'server_channel_required', message: 'Wrong channel field' }
            }
        }

        if (client.includes('android')) {
            if (received.channel !== 'Android') {
                return { auth: false, code: 'server_channel_required', message: 'Wrong channel field' }
            }
        }

    } else if (client.includes('BackOffice')) {
        if (!received.origin) {
            return { auth: false, code: 'server_origin_required', message: 'origin is required' }
        }
        if (!received.browserInfo.acceptHeader) {
            return { auth: false, code: 'server_acceptHeader_required', message: 'acceptHeader is required' }
        }

        if (!(received.browserInfo.colorDepth >= 0)) {
            return { auth: false, code: 'server_colorDepth_required', message: 'colorDepth is required' }
        }

        if (received.browserInfo.javaEnabled === null || received.browserInfo.javaEnabled === undefined) {
            return { auth: false, code: 'server_javaEnabled_required', message: 'javaEnabled is required' }
        }

        if (!received.browserInfo.language) {
            return { auth: false, code: 'server_language_required', message: 'language is required' }
        }

        if (received.browserInfo.screenHeight === null || received.browserInfo.screenHeight === undefined) {
            return { auth: false, code: 'server_screenHeight_required', message: 'screenHeight is required' }
        }

        if (received.browserInfo.screenWidth === null || received.browserInfo.screenWidth === undefined) {
            return { auth: false, code: 'server_screenWidth_required', message: 'screenWidth is required' }
        }
        if (received.browserInfo.timeZoneOffset === null || received.browserInfo.timeZoneOffset === undefined) {
            return { auth: false, code: 'server_timeZoneOffset_required', message: 'timeZoneOffset is required' }
        }

        if (!received.browserInfo.userAgent) {
            return { auth: false, code: 'server_userAgent_required', message: 'userAgent is required' }
        }

        if (received.channel !== 'Web') {
            return { auth: false, code: 'server_channel_required', message: 'Wrong channel field' }
        }

        if (!received.shopperIP) {
            return { auth: false, code: 'server_shopperIP_required', message: 'shopperIP is required' }
        }
    } else {
        if (!received.origin) {
            return { auth: false, code: 'server_origin_required', message: 'origin is required' }
        }
        if (!received.browserInfo.acceptHeader) {
            return { auth: false, code: 'server_acceptHeader_required', message: 'acceptHeader is required' }
        }

        if (!(received.browserInfo.colorDepth >= 0)) {
            return { auth: false, code: 'server_colorDepth_required', message: 'colorDepth is required' }
        }

        if (received.browserInfo.javaEnabled === null || received.browserInfo.javaEnabled === undefined) {
            return { auth: false, code: 'server_javaEnabled_required', message: 'javaEnabled is required' }
        }

        if (!received.browserInfo.language) {
            return { auth: false, code: 'server_language_required', message: 'language is required' }
        }

        if (received.browserInfo.screenHeight === null || received.browserInfo.screenHeight === undefined) {
            return { auth: false, code: 'server_screenHeight_required', message: 'screenHeight is required' }
        }

        if (received.browserInfo.screenWidth === null || received.browserInfo.screenWidth === undefined) {
            return { auth: false, code: 'server_screenWidth_required', message: 'screenWidth is required' }
        }
        if (received.browserInfo.timeZoneOffset === null || received.browserInfo.timeZoneOffset === undefined) {
            return { auth: false, code: 'server_timeZoneOffset_required', message: 'timeZoneOffset is required' }
        }

        if (!received.browserInfo.userAgent) {
            return { auth: false, code: 'server_userAgent_required', message: 'userAgent is required' }
        }

        if (received.channel !== 'Web') {
            return { auth: false, code: 'server_channel_required', message: 'Wrong channel field' }
        }

        if (!received.shopperIP) {
            return { auth: false, code: 'server_shopperIP_required', message: 'shopperIP is required' }
        }
    }

    return null
};

function validateBillingProfile(userId) {
    let context = "Function validateBillingProfile";
    return new Promise(async (resolve, reject) => {
        try {

            let proxy = process.env.HostUser + process.env.PathValidateBilling;
            let headers = {
                userid: userId
            };

            axios.get(proxy, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.error(`[${context}][${proxy}] Error `, error);
                    resolve(null);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error);
            resolve(null);
        };
    });
};

async function getBillingAddress(userId) {
    let context = "Function getBillingAddress";
    try {
        let billingProfile = await validateBillingProfile(userId)
        if (billingProfile) {
            let { street, number, floor, city, zipCode, state, country, countryCode, postCode, address } = billingProfile.billingAddress
            if (address && !number) {
                let addressNumber = address.match(/[0-9]+/)
                number = addressNumber[0] ?? address
            }

            if (city && (postCode || zipCode) && (address || street)) {
                return {
                    billingAddress: {
                        city,
                        country: countryCode ?? "PT",
                        houseNumberOrName: number,
                        postalCode: zipCode ?? postCode,
                        street: street ?? address,
                    },
                    email: billingProfile.email,
                }
            } else {
                return {
                    email: billingProfile.email,
                }
            }
        }
        return {}
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return {}
    };
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
                    resolve(null);
                };

            })
            .catch((error) => {

                console.error(`[${context}][axios.get] Error `, error.message);
                resolve(null);

            });
    });
};

async function authenticationOnlyPaymentBody(billingAddress, email, userInfo, received, amountValue, amountCurrency, shopperReference, reference, merchantAccount, attemptAuthentication, authenticationOnly) {
    let context = "Function authenticationOnlyPaymentBody";
    try {
        console.info(
            `[${context}] shopperReference: ${shopperReference}, reference: ${reference}, ` +
            `amountValue: ${amountValue}, amountCurrency: ${amountCurrency}, ` +
            `attemptAuthentication: ${attemptAuthentication}, authenticationOnly: ${authenticationOnly}, ` +
            `paymentMethod: ${JSON.stringify(received?.paymentMethod)}`
          );

        let body = {
            paymentMethod: received.paymentMethod,
            shopperReference: shopperReference,
            shopperInteraction: process.env.ShopperInteractionEcommerce,
            recurringProcessingModel: await getRecurringProcessingModel(shopperReference, received.paymentMethod.storedPaymentMethodId),
            storePaymentMethod: process.env.StorePaymentMethod,
            amount: {
                value: amountValue,
                currency: amountCurrency
            },
            reference: reference,
            merchantAccount: merchantAccount,
            additionalData: received.additionalData ? received.additionalData : {
                challengeWindowSize: process.env.challengeWindowSize,
                scaExemption: process.env.scaTrustedBeneficiary,
                threeDSVersion: process.env.threeDSVersion,
            },
            authenticationData: {
                attemptAuthentication: attemptAuthentication,
                threeDSRequestData: {
                    challengeWindowSize: process.env.challengeWindowSize,
                    nativeThreeDS: process.env.nativeThreeDSPreferred,
                    threeDSVersion: process.env.threeDSVersion,
                }
            },
            browserInfo: {
                userAgent: received.browserInfo.userAgent,
                acceptHeader: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                screenWidth: 1536,
                javaEnabled: true,
                screenHeight: 723,
                timeZoneOffset: 0,
                language: `${received.browserInfo.language?.toLowerCase()}-${received.browserInfo.language?.toUpperCase()}`,
                colorDepth: 24
            },
            returnUrl: received.returnUrl,
            origin: received.origin,
            channel: received.channel,
            threeDS2RequestData: received.threeDS2RequestData,
            socialSecurityNumber: received.socialSecurityNumber,
            mpiData: received.mpiData,
            merchantRiskIndicator: received.merchantRiskIndicator,
            installments: received.installments,
            deliveryAddress: received.deliveryAddress,
            shopperIP: received.shopperIP
        };
        await forceResponseCode(shopperReference, body)

        if (received.paymentMethod?.storedPaymentMethodId != undefined && received.paymentMethod?.storedPaymentMethodId != '') {
            const defaultPaymentId = await paymentMethodService.getDefaultPaymentMethod(shopperReference);
            if( defaultPaymentId?.paymentMethodId ) body.paymentMethod.storedPaymentMethodId = defaultPaymentId.paymentMethodId;
        }

        if (billingAddress) {
            body.billingAddress = billingAddress
        }
        if (userInfo) {
            if (userInfo.email) {
                body.shopperEmail = userInfo.email
            } else if (email) {
                body.shopperEmail = email
            }

            if (userInfo && (userInfo.name != undefined || userInfo.name !== null) ) {
                let splitName = userInfo.name.split(' ')
                if (splitName.length >= 2) {
                    body.shopperName = {
                        firstName: splitName[0],
                        lastName: splitName[splitName.length - 1]
                    }
                }
            }
        }
        return body
    } catch (error) {
        console.error(`[${context}] Error `, error);
        throw error;
    };
};


async function authenticationOnlyPaymentRequest(authenticationOnlyBody, adyenCheckoutObj, adyenMerchantAccountName, adyenModificationObj, responseObj, foundTransaction, userId, clientName) {
    let context = "Function authenticationOnlyPaymentRequest";
    try {
        console.info(`[${context}][adyenCheckoutObj.payments(authenticationOnlyBody)][${JSON.stringify(authenticationOnlyBody)}]`);
        await adyenCheckoutObj.payments(authenticationOnlyBody)
            .then(async (result) => {
                result = JSON.parse(JSON.stringify(result))
                console.error(`[${context}][adyenCheckoutObj.payments][response adyen: ${JSON.stringify(result)}]`);
                
                if (isEmptyObject(result.action)) {
                    switch (result.resultCode) {

                        case 'Authorised':
                            await authorisedPaymentAuthentication(responseObj, result, adyenCheckoutObj, adyenModificationObj, adyenMerchantAccountName, foundTransaction, userId, clientName)
                            break;
                        case 'AuthenticationNotRequired':
                            await authorisedPaymentAuthentication(responseObj, result, adyenCheckoutObj, adyenModificationObj, adyenMerchantAccountName, foundTransaction, userId, clientName)
                            break;
                        case 'AuthenticationFinished':
                            await authorisedPaymentAuthentication(responseObj, result, adyenCheckoutObj, adyenModificationObj, adyenMerchantAccountName, foundTransaction, userId, clientName)
                            break;
                        default:
                            console.error(`[${context}][adyenCheckoutObj.payments][${result.resultCode}] Error `, result);
                            await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: result , status: process.env.TransactionStatusFaild} });
                            var message = await adyenRefusalReasonCodes(result.refusalReasonCode)                            
                            responseObj.success = false
                            responseObj.statusCode = 400
                            responseObj.logData = result
                            responseObj.data = message
                            break;
                    };
                } else {
                    await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: result } });
                    result.transactionId = foundTransaction._id.toString()
                    responseObj.logData = result
                    responseObj.data = result
                }

            })
            .catch(async (error) => {
                console.error(`[${context}][adyenCheckoutObj.payments][${error.errorCode}] Error `, error);
                await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { status: process.env.TransactionStatusFaild} });
                var message = await adyenRefusalReasonCodes(error.errorCode)
                responseObj.success = false
                responseObj.statusCode = error.statusCode
                responseObj.logData = error
                responseObj.data = message

            });
    } catch (error) {
        console.error(`[${context}] Error `, error);
        responseObj.success = false
        responseObj.statusCode = 500
        responseObj.logData = error
        responseObj.data = error.message
    };
};

function isEmptyObject(obj) {
    let context = "Function isEmptyObject";
    try {
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return true
    }
}

async function authorisedPaymentAuthentication(responseObj, paymentResult, adyenCheckoutObj, adyenModificationObj, merchantAccount, foundTransaction, userId, clientName) {
    const context = "authorisedPaymentAuthentication";

    try {
        console.info(`[${context}] - Logs`, {
            transactionId: foundTransaction?._id?.toString(),
            userId,
            step: 'authorisedPaymentAuthentication',
            status: 'start',
            timestamp: new Date().toISOString()
        });

        paymentResult = JSON.parse(JSON.stringify(paymentResult))

        const paymentMethodId = paymentResult.additionalData['recurring.recurringDetailReference'] ?? (foundTransaction.paymentMethodId ?? paymentResult.pspReference)

        if (!foundTransaction.addBalanceToWallet) {
            console.log(JSON.stringify({
                userId,
                transactionId: foundTransaction._id.toString(),
                context,
                step: 'cancelPaymentAuthorisation',
                status: 'start'
            }));

            cancelPaymentAuthorisation(adyenModificationObj, {
                paymentsResponseData: paymentResult,
                pspReference: paymentResult.pspReference
            }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId);
        }

        let response = {
            amount: paymentResult.amount,
            merchantReference: paymentResult.merchantReference,
            pspReference: paymentResult.pspReference,
            resultCode: paymentResult.resultCode
        };

        if (paymentResult.additionalData != undefined) {
            response.additionalData = {
                recurringProcessingModel: paymentResult.additionalData.recurringProcessingModel,
                recurring: {
                    shopperReference: paymentResult.additionalData['recurring.shopperReference'],
                    recurringDetailReference: paymentMethodId
                }
            }
        }

        const foundCard = await PaymentMethod.findOne({ userId: userId, paymentMethodId: paymentMethodId })
        let body = {
            merchantAccount: merchantAccount,
            shopperReference: userId
        };

        await adyenCheckoutObj.paymentMethods(body)
            .then(async (paymentsResponse) => {
                console.log(JSON.stringify({
                    userId,
                    context,
                    step: 'adyenCheckoutObj.paymentMethods',
                    status: 'success',
                }));

                if (!foundCard || foundTransaction.transactionType === process.env.TransactionTypeForce3dsAuth) {
                    if (paymentsResponse.storedPaymentMethods != undefined) {
                        if (foundTransaction.addBalanceToWallet) {
                            const walletAmount = {
                                value: paymentResult.amount.value / 100,
                                currency: paymentResult.amount.currency
                            };

                            console.info(`[${context}] - Logs`, {
                                transactionId: foundTransaction?._id?.toString(),
                                userId,
                                step: 'addCardBalanceToWallet',
                                status: 'start',
                                message: 'Adding balance to wallet and changing the transaction to TransactionStatusInPayment',
                                timestamp: new Date().toISOString()
                            });

                            const addWallet = await addCardBalanceToWallet(
                                adyenModificationObj,
                                merchantAccount,
                                paymentResult,
                                foundTransaction,
                                walletAmount,
                                paymentResult.pspReference
                            );

                            if (addWallet) {
                                console.info(`[${context}] - Logs`, {
                                    transactionId: foundTransaction?._id?.toString(),
                                    userId,
                                    step: 'addCardBalanceToWallet',
                                    status: 'success',
                                    message: 'Balance added to wallet and transaction updated to TransactionStatusInPayment',
                                    timestamp: new Date().toISOString()
                                });

                                const created = await createNewPaymentMethod(response, userId, process.env.TransactionTypeCredit, clientName);

                                if (created || foundTransaction.transactionType === process.env.TransactionTypeForce3dsAuth) {
                                    const paymentMethods = await validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId);
                                    await paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                    await savePaymentData(paymentMethodId, { $set: { threeDSAuthenticated: true, needsThreeDSAuthentication: false } });
                                    await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { status: process.env.TransactionStatusPaidOut } });

                                    paymentResult.transactionId = foundTransaction._id.toString();
                                    paymentResult.storedPaymentMethods = paymentMethods;

                                    responseObj.data = paymentResult;
                                    responseObj.logData = paymentResult;

                                    console.info(`[${context}] - Logs`, {
                                        transactionId: foundTransaction?._id?.toString(),
                                        userId,
                                        step: 'transactionsUpdate',
                                        status: 'success',
                                        message: 'Transaction updated to TransactionStatusPaidOut',
                                        timestamp: new Date().toISOString()
                                    });
                                } else {
                                    await cancelPaymentAuthorisation(adyenModificationObj, {
                                        paymentsResponseData: paymentResult,
                                        pspReference: paymentResult.pspReference
                                    }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId);

                                    await removeCardFromAdyen(userId, paymentMethodId, clientName)
                                    await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: paymentResult , status: process.env.TransactionStatusFaild} });
                                    var message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
                                    responseObj.success = false
                                    responseObj.statusCode = 400
                                    responseObj.logData = message
                                    responseObj.data = message

                                    console.info(`[${context}] - Logs`, {
                                        userId,
                                        step: 'createNewPaymentMethod',
                                        status: 'warning',
                                        message: 'Card already exists',
                                        timestamp: new Date().toISOString()
                                    });
                                }
                            } else {
                                await cancelPaymentAuthorisation(adyenModificationObj, { paymentsResponseData: paymentResult, pspReference: paymentResult.pspReference }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId)
                                await removeCardFromAdyen(userId, paymentMethodId, clientName)
                                await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: paymentResult, status: process.env.TransactionStatusFaild } });
                                var message = { auth: false, code: 'server_wallet_update_error', message: "Failed to update wallet" }
                                responseObj.success = false
                                responseObj.statusCode = 400
                                responseObj.logData = message
                                responseObj.data = message

                                console.info(`[${context}] - Logs`, {
                                    userId,
                                    step: 'addCardBalanceToWallet',
                                    status: 'warning',
                                    message: 'Failed to update wallet',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        } else {
                            const created = await createNewPaymentMethod(response, userId, foundTransaction.transactionType, clientName);

                            if (created || foundTransaction.transactionType === process.env.TransactionTypeForce3dsAuth) {
                                const paymentMethods = await validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId);
                                await paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                await savePaymentData(paymentMethodId, { $set: { threeDSAuthenticated: true, needsThreeDSAuthentication: false } });

                                paymentResult.transactionId = foundTransaction._id.toString();
                                paymentResult.storedPaymentMethods = paymentMethods;

                                responseObj.data = paymentResult;
                                responseObj.logData = paymentResult;

                                console.info(`[${context}] - Logs`, {
                                    userId,
                                    step: 'createNewPaymentMethod',
                                    status: 'success',
                                    message: 'New PaymentMethod created',
                                    timestamp: new Date().toISOString()
                                });
                            } else {
                                await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: paymentResult } });
                                var message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
                                responseObj.success = false
                                responseObj.statusCode = 400
                                responseObj.logData = message
                                responseObj.data = message

                                console.info(`[${context}] - Logs`, {
                                    userId,
                                    step: 'createNewPaymentMethod',
                                    status: 'warning',
                                    message: 'Card already exists',
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    } else {
                        const message = 'No stored payment methods from Adyen';
                        await transactionsUpdate({ _id: foundTransaction._id.toString() }, {
                            $set: {
                                paymentsResponseData: paymentResult,
                                status: process.env.TransactionStatusFaild
                            }
                        });

                        paymentResult.transactionId = foundTransaction._id.toString();
                        paymentResult.storedPaymentMethods = [];

                        responseObj.data = paymentResult;
                        responseObj.logData = paymentResult;

                        console.info(`[${context}] - Logs`, {
                            userId,
                            step: 'adyenCheckoutObj.paymentMethods',
                            status: 'warning',
                            timestamp: new Date().toISOString()
                        });
                    }
                } else {
                    await cancelPaymentAuthorisation(adyenModificationObj, { paymentDetailsResponseData: paymentResult, pspReference: paymentResult.pspReference }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId)
                    await updateAlreadyExistingCard(responseObj, paymentResult, userId, paymentMethodId, foundTransaction);
                };

            })
            .catch((error) => {
                responseObj.success = false;
                responseObj.statusCode = 500;
                responseObj.logData = error;
                responseObj.data = error.message;

                console.info(`[${context}] - Logs`, {
                    userId,
                    step: 'adyenCheckoutObj.paymentMethods',
                    status: 'error',
                    message: error,
                    timestamp: new Date().toISOString()
                });
            });

    } catch (error) {
        responseObj.success = false;
        responseObj.statusCode = 500;
        responseObj.logData = error;
        responseObj.data = error.message;

        console.info(`[${context}] - Logs`, {
            userId,
            step: 'authorisedPaymentAuthentication',
            status: 'error',
            message: error,
            timestamp: new Date().toISOString()
        });
    }
}

function validateFieldsAdd3DSCardDetails(received) {
    var context = "Function validateFieldsAdd3DSCardDetails";
    if (!received) {
        return { auth: false, code: 'server_data_required', message: 'Data is required' }
    }

    if (!received.transactionId) {
        return { auth: false, code: 'server_transactionId_required', message: "transactionId is required" }
    }

    if (!received.details) {
        return { auth: false, code: 'server_details_required', message: 'details is required' }
    }
    return null
};

function authenticationOnlyPaymentDetailsBody(received, authenticationOnly, transaction) {
    let context = "Function authenticationOnlyPaymentDetailsBody";
    try {

        let body = {
            // authenticationData : {
            //     authenticationOnly : authenticationOnly,
            // },
            details: received.details,
            paymentData: transaction.paymentsResponseData ? (transaction.paymentsResponseData.action ? transaction.paymentsResponseData.action.paymentData : undefined) : undefined
        };
        return body
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {
            // authenticationData : {
            //     authenticationOnly : authenticationOnly,
            // },
            details: received.details,
        };
    };
};

async function authenticationOnlyPaymentDetailsRequest(authenticationOnlyBody, adyenCheckoutObj, adyenMerchantAccountName, adyenModificationObj, responseObj, foundTransaction, userId, clientName) {
    let context = "Function authenticationOnlyPaymentDetailsRequest";
    try {
        await adyenCheckoutObj.paymentsDetails(authenticationOnlyBody)
            .then(async (result) => {
                result = JSON.parse(JSON.stringify(result))
                switch (result.resultCode) {

                    case 'Authorised':
                        await authorisedPaymentDetailsAuthentication(responseObj, result, adyenCheckoutObj, adyenModificationObj, adyenMerchantAccountName, foundTransaction, userId, clientName, authenticationOnlyBody)
                        break;

                    case 'AuthenticationNotRequired':
                        await authorisedPaymentDetailsAuthentication(responseObj, result, adyenCheckoutObj, adyenModificationObj, adyenMerchantAccountName, foundTransaction, userId, clientName, authenticationOnlyBody)
                        break;

                    case 'AuthenticationFinished':
                        await authorisedPaymentDetailsAuthentication(responseObj, result, adyenCheckoutObj, adyenModificationObj, adyenMerchantAccountName, foundTransaction, userId, clientName, authenticationOnlyBody)
                        break;
                    default:
                        console.error(`[${context}][adyenCheckoutObj.payments][${result.resultCode}] Error `, result);
                        await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentDetailsResponseData: result, status: process.env.TransactionStatusFaild } });
                        var message = await adyenRefusalReasonCodes(result.refusalReasonCode)
                        responseObj.success = false
                        responseObj.statusCode = 400
                        responseObj.logData = result
                        responseObj.data = message
                        break;
                };
            })
            .catch(async (error) => {
                console.error(`[${context}][adyenCheckoutObj.payments][${error.errorCode}] Error `, error);
                await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { status: process.env.TransactionStatusFaild } });
                var message = await adyenRefusalReasonCodes(error.errorCode)
                responseObj.success = false
                responseObj.statusCode = error.statusCode
                responseObj.logData = error
                responseObj.data = message

            });
    } catch (error) {
        console.error(`[${context}] Error `, error);
        responseObj.success = false
        responseObj.statusCode = 500
        responseObj.logData = error
        responseObj.data = error.message
    };
};

async function authorisedPaymentDetailsAuthentication(responseObj, paymentResult, adyenCheckoutObj, adyenModificationObj, merchantAccount, foundTransaction, userId, clientName, authenticationOnlyBody) {
    let context = "Function authorisedPaymentDetailsAuthentication";
    try {
        paymentResult = JSON.parse(JSON.stringify(paymentResult))

        const paymentMethodId = paymentResult.additionalData['recurring.recurringDetailReference'] ?? (foundTransaction.paymentMethodId ?? paymentResult.pspReference)
        if (!foundTransaction.addBalanceToWallet) {
            cancelPaymentAuthorisation(adyenModificationObj, { paymentDetailsResponseData: paymentResult, pspReference: paymentResult.pspReference }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId)
        }

        let response = {
            amount: paymentResult.amount,
            merchantReference: paymentResult.merchantReference,
            pspReference: paymentResult.pspReference,
            resultCode: paymentResult.resultCode
        };

        if (paymentResult.additionalData != undefined) {
            response.additionalData = {
                recurringProcessingModel: paymentResult.additionalData.recurringProcessingModel,
                recurring: {
                    shopperReference: paymentResult.additionalData['recurring.shopperReference'],
                    recurringDetailReference: paymentMethodId
                }
            }
        }

        const foundCard = await PaymentMethod.findOne({ userId: userId, paymentMethodId: paymentMethodId })

        let body = {
            merchantAccount: merchantAccount,
            shopperReference: userId
        };

        await adyenCheckoutObj.paymentMethods(body)
            .then(async (paymentsResponse) => {

                if (!foundCard || foundTransaction.transactionType === process.env.TransactionTypeForce3dsAuth) {
                    // console.log("Doesn't have card")
                    if (paymentsResponse.storedPaymentMethods != undefined) {

                        if (foundTransaction.addBalanceToWallet) {
                            // console.log("Adding balance to wallet payments")
                            const walletAmount = { value: paymentResult.amount.value / 100, currency: paymentResult.amount.currency }
                            // console.log("walletAmount", JSON.stringify(walletAmount))
                            const addWallet = await addCardBalanceToWallet(adyenModificationObj, merchantAccount, paymentResult, foundTransaction, walletAmount, paymentResult.pspReference)
                            // console.log("addWallet", JSON.stringify(addWallet))
                            if (addWallet) {
                                const created = await createNewPaymentMethod(response, userId, process.env.TransactionTypeCredit, clientName)
                                if (created || foundTransaction.transactionType === process.env.TransactionTypeForce3dsAuth) {
                                    let paymentMethods = await validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                    paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                    let paymentMethodNewValues = {
                                        $set: {
                                            details: authenticationOnlyBody.details,
                                            paymentData: paymentResult.threeDSPaymentData ?? (foundTransaction.paymentsResponseData ? (foundTransaction.paymentsResponseData.action ? foundTransaction.paymentsResponseData.action.paymentData : undefined) : undefined),
                                            threeDSAuthenticated: true,
                                            needsThreeDSAuthentication: false
                                        }
                                    }

                                    savePaymentData(paymentMethodId, paymentMethodNewValues)
                                    paymentResult.transactionId = foundTransaction._id.toString()
                                    paymentResult.storedPaymentMethods = paymentMethods
                                    responseObj.data = paymentResult
                                    responseObj.logData = paymentResult
                                } else {
                                    await cancelPaymentAuthorisation(adyenModificationObj, { paymentDetailsResponseData: paymentResult, pspReference: paymentResult.pspReference }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId)
                                    await removeCardFromAdyen(userId, paymentMethodId, clientName)
                                    await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentDetailsResponseData: paymentResult } });
                                    var message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
                                    responseObj.success = false
                                    responseObj.statusCode = 400
                                    responseObj.logData = message
                                    responseObj.data = message
                                }
                            } else {
                                await cancelPaymentAuthorisation(adyenModificationObj, { paymentDetailsResponseData: paymentResult, pspReference: paymentResult.pspReference }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId)
                                await removeCardFromAdyen(userId, paymentMethodId, clientName)
                                await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentDetailsResponseData: paymentResult } });
                                var message = { auth: false, code: 'server_wallet_update_error', message: "Failed to update wallet" }
                                responseObj.success = false
                                responseObj.statusCode = 400
                                responseObj.logData = message
                                responseObj.data = message
                            }
                        } else {
                            // console.log("Adding card only")
                            const created = await createNewPaymentMethod(response, userId, foundTransaction.transactionType, clientName)
                            if (created || foundTransaction.transactionType === process.env.TransactionTypeForce3dsAuth) {
                                let paymentMethods = await validateDefaultPaymentMethod(paymentsResponse.storedPaymentMethods, userId)
                                await paymentMethodAddBrand(paymentsResponse.paymentMethods, response, paymentsResponse.storedPaymentMethods, userId);
                                let paymentMethodNewValues = {
                                    $set: {
                                        details: authenticationOnlyBody.details,
                                        paymentData: paymentResult.threeDSPaymentData ?? (foundTransaction.paymentsResponseData ? (foundTransaction.paymentsResponseData.action ? foundTransaction.paymentsResponseData.action.paymentData : undefined) : undefined),
                                        threeDSAuthenticated: true,
                                        needsThreeDSAuthentication: false
                                    }
                                }

                                await savePaymentData(paymentMethodId, paymentMethodNewValues)
                                paymentResult.transactionId = foundTransaction._id.toString()
                                paymentResult.storedPaymentMethods = paymentMethods
                                responseObj.data = paymentResult
                                responseObj.logData = paymentResult
                            } else {
                                await updateAlreadyExistingCard(responseObj, paymentResult, userId, paymentMethodId, foundTransaction);
                            }
                        }
                    } else {
                        await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentDetailsResponseData: paymentResult } });
                        paymentResult.transactionId = foundTransaction._id.toString()
                        paymentResult.storedPaymentMethods = []
                        responseObj.logData = paymentResult
                        responseObj.data = paymentResult
                    };
                } else {
                    await cancelPaymentAuthorisation(adyenModificationObj, { paymentDetailsResponseData: paymentResult, pspReference: paymentResult.pspReference }, merchantAccount, foundTransaction._id.toString(), paymentResult.amount, paymentMethodId)
                    await updateAlreadyExistingCard(responseObj, paymentResult, userId, paymentMethodId, foundTransaction);
                };

            })
            .catch((error) => {
                console.error(`[${context}][adyenCheckoutObj.paymentMethods] Error `, error.message);
                responseObj.success = false
                responseObj.statusCode = 500
                responseObj.logData = error
                responseObj.data = error.message
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        responseObj.success = false
        responseObj.statusCode = 500
        responseObj.logData = error
        responseObj.data = error.message
    }
}


async function savePaymentData(paymentMethodId, paymentMethodNewValues) {
    let context = "Function savePaymentData";
    try {
        await PaymentMethod.findOneAndUpdate({ paymentMethodId }, paymentMethodNewValues)

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function cancelPaymentAuthorisation(adyenModificationObj, paymentResult, merchantAccount, reference, amount, adyenReference) {
    let context = "Function cancelPaymentAuthorisation";
    try {
        let data = {
            merchantAccount: merchantAccount,
            originalReference: paymentResult.pspReference,
            reference: {
                typeOfReference: process.env.ReferenceAdyenAddCard,
                reference: reference
            }
        };

        let modificationsResponse = await adyenModificationObj.cancel(data);

        console.log("modificationsResponse - cancel", JSON.stringify(modificationsResponse))

        amount.value = Math.abs(amount.value/100);

        var newValues = {
            $set: {
                amount: amount,
                adyenReference: adyenReference,
                dataReceived: modificationsResponse,
                ...paymentResult
            }
        };

        console.log("newValues cancel", JSON.stringify(newValues))
        console.log("_id: reference cancel", JSON.stringify(reference))

        let transactionUpdated = await transactionsUpdate({ _id: reference }, newValues);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}


async function addCardBalanceToWallet(adyenModificationObj, merchantAccount, paymentResult, foundTransaction, amount, pspReference) {
    let context = "Function addCardBalanceToWallet";
    try {
        const amountObj = amount
        let transaction = new Transactions({
            userId: foundTransaction.userId,
            amount: amountObj,
            provider: process.env.TransactionProviderCreditCard,
            transactionType: process.env.TransactionTypeCredit,
            status: process.env.TransactionStatusSentToGenerate,
            clientName: foundTransaction.clientName
        });


        amountObj.value *= 100;
        amountObj.value = Math.abs(amountObj.value);

        const transactionCreated = await transaction.save()
        if (transactionCreated) {
            await addTransactionToWallet(transactionCreated)
            let query = {
                _id: transactionCreated._id
            };

            let newValues = {
                $set: {
                    status: process.env.TransactionStatusInPayment,
                    data: paymentResult
                }
            };

            const data = {
                merchantAccount: merchantAccount,
                originalReference: pspReference,
                modificationAmount: amountObj,
                reference: transactionCreated._id.toString()
            };

            let resultData = await adyenModificationObj.capture(data);
            console.log("resultData - capture", JSON.stringify(resultData))
            await transactionsUpdate(query, newValues)
            let response = await transactionFindOne(query);
            console.log("response", JSON.stringify(response))
            updateTransactionToWallet(response);
            return true
        } else {
            return false
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}



//test()
async function test() {
    try {
        let response = await startTestesAdyen('GMXVJ9CM73M84H82', "CardOnFile")
        console.log("response", response);
    } catch (error) {
        console.error(`[][catch] Error `, error.message);
    }
}
async function startTestesAdyen(paymentMethodId, recurringProcessingModel) {
    let context = "Function startTestesAdyen PaymentsAdyen";
    try {

        let paymentMethods = await PaymentMethod.findOne({ paymentMethodId: paymentMethodId });

        let transaction = new Transactions({
            amount: {
                currency: 'EUR',
                value: 2.5
            },
            userId: paymentMethods.userId,
            transactionType: process.env.ReferenceAdyenPreAuthorize,
            status: process.env.TransactionStatusSentToGenerate,
            provider: process.env.PaymentMethodCard
        })

        let transactionCreated = await createTransactions(transaction);

        let body = {
            merchantAccount: adyenMerchantAccount,
            reference: transaction._id,
            amount: transaction.amount,
            paymentMethod: {
                type: "scheme",
                storedPaymentMethodId: paymentMethods.paymentMethodId,
                encryptedCardNumber: "",
                encryptedExpiryYear: "",
                encryptedSecurityCode: "",
                holderName: "",
                encryptedExpiryMonth: ""
            },
            shopperReference: paymentMethods.userId,
            shopperInteraction: "ContAuth",
            recurringProcessingModel: recurringProcessingModel,// CardOnFile or UnscheduledCardOnFile
            additionalData: {
                authorisationType: process.env.AdyenAuthorisationTypePreAuth
            }
        };

        body.amount.value *= 100;
        body.amount.value = Math.abs(body.amount.value);

        let adyenResponse = await checkout.payments(body);

        console.log("adyenResponse - ", adyenResponse)

        let status;
        switch (adyenResponse.resultCode) {
            case 'Error':
                status = process.env.TransactionStatusFaild;
                break;
            case 'Refused':
                status = process.env.TransactionStatusFaild;
                break;
            default:
                adyenResponse.amount.value = Math.abs(adyenResponse.amount.value);
                status = process.env.TransactionStatusInPayment;
                adyenResponse.amount.value /= 100;
                break;
        };

        let query = {
            _id: transaction._id
        };

        let valuesTransation = {
            $set: {
                status: status,
                adyenReference: adyenResponse.pspReference,
                data: adyenResponse
            }
        };

        let transactionUpdated = await Transactions.findOneAndUpdate(query, valuesTransation, { new: true });

        return transactionUpdated;

    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
        throw error;
    };
}

let taskPreAuthorize;
// initJobPreAuthorize("*/1 * * * *")
//     .then(() => {
//         taskPreAuthorize.start();
//         console.log("Check pre-authorize Job Started")
//     })
//     .catch(error => {
//         console.error("Error starting check pre-authorize Job: " + error.message)
//     });

function initJobPreAuthorize(timer) {
    return new Promise((resolve, reject) => {

        taskPreAuthorize = cron.schedule(timer, () => {
            console.log('Running Job check pre-authorize: ' + new Date().toISOString());
            checkPreAuthorize();
        }, {
            scheduled: false
        });

        resolve();

    });
};

//checkPreAuthorize()
async function checkPreAuthorize() {
    let context = "Function checkPreAuthorize"
    try {
        let query = {
            transactionType: process.env.TransactionTypePreAuthorize,
            status: process.env.TransactionStatusInPayment
        }

        try {

            var transactions = await Transactions.find(query)

        } catch (error) {

            console.error(`[${context}][catch] Error `, error.message)

        }

        if (transactions.length > 0) {
            for await (const transaction of transactions) {
                let response;
                switch (process.env.NODE_ENV) {
                    case 'production':
                        response = await modifyTheAuthorisation(transaction)
                        break;
                    case 'pre-production':
                        response = await modifyTheAuthorisation(transaction)
                        break;
                    default:
                        response = await modifyTheAuthorisation(transaction)
                        break;
                }
                console.log("response - ", response)
            }
        }
    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
    }

}

async function modifyTheAuthorisation(transaction) {
    let context = "Function modifyTheAuthorisation"

    console.log(`[${context}] date ${new Date()}`)

    let body = {
        originalReference: transaction.adyenReference,
        modificationAmount: {
            currency: "EUR",
            value: (transaction.amount.value + 2.5) * 100
        },
        additionalData: {
            industryUsage: "DelayedCharge",
            encryptedCardNumber: "",
            encryptedExpiryYear: "",
            encryptedSecurityCode: "",
            holderName: "",
            encryptedExpiryMonth: ""
        },
        reference: transaction._id,
        merchantAccount: adyenMerchantAccount
    };

    try {

        let response = await modification.adjustAuthorisation(body);

        let newValues = {
            $set: {
                amount: {
                    currency: "EUR",
                    value: (transaction.amount.value + 2.5)
                }
            }
        }

        let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transaction._id }, newValues, { new: true });

        return transactionUpdated;

    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
        throw error
    }
}

async function modifyTheAuthorisationPre(transaction) {
    let context = "Function modifyTheAuthorisationPre"
    //console.log("transaction - ", transaction)

    let host = `https://checkout-test.adyen.com/v70/payments/${transaction.adyenReference}/amountUpdates`

    let data = {
        amount: {
            currency: "EUR",
            value: (transaction.amount.value + 2.5) * 100
        },
        industryUsage: "DelayedCharge",
        reference: transaction._id,
        merchantAccount: adyenMerchantAccount
    };

    try {
        let response = await axios.post(host, data)

        console.log("response - ", response.data)

        let newValues = {
            $set: {
                amount: {
                    currency: "EUR",
                    value: (transaction.amount.value + 2.5)
                }
            }
        }

        let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transaction._id }, newValues, { new: true });

        return transactionUpdated;

    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
        throw error
    }

}

async function stopTestesAdyen(req) {
    let context = "Function stopTestesAdyen PaymentsAdyen";
    try {

        let query = {
            transactionType: process.env.TransactionTypePreAuthorize,
            status: process.env.TransactionStatusInPayment
        }

        let value = req.body.value;

        console.log("value - ", value);
        console.log("value - ", typeof value);

        let transactions = await Transactions.find(query)

        if (transactions.length > 0) {
            for await (const transaction of transactions) {
                let response;
                switch (process.env.NODE_ENV) {
                    case 'production':
                        response = await captureTheAuthorisation(transaction, value)
                        break;
                    case 'pre-production':
                        response = await captureTheAuthorisation(transaction, value)
                        break;
                    default:
                        response = await captureTheAuthorisation(transaction, value)
                        break;
                }
                console.log("response - ", response)
                return response
            }
        }

    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
        throw error;
    };
}

async function captureTheAuthorisation(transaction, value) {
    let context = "Function modifyTheAuthorisation"
    try {

        //let newValue = value;
        let payment = new Payments({
            amount: {
                currency: "EUR",
                value: value
            },
            status: process.env.PaymentStatusStartPayment,
            paymentMethod: process.env.PaymentMethodCard,
            transactionId: transaction._id,
            adyenReference: transaction.adyenReference,
            userId: transaction.userId,
            clientName: "EVIO"
        })

        let paymentCreated = await createPayments(payment);

        let newTransactions = {
            paymentId: payment._id,
            amount: {
                currency: "EUR",
                value: value
            },
            transactionType: process.env.TransactionTypeDebit,
            status: process.env.TransactionStatusSentToGenerate
        }

        let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transaction._id }, { $set: newTransactions }, { new: true });

        let data = {
            merchantAccount: adyenMerchantAccount,
            modificationAmount: {
                currency: "EUR",
                value: value * 100
            },
            originalReference: transaction.adyenReference,
            reference: transaction._id
        };

        let response = await modification.capture(data);

        if (response) {
            let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transaction._id }, { $set: { status: process.env.TransactionStatusInPayment } }, { new: true });
            let paymentUpdated = await Payments.findOneAndUpdate({ _id: payment._id }, { $set: { status: process.env.PaymentStatusInPayment } }, { new: true });
        }

        return response

    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
        throw error;
    };
}


async function captureTheAuthorisationPre(transaction) {
    let context = "Function captureTheAuthorisationPre"
    try {
        let newValue = transaction.amount.value - 1;

        let host = `https://checkout-test.adyen.com/v70/payments/${transaction.adyenReference}/captures`

        let payment = new Payments({
            amount: {
                currency: "EUR",
                value: newValue
            },
            status: process.env.PaymentStatusStartPayment,
            paymentMethod: process.env.PaymentMethodCard,
            transactionId: transaction._id,
            adyenReference: transaction.adyenReference,
            userId: transaction.userId,
            clientName: "EVIO"
        })

        let paymentCreated = await createPayments(payment);


        let newTransactions = {
            paymentId: payment._id,
            amount: {
                currency: "EUR",
                value: newValue
            },
            transactionType: process.env.TransactionTypeDebit,
            status: process.env.TransactionStatusSentToGenerate
        }

        let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transaction._id }, { $set: newTransactions }, { new: true });

        let data = {
            merchantAccount: adyenMerchantAccount,
            amount: {
                currency: "EUR",
                value: newValue * 100
            },
            reference: transaction._id
        };

        let response = await axios.post(host, data);

        if (response.data) {
            let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transaction._id }, { $set: { status: process.env.TransactionStatusInPayment } }, { new: true });
            let paymentUpdated = await Payments.findOneAndUpdate({ _id: payment._id }, { $set: { status: process.env.PaymentStatusInPayment } }, { new: true });
        }

        return response.data

    } catch (error) {
        console.error(`[${context}][catch] Error `, error.message);
        throw error;
    };
}


async function createPayments(payment) {
    let context = "Funciton createPayments";
    Payments.createPayments(payment, (err, result) => {
        if (err) {

            console.error(`[${context}][createTransactions] Error `, err.message);
            throw err

        }
        else {

            return (result);

        }
    })
}
async function removeCardFromAdyen(userId, recurringDetailReference, clientName) {
    let context = "Function removeCardFromAdyen";
    try {
        const body = {
            merchantAccount: adyenMerchantAccount,
            shopperReference: userId,
            recurringDetailReference: recurringDetailReference
        };

        if (clientName === process.env.clientNameSC || clientName === process.env.clientNameHyundai) {
            body.merchantAccount = adyenMerchantAccountSC
            await recurringSC.disable(body)
        } else {
            await recurring.disable(body)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function adyenRefusalReasonCodes(refusalReasonCode) {
    const context = "Function adyenRefusalReasonCodes"
    try {
        const found = await RefusalReasonCode.findOne({ refusalReasonCode }).lean()
        return { auth: false, code: found?.key ?? 'server_paymentMethod_refused', message: found?.description ?? "The provided payment method was refused" }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: 'server_paymentMethod_refused', message: 'The provided payment method was refused' }
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
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
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

function removeInvalidKeysFromNotification(notification) {
    const keysToDelete = [
        'additionalData.cardFunction',
        'additionalData.tokenization.storedPaymentMethodId',
        'additionalData.checkout.cardAddedBrand',
        'additionalData.tokenization.shopperReference',
        'additionalData.recurringProcessingModel',
        'additionalData.captureDelayHours',
        'additionalData.bookingDate'
    ];

    for (const key of keysToDelete) {
        delete notification[key];
    }
}

async function createRefundTransaction(originalTransaction, notification) {
    const refund = new Transactions({
        userId: originalTransaction.userId,
        transactionType: process.env.TransactionTypeRefund,
        status: notification.success === false
            ? process.env.TransactionStatusRefundFaild
            : process.env.TransactionStatusRefund,
        createdAt: new Date(),
        updatedAt: new Date(),
        originalTransactionId: originalTransaction._id,
        amount: originalTransaction.amount,
        dataReceived: notification,
        sessionId: originalTransaction.sessionId,
        notes: 'Manual refund made from Adyen'
    });

    await refund.save();
    return refund;
}

async function createRefundPayment(originalPayment, notification, refundTransactionId) {
    const refundPayment = new Payments({
        status: process.env.PaymentStatusRefund,
        reason: 'Manual refund made from Adyen',
        amount: notification.amount,
        adyenReference: originalPayment.adyenReference,
        dataReceived: notification,
        createdAt: new Date(),
        updatedAt: new Date(),
        clientName: originalPayment.clientName,
        sessionId: originalPayment.sessionId,
        paymentAdyenId: originalPayment.paymentAdyenId,
        paymentMethod: originalPayment.paymentMethod,
        paymentMethodId: originalPayment.paymentMethodId,
        transactionId: refundTransactionId.toString()
    });

    await refundPayment.save();
}

async function updateAlreadyExistingCard(responseObj, paymentResult, userId, paymentMethodId, foundTransaction) {
    const context = "Function updateAlreadyExistingCard";
    let tokenOperationType = null;

    try {
        tokenOperationType = paymentResult?.additionalData["tokenization.store.operationType"];
    }
    catch (error) {
        console.log("error parsing tokenOperationType: ", error.message);
    }

    if (tokenOperationType == 'alreadyExisting' || tokenOperationType == 'updated') {
        await Promise.all([
            PaymentMethod.findOneAndUpdate({ userId: userId, paymentMethodId: paymentMethodId }, { $set: { status: process.env.PaymentMethodStatusApproved } }),
            transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: paymentResult, status: process.env.TransactionStatusPaidOut } })
        ]);

        const message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
        responseObj.success = true
        responseObj.statusCode = 200
        responseObj.logData = message
        responseObj.data = message

        console.info(`[${context}] - Logs`, {
            userId,
            step: 'PaymentMethod.findOne',
            status: 'warning',
            message: 'Card already exists, status updated',
            timestamp: new Date().toISOString()
        });
    }
    else {
        await transactionsUpdate({ _id: foundTransaction._id.toString() }, { $set: { paymentsResponseData: paymentResult, status: process.env.TransactionStatusFaild } });

        const message = { auth: false, code: 'server_card_already_exists', message: "Card already exists" }
        responseObj.success = false
        responseObj.statusCode = 400
        responseObj.logData = message
        responseObj.data = message

        console.info(`[${context}] - Logs`, {
            userId,
            step: 'PaymentMethod.findOne',
            status: 'warning',
            message: 'Card already exists',
            timestamp: new Date().toISOString()
        });
    }
}


module.exports = router;
