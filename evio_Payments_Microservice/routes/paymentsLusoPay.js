const express = require('express');
const router = express.Router();
const Transactions = require('../models/transactions');
const Wallet = require('../models/wallet');
const RequestHistoryLogs = require('../models/requestHistoryLogs');
const NotificationsPayments = require('../models/notificationsPayments');
const Payments = require('../models/payments');
const axios = require("axios");
const UUID = require('uuid-js');
const soap = require('soap');
const fs = require('fs');
const RequestIp = require('@supercharge/request-ip');
const Invoices = require('../handlers/invoices');
const { constants } = require('crypto');
const ExternalRequestHandlers = require("../handlers/externalRequest");
const configsPaymentsModel = require("../models/configsPayments")
const mongoConnections = require('evio-library-connections').default;
const Constants = require('../utils/constants')

require("dotenv-safe").load();

//Data of EVIO
var lusopayClientGUID;
var lusopayNif;
var LusoPayClient;
var lusoPayLowerLimit = process.env.LusoPayLowerLimit
var lusoPayUpperLimit = process.env.LusoPayUpperLimit

//Data of Salvador Caetano
var LusoPayClientSC;
var lusopayClientGUIDSC;
var lusopayNifSC;

var url;
var urlSlave;
switch (process.env.NODE_ENV) {
    case 'production':

        url = process.env.LusopayMasterUrl;
        urlSlave = process.env.LusopaySlaveUrl;
        lusopayClientGUID = process.env.LusopayClientGUID;
        lusopayNif = process.env.LusopayNif;
        lusopayClientGUIDSC = process.env.LusopayClientGUIDSC;
        lusopayNifSC = process.env.LusopayNifSC;

        break;
    case 'development':

        url = process.env.LusopayTestUrl;
        urlSlave = process.env.LusopayTestUrl;
        lusopayClientGUID = process.env.LusopayTestClientGUID;
        lusopayNif = process.env.LusopayTestNif;
        lusopayClientGUIDSC = process.env.LusopayTestClientGUIDSC;
        lusopayNifSC = process.env.LusopayTestNifSC;

        break;
    case 'pre-production':

        url = process.env.LusopayTestUrl;
        urlSlave = process.env.LusopayTestUrl;
        lusopayClientGUID = process.env.LusopayTestClientGUID;
        lusopayNif = process.env.LusopayTestNif;
        lusopayClientGUIDSC = process.env.LusopayTestClientGUIDSC;
        lusopayNifSC = process.env.LusopayTestNifSC;

        break;
    default:

        url = process.env.LusopayTestUrl;
        urlSlave = process.env.LusopayTestUrl;
        lusopayClientGUID = process.env.LusopayTestClientGUID;
        lusopayNif = process.env.LusopayTestNif;
        lusopayClientGUIDSC = process.env.LusopayTestClientGUIDSC;
        lusopayNifSC = process.env.LusopayTestNifSC;

        break;
}

soap.createClient(url, (err, client) => {
    if (err) {

        soap.createClient(urlSlave, (err, client) => {
            if (err) {
                console.error(`[soap.createClient] Error `, err.message);
            }
            else {
                console.log("Connect to client LusoPay", client);
                LusoPayClient = client;
            };
        });

        //console.error(`Error `, err);
    }
    else {
        console.log("Connect to client LusoPay");
        LusoPayClient = client;
    };
});

/*soap.createClient(url, (err, client) => {
    if (err) {

        soap.createClient(urlSlave, (err, client) => {
            if (err) {
                console.error(`[soap.createClient] Error `, err.message);
            }
            else {
                console.log("Connect to client LusoPay SC", client);
                LusoPayClientSC = client;
            };
        });

        //console.error(`Error `, err);
    }
    else {
        console.log("Connect to client LusoPay SC");
        LusoPayClientSC = client;
    };
});*/

router.use("/api/private/paymentsLusoPay/sendMBWayRequest", async (req, res, next) => {
    if (!await allowedToUseMBWay(req, res))
        return

    next()
})

//========== POST ==========
//Post to send a new MB Way request
router.post('/api/private/paymentsLusoPay/sendMBWayRequest', async (req, res, next) => {
    var context = "POST /api/private/paymentsLusoPay/sendMBWayRequest";
    try {
        var body = req.body;
        var userId = req.headers['userid'];
        let clientName = req.headers['clientname'];

        if (!userId) {
            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;
        };

        /*validateFieldsSendMBWayRequest(body)
            .then(async () => {*/

        //Creat new transaction
        var transaction = new Transactions({
            userId: userId,
            amount: body.amount,
            provider: process.env.TransactionProviderMBWay,
            transactionType: process.env.TransactionTypeCredit,
            status: process.env.TransactionStatusSentToGenerate,
            clientName: clientName
        });

        //Creat arguments for send to LusoPay
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    cellPhoneNumber: body.cellPhoneNumber,
                    amount: body.amount.value.toString(),
                    externalReference: transaction._id.toString(),
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    cellPhoneNumber: body.cellPhoneNumber,
                    amount: body.amount.value.toString(),
                    externalReference: transaction._id.toString(),
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    cellPhoneNumber: body.cellPhoneNumber,
                    amount: body.amount.value.toString(),
                    externalReference: transaction._id.toString(),
                    sendEmail: false
                };
                break;
        };

        Transactions.createTransactions(transaction, (err, transactionCreated) => {
            if (err) {
                console.error(`[${context}][createTransactions] Error `, err.message);
                res.status(500).send(err);
                saveRequestHistoryLogs(req, res, err);
                return res;
            };

            addTransactionToWallet(transaction)
                .then((result) => {

                    LusoPayClient.sendMBWayRequest(arg, (err, sendMBWayRequest) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                            res.status(500).send(err);
                            saveRequestHistoryLogs(req, res, err);
                            return res;
                        };

                        if (sendMBWayRequest.sendMBWayRequestResult.message == "GUID does not match any client.") {
                            var message = { auth: false, code: 'server_not_authorized', message: "Unauthorized request!" };
                            res.status(400).send(message);
                            saveRequestHistoryLogs(req, res, message);
                            return res;

                        }
                        else {
                            var query = {
                                _id: transactionCreated._id
                            };
                            var newValues = {
                                $set: {
                                    status: process.env.TransactionStatusInPayment,
                                    data: sendMBWayRequest.sendMBWayRequestResult
                                }
                            };

                            transactionsUpdate(query, newValues)
                                .then(async (result) => {

                                    let response = await transactionFindOne(query);
                                    var responseToFrontEnd = sendMBWayRequest.sendMBWayRequestResult;
                                    responseToFrontEnd.transactionId = transactionCreated._id.toString();

                                    updateTransactionToWallet(response);

                                    const { statusCode, amount, ...filteredResponse } = responseToFrontEnd;

                                    if (responseToFrontEnd.message == "OK") {
                                        const responsePayload = {
                                            ...filteredResponse,
                                            code: 'payments_mbway_enabled',
                                            message: "Payment request made on the mbway app"
                                        };
                                        saveRequestHistoryLogs(req, res, responsePayload);
                                        return res.status(200).send(responsePayload);
                                    }
                                    else {
                                        const responsePayload = {
                                            ...filteredResponse,
                                            code: 'payments_mbway_disabled',
                                            message: "The MB WAY number used does not have the service enabled."
                                        };
                                        saveRequestHistoryLogs(req, res, responsePayload);
                                        return res.status(400).send(responsePayload);
                                    };

                                })
                                .catch((error) => {

                                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                    res.status(500).send(error.message);
                                    saveRequestHistoryLogs(req, res, error);
                                    return res;

                                });
                        };

                    });

                })
                .catch((error) => {

                    console.error(`[${context}][addTransactionToWallet] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Post to generate new reference
//TODO - 4.2 (Don't use)
router.post('/api/private/paymentsLusoPay/generateNewReference', (req, res, next) => {
    var context = "POST /api/private/paymentsLusoPay/generateNewReference";
    try {

        var body = req.body;
        var userId = req.headers['userid'];
        console.log("body", body);
        let clientName = req.headers['clientname'];

        //Creat new transaction
        var transaction = new Transactions({
            userId: userId,
            amount: { value: body.amount },
            provider: process.env.TransactionProviderMBReference,
            status: process.env.TransactionStatusSentToGenerate,
            transactionType: process.env.TransactionTypeCredit,
            clientName: clientName
        });

        //Creat arguments for send to LusoPay
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    amount: body.amount,
                    referenceId: transaction._id.toString(),
                    sendEmail: false
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    amount: body.amount,
                    referenceId: transaction._id.toString(),
                    sendEmail: false
                };
                break;
            default:
                arg = {
                    key: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    amount: body.amount,
                    referenceId: transaction._id.toString(),
                    sendEmail: false
                };
                break;
        };

        //Create transaction status 10 and type credit
        Transactions.createTransactions(transaction, (err, transactionCreated) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err);
                return res;

            }
            else {

                //Create new reference MB on lusopay
                LusoPayClient.getNewReference(arg, (err, newReference) => {
                    if (err) {

                        console.error(`[${context}][getNewReference] Error `, err.message);
                        res.status(500).send(err.message);
                        saveRequestHistoryLogs(req, res, err);
                        return res;

                    }
                    else {

                        //transactionCreated.status = process.env.TransactionStatusInPayment;
                        //transactionCreated.data = newReference.getNewReferenceResult;

                        var query = {
                            _id: transactionCreated._id
                        };
                        var newValues = {
                            $set: {
                                status: process.env.TransactionStatusInPayment,
                                data: newReference.getNewReferenceResult
                            }
                        };

                        transactionsUpdate(query, newValues)
                            .then((result) => {

                                console.log("newReference", newReference);

                                res.status(200).send(newReference);
                                saveRequestHistoryLogs(req, res, newReference);
                                return res;

                            })
                            .catch((error) => {

                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            });

                    };
                });
            }
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Post to generate  new MB reference and PS dynamic 
router.post('/api/private/paymentsLusoPay/generateNeWDynamicReference', async (req, res, next) => {
    const context = "POST /api/private/paymentsLusoPay/generateNeWDynamicReference";
    try {

        const body = req.body;
        const userId = req.headers['userid'];
        const clientName = req.headers['clientname'];

        try {
            if (!userId) throw { auth: false, code: 'server_userId_required', message: "User id is required" };
            await validateFieldsGenerateNeWDynamicReference(body);
        } catch (error) {
            console.log('error', error);
            saveRequestHistoryLogs(req, res, error);
            return res.status(400).send(error);
        }

        console.log("arg 1 ", clientName);
        var transaction = new Transactions({
            userId: userId,
            provider: process.env.TransactionProviderMBReferencePayShopNet,
            status: process.env.TransactionStatusSentToGenerate,
            transactionType: process.env.TransactionTypeCredit,
            amount: body.amount,
            clientName: clientName
        });

        //Creat arguments for send to LusoPay
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    valueList: [
                        {
                            References: {
                                amount: body.amount.value,
                                description: transaction._id.toString(),
                                serviceType: 'Both'
                            }

                        }
                    ],
                    sendEmail: false
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    valueList: [
                        {
                            References: {
                                amount: body.amount.value,
                                description: transaction._id.toString(),
                                serviceType: 'Both'
                            }

                        }
                    ],
                    sendEmail: false
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    valueList: [
                        {
                            References: {
                                amount: body.amount.value,
                                description: transaction._id.toString(),
                                serviceType: 'Both'
                            }

                        }
                    ],
                    sendEmail: false
                };
                break;
        };

        //Create transaction status 10 and type credit
        Transactions.createTransactions(transaction, (err, transactionCreated) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err);
                return res;

            }

            addTransactionToWallet(transaction)
                .then((result) => {
                    //Create new reference MB on lusopay
                    LusoPayClient.getNewDynamicReference(arg, (err, newReference) => {
                        console.log(context, ' - mbref arg', arg)
                        console.log(context, ' - mbref response', newReference)
                        if (err) {

                            console.error(`[${context}][getNewReference] Error `, err.message);
                            res.status(500).send(err.message);
                            saveRequestHistoryLogs(req, res, err);
                            return res;

                        }
                        else {

                            if (newReference.getNewDynamicReferenceResult.ReferencesGenerationFeedback.entityMB === null) {

                                var message = { auth: false, code: 'server_not_authorized', message: "Unauthorized request!" };
                                res.status(400).send(message);
                                saveRequestHistoryLogs(req, res, message);
                                return res;

                            }
                            else {
                                var referenceReceived = newReference.getNewDynamicReferenceResult.ReferencesGenerationFeedback;;

                                var query = {
                                    _id: transactionCreated._id
                                };
                                var newValues = {
                                    $set: {
                                        status: process.env.TransactionStatusInPayment,
                                        data: referenceReceived
                                    }
                                };

                                console.log(context, " -transaction.amount: ", transaction.amount);
                                referenceReceived = Array.isArray(referenceReceived) ? referenceReceived[0] : referenceReceived;
                                referenceReceived.amount = transaction.amount
                                console.log(context, " -referenceReceived: ", referenceReceived);
                                transactionsUpdate(query, newValues)
                                    .then(async (result) => {

                                        let response = await transactionFindOne(query);
                                        updateTransactionToWallet(response);
                                        res.status(200).send(referenceReceived);
                                        saveRequestHistoryLogs(req, res, referenceReceived);
                                        return res;

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                        res.status(500).send(error.message);
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;

                                    });
                            };
                        };
                    });


                })
                .catch((error) => {

                    console.error(`[${context}][addTransactionToWallet] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        });
        /*})
        .catch((error) => {

            console.log("clientName 1 ", clientName);
            res.status(400).send(error);
            saveRequestHistoryLogs(req, res, error);
            return res;

        });*/


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.post('/api/private/paymentsLusoPay/generateDynamicReference', (req, res, next) => {
    var context = "POST /api/private/paymentsLusoPay/generateDynamicReference";
    try {
        var body = req.body;
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];
        validateFieldsGenerateNeWDynamicReference(body)
            .then(async () => {
                //Creat new transaction
                var transaction = new Transactions({
                    userId: userId,
                    amount: body.amount,
                    provider: process.env.TransactionProviderMBReferencePayShopNet,
                    status: process.env.TransactionStatusSentToGenerate,
                    transactionType: process.env.TransactionTypeCredit,
                    amount: body.amount,
                    clientName: clientName
                });

                //Creat arguments for send to LusoPay
                var arg;

                switch (clientName) {
                    case process.env.clientNameSC:
                        arg = {
                            clientGuid: lusopayClientGUIDSC,
                            vatNumber: lusopayNifSC,
                            valueList: [
                                {
                                    References: {
                                        amount: body.amount.value,
                                        description: transaction._id.toString(),
                                        serviceType: 'Both'
                                    }

                                }
                            ],
                            sendEmail: false
                        };
                        break;
                    case process.env.clientNameHyundai:
                        arg = {
                            clientGuid: lusopayClientGUIDSC,
                            vatNumber: lusopayNifSC,
                            valueList: [
                                {
                                    References: {
                                        amount: body.amount.value,
                                        description: transaction._id.toString(),
                                        serviceType: 'Both'
                                    }

                                }
                            ],
                            sendEmail: false
                        };
                        break;
                    default:
                        arg = {
                            clientGuid: lusopayClientGUID,
                            vatNumber: lusopayNif,
                            valueList: [
                                {
                                    References: {
                                        amount: body.amount.value,
                                        description: transaction._id.toString(),
                                        serviceType: 'Both'
                                    }

                                }
                            ],
                            sendEmail: false
                        };
                        break;
                };

                //Create transaction status 10 and type credit
                Transactions.createTransactions(transaction, (err, transactionCreated) => {
                    if (err) {
                        console.error(`[${context}][createTransactions] Error `, err.message);
                        res.status(500).send({ auth: false, code: 'mbReference_error', message: err.message });
                        saveRequestHistoryLogs(req, res, err);
                        return res;
                    }
                    else {
                        //Create new reference MB on lusopay
                        LusoPayClient.getNewDynamicReference(arg, (err, newReference) => {
                            console.log(context, ' - mbref arg', arg)
                            console.log(context, ' - mbref response', newReference)
                            if (err) {
                                console.error(`[${context}][getNewReference] Error `, err.message);
                                saveRequestHistoryLogs(req, res, err);
                                return res.status(500).send({ auth: false, code: 'mbReference_error', message: err.message });
                            }
                            else {
                                var referenceReceived = newReference.getNewDynamicReferenceResult.ReferencesGenerationFeedback;

                                if (!referenceReceived.referenceMB || referenceReceived.referenceMB === '-1' || !transaction.amount.value) {
                                    console.error(`[${context}][getNewDynamicReference] Error `, referenceReceived.message);
                                    saveRequestHistoryLogs(req, res, err);
                                    return res.status(500).send({ auth: false, code: 'mbReference_error', message: referenceReceived.message });
                                }

                                var query = {
                                    _id: transactionCreated._id
                                };
                                var newValues = {
                                    $set: {
                                        status: process.env.TransactionStatusInPayment,
                                        data: referenceReceived
                                    }
                                };

                                console.log(context, " -transaction.amount: ", transaction.amount);
                                referenceReceived = Array.isArray(referenceReceived) ? referenceReceived[0] : referenceReceived;
                                referenceReceived.amount = transaction.amount
                                console.log(context, " -referenceReceived: ", referenceReceived);

                                transactionsUpdate(query, newValues)
                                    .then(async (result) => {
                                        res.status(200).send(referenceReceived);
                                        saveRequestHistoryLogs(req, res, referenceReceived);
                                        return res;
                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                        res.status(500).send({ auth: false, code: 'mbReference_error', message: error.message });
                                        saveRequestHistoryLogs(req, res, error);
                                        return res;

                                    });
                            };
                        });

                    };
                });
            })
            .catch((error) => {

                res.status(400).send(error);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send({ auth: false, code: 'mbReference_error', message: error.message });
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Post to generate a Pay Shop net reference
//TODO - 4.10 (Don't use)
router.post('/api/private/paymentsLusoPay/generateNewReferencePayshopNet', (req, res, next) => {
    var context = "POST /api/private/paymentsLusoPay/generateNewReferencePayshopNet";
    try {

        var body = req.body;
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];
        //Creat new transaction
        var transaction = new Transactions({
            userId: userId,
            amount: { value: body.amount },
            provider: process.env.TransactionProviderPayShopNet,
            status: process.env.TransactionStatusSentToGenerate,
            transactionType: process.env.TransactionTypeCredit,
            amount: {
                value: body.amount
            },
            clientName: clientName
        });

        var limitDate = new Date();
        limitDate.setDate(limitDate.getDate() + 5);

        //Creat arguments for send to LusoPay
        var arg;
        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    amount: body.amount,
                    referenceId: transaction._id.toString(),
                    sendEmail: false,
                    limitDate: limitDate
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    amount: body.amount,
                    referenceId: transaction._id.toString(),
                    sendEmail: false,
                    limitDate: limitDate
                };
                break;
            default:
                arg = {
                    key: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    amount: body.amount,
                    referenceId: transaction._id.toString(),
                    sendEmail: false,
                    limitDate: limitDate
                };
                break;
        };

        //Create transaction status 10 and type credit
        Transactions.createTransactions(transaction, (err, transactionCreated) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err);
                return res;

            }
            else {


                //Create new reference Pay shop net on lusopay
                LusoPayClient.getNewReferencePayshopNet(arg, (err, newReference) => {
                    if (err) {

                        console.error(`[${context}][getNewReferencePayshopNet] Error `, err.message);
                        res.status(500).send(err.message);
                        saveRequestHistoryLogs(req, res, err);
                        return res;

                    }
                    else {

                        var referenceReceived = newReference;
                        //transactionCreated.status = process.env.TransactionStatusInPayment;
                        //transactionCreated.data = referenceReceived;

                        var query = {
                            _id: transactionCreated._id
                        };
                        var newValues = {
                            $set: {
                                status: process.env.TransactionStatusInPayment,
                                data: referenceReceived
                            }
                        };

                        transactionsUpdate(query, newValues)
                            .then((result) => {

                                res.status(200).send(referenceReceived);
                                saveRequestHistoryLogs(req, res, referenceReceived);
                                return res;

                            })
                            .catch((error) => {

                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                res.status(500).send(error.message);
                                saveRequestHistoryLogs(req, res, error);
                                return res;

                            });
                    };
                });

            };
        });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== Notificarions webservice ==========

//Post notifications webservice MB and Payshop
//DONE - Notificação recebida pelo LusoPay
router.post('/api/lusoPay/notificationsMBRefPayshop', async (req, res, next) => {
    const context = "POST /api/lusoPay/notificationsMBRefPayshop";
    try {

        //know the IP where the request comes from only works on production enviroment
        //Commented in DEV and QA for testing purposes
        let ipFound = RequestIp.getClientIp(req);
        let newIp = ipFound.split(':');
        const ip = newIp[newIp.length - 1];

        console.log(`${context} ipFound = ${ipFound}, newIp = ${newIp}, ip = ${ip}`);

        if (ip != process.env.MBRefIP && ip != process.env.PayshopIP && ip != process.env.LusoPayGoCharge) {

            let message = { auth: false, code: 'server_not_authorized', message: "Unauthorized request!" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }


        //Data recived
        const date = req.query.datapagamento;
        const description = req.query.descricao.toString("utf8");

        //Convert to date type
        let dateArray = date.split(' ');
        dateArray[0] = dateArray[0].split("-").reverse().join("-");
        const datePayment = new Date(dateArray[0] + " " + dateArray[1]);

        const data = {
            entity: req.query.entidade,
            reference: req.query.referencia,
            value: req.query.valor,
            datePayment: datePayment,
            description: description
        };

        const query = {
            _id: mongoConnections.stringToObjectId(description), status: process.env.TransactionStatusInPayment
        };

        const newValues = {
            $set:
            {
                status: process.env.TransactionStatusPaidOut,
                dataReceived: data
            }
        };

        try {
            const transactionFound = await transactionsUpdate(query, newValues);
            console.log("Transaction updated", transactionFound._id.toString());
            if (transactionFound) {
                sendEmailTopUpBilling(transactionFound);
                addBalanceToWallet(transactionFound);
                saveRequestHistoryLogs(req, res, transactionFound);
            }
        
            res.status(200).send(true);
        } catch (error) {
            console.error(`[${context}][transactionsUpdate] Error`, error);
            res.status(200).send(false);
            saveRequestHistoryLogs(req, res, error);
        }

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Post notifications webservice MB Way
//DONE - Notificação recebida pelo LusoPay
router.post('/api/lusoPay/notificationsMBWay', async (req, res, next) => {
    const context = "POST /api/lusoPay/notificationsMBWay";
    try {
        console.log(`[${context}] Starting process - query:`, JSON.stringify(req.query));
        //know the IP where the request comes from only works on production enviroment
        //Commented in DEV and QA for testing purposes
        let ipFound = RequestIp.getClientIp(req);
        let newIp = ipFound.split(':');
        const ip = newIp[newIp.length - 1];
        console.log(`${context} ipFound = ${ipFound}, newIp = ${newIp}, ip = ${ip}`);

        if (ip != process.env.MBWayIP) {
            let message = { auth: false, code: 'server_not_authorized', message: "Unauthorized request!" };
            console.log(`[${context}] Unauthorized IP: ${ip} | transaction: ${req.query.descricao.toString("utf8")}`);
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;
        }

        // Data received
        const description = req.query.descricao.toString("utf8");
        const statusCode = req.query.statuscode;
        let date = req.query.data;
        console.log(`[${context}] Data received: transaction=${description}, statusCode=${statusCode}, date=${date}`);

        // Convert to date type
        let dateArray = date.split(' ');
        dateArray[0] = dateArray[0].split("-").reverse().join("-");
        const datePayment = new Date(dateArray[0] + " " + dateArray[1]);

        const data = {
            desc: description,
            statusCode: statusCode,
            datePayment: datePayment,
            value: req.query.valor
        };
        console.log(`[${context}] Normalized data:`, data);

        const query = { _id: mongoConnections.stringToObjectId(description), status: process.env.TransactionStatusInPayment};

        //Payment accepted and successful (000)
        //Payment rejected by customer and unsuccessful (020)
        //Payment was not made within 5 minutes and was unsuccessful (048)
        //Payment Failed any other satatusCode
        const newValues = {
            $set:
            {
                status: (statusCode == '000' ? process.env.TransactionStatusPaidOut : statusCode == '020' ? process.env.PaymentStatusRefused : statusCode == '048' ? process.env.PaymentStatusCanceled : process.env.TransactionStatusFaild),
                dataReceived: data
            }
        };
        console.log(`[${context}] | Transaction: ${description} | Values for update:`, newValues);

        try {
            const transactionFound = await transactionsUpdate(query, newValues);
            if (transactionFound) {
                console.log(`[${context}] Transaction updated:`, transactionFound._id.toString());
                if (statusCode === '000') {
                    sendEmailTopUpBilling(transactionFound);
                    addBalanceToWallet(transactionFound);
                } else {
                    updateTransactionToWallet(transactionFound);
                }
            } else {
                console.log(`[${context}] No transaction found for update.`);
            }

            res.status(200).send(true);
            saveRequestHistoryLogs(req, res, transactionFound);
            console.log(`[${context}] | Process finished - Success | Transaction: ${description}`);
        } catch (error) {
            console.error(`[${context}][transactionsUpdate] Error`, error);
            res.status(200).send(false);
            saveRequestHistoryLogs(req, res, error);
            console.log(`[${context}] | Process finished - Failed | Transaction: ${description}`);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        console.log(`[${context}] | Process finished - Failed | Transaction: ${req.query.descricao.toString("utf8")}`);
        return res;
    };
});

//========== PATCH ==========
//Send MB Reference by SMS
router.patch('/api/private/paymentsLusoPay/sendSMS', (req, res, next) => {
    var context = "PATCH /api/private/paymentsLusoPay/sendSMS";
    try {

        var body = req.body;
        var host = process.env.NotificationsHost + process.env.PathSentSMS;

        var params = body;
        var headers = {
            ...axios.default.headers,
            clientName: req.headers?.clientname,
        }

        axios.post(host, params, {headers: headers})
            .then((result) => {
                if (result.data) {
                    res.status(200).send(result.data);
                    saveRequestHistoryLogs(req, res, result.data);
                    return res;
                }
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                res.status(500).send(error.message);
                saveRequestHistoryLogs(req, res, error.message);
                return res;
            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//========== GET ==========
//Get movements by user
//DONE - 4.1
router.get('/api/private/paymentsLusoPay/getMovementsByUser', (req, res, next) => {
    const context = "GET /api/private/paymentsLusoPay/getMovementsByUser";
    try {

        let body = req.body;
        let clientName = req.headers['clientname'];

        movementsByUser(body, clientName)
            .then((result) => {

                if (result) {

                    let message = { auth: true, code: 'server_movements_updated', message: "Movements are updated" };
                    res.status(200).send(result);
                    saveRequestHistoryLogs(req, res, result);
                    return res;

                } else {

                    let message = { auth: false, code: 'server_no_movements', message: "Don't have movements" };
                    res.status(400).send(message);
                    saveRequestHistoryLogs(req, res, result);
                    return res;

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                res.status(500).send(error.message);
                saveRequestHistoryLogs(req, res, error);
                return res;

            });

        /*var arg = {
            clientGuid: process.env.LusopayClientGUID,
            vatNumber: process.env.LusopayNif,
            movementType: body.movementType,
            numOfItemsPerPage: body.numOfItemsPerPage,
            pageNumber: body.pageNumber,
            startDate: body.startDate,
            endDate: body.endDate
        };*/

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Get new dynamic movements
//DONE - 4.7 - Need test
router.get('/api/private/paymentsLusoPay/getNewDynamicMovements', (req, res, next) => {
    var context = "GET /api/private/paymentsLusoPay/getNewDynamicMovements";
    try {

        var body = req.body;
        var clientName = req.headers['clientname'];

        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    lastId: body.lastId
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    lastId: body.lastId
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    lastId: body.lastId
                };
                break;
        };

        LusoPayClient.getNewDynamicMovements(arg, (err, result) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err);
                return res;

            }
            else {

                res.status(200).send(result);
                saveRequestHistoryLogs(req, res, result);
                return res;

            };
        });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Get new dynamic by date
//DONE - 4.8 - Need test
router.get('/api/private/paymentsLusoPay/getNewDynamicMovementsByDates', (req, res, next) => {
    var context = "GET /api/private/paymentsLusoPay/getNewDynamicMovementsByDates";
    try {

        var body = req.body;
        var clientName = req.headers['clientname'];
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
        };

        LusoPayClient.getNewDynamicMovementsByDates(arg, (err, result) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err);
                return res;

            }
            else {

                res.status(200).send(result.getNewDynamicMovementsByDatesResult);
                saveRequestHistoryLogs(req, res, result.getNewDynamicMovementsByDatesResult);
                return res;

            };
        });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Get Balance By User 
//DONE
router.get('/api/private/paymentsLusoPay/getBalanceByUser', (req, res, next) => {
    var context = "GET /api/private/paymentsLusoPay/getBalanceByUser";
    try {

        var clientName = req.headers['clientname'];
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif
                };
                break;
        };

        LusoPayClient.getNewMovements(arg, (err, result) => {
            if (err) {

                console.error(`[${context}][getNewMovements] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            }
            else {

                res.status(200).send(result.getNewMovementsResult);
                saveRequestHistoryLogs(req, res, result.getNewMovementsResult);
                return res;

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get new movements (Reff payed)
//TODO - 4.3 (Don't use)
router.get('/api/private/paymentsLusoPay/getNewMovements', (req, res, next) => {
    var context = "GET /api/private/paymentsLusoPay/getNewMovements";
    try {

        var body = req.body;
        var clientName = req.headers['clientname'];
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    lastId: body.lastId
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    lastId: body.lastId
                };
                break;
            default:
                arg = {
                    key: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    lastId: body.lastId
                };
                break;
        };

        LusoPayClient.getNewMovements(arg, (err, result) => {
            if (err) {

                console.error(`[${context}][getNewMovements] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            }
            else {

                res.status(200).send(result.getNewMovementsResult);
                saveRequestHistoryLogs(req, res, result.getNewMovementsResult);
                return res;

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get the date on which LUSOPAY made the return of funds to the client;
//TODO - 4.4 (Don't use)
router.get('/api/private/paymentsLusoPay/getPaymentDate', (req, res, next) => {
    var context = "GET /api/private/paymentsLusoPay/getPaymentDate";
    try {

        var query = req.query;
        var clientName = req.headers['clientname'];
        var arg;

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    id: query.id
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    key: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    id: query.id
                };
                break;
            default:
                arg = {
                    key: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    id: query.id
                };
                break;
        };

        LusoPayClient.getPaymentDate(arg, (err, result) => {
            if (err) {

                console.error(`[${context}][getPaymentDate] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            }
            else {

                res.status(200).send(result);
                saveRequestHistoryLogs(req, res, result);
                return res;

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get key
//DONE - 4.5 - Need Test and change Limit
router.get('/api/private/paymentsLusoPay/getKey', (req, res, next) => {
    var context = "GET /api/private/paymentsLusoPay/getKey";
    try {

        var clientName = req.headers['clientname'];

        var arg
        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    vatNumber: lusopayNifSC,
                    lowerLimit: lusoPayLowerLimit,
                    upperLimit: lusoPayUpperLimit
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    vatNumber: lusopayNifSC,
                    lowerLimit: lusoPayLowerLimit,
                    upperLimit: lusoPayUpperLimit
                };
                break;
            default:
                arg = {
                    vatNumber: lusopayNif,
                    lowerLimit: lusoPayLowerLimit,
                    upperLimit: lusoPayUpperLimit
                };
                break;
        };

        LusoPayClient.getKey(arg, (err, result) => {
            if (err) {

                console.error(`[${context}][getKey] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            }
            else {

                res.status(200).send(result.getKeyResult);
                saveRequestHistoryLogs(req, res, result.getKeyResult);
                return res;

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//========== FUNCTIONS ==========

async function getOrCreateConfigsPayments() {
    let configsPayments = await configsPaymentsModel.find({ "Type": process.env.configsPaymentsModelTypeMBway });

    if (configsPayments.length > 0) {
        return configsPayments[0]
    }
    else {

        let comissionClient = new configsPaymentsModel({ "Type": process.env.configsPaymentsModelTypeMBway });
        let result = await comissionClient.save()

        return result
    }
}

async function allowedToUseMBWay(req, res) {
    let configsPayments = await getOrCreateConfigsPayments()

    if (configsPayments.AllowPayments) {
        console.log(true)
        return true
    }
    else {
        res.status(400)
            .send({
                auth: false,
                code: "action_not_allowed_by_configs",
                message: configsPayments.AllowPaymentsMessageError,
            });
        console.log(false)
        return false;
    }
}

function transactionsUpdate(query, newValues) {
    var context = "Function transactionsUpdate";
    return new Promise((resolve, reject) => {

        Transactions.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {

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

function updateTransactionToWallet(transaction) {
    var context = "Function updateTransactionToWallet";

    var query = {

        userId: transaction.userId,
        "transactionsList.transactionId": transaction._id

    };

    var newTransaction = {

        $set: {
            "transactionsList.$.status": transaction.status
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
    console.log(`[${context}] transaction: ${transaction._id.toString()}`);

    const query = {
        userId: transaction.userId,
        "transactionsList.transactionId": transaction._id
    };

    const newTransaction = {
        $set: {
            "transactionsList.$.status": transaction.status
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
            console.error(`[${context}][updateOne] Error `, err);
        }
        else {
            Wallet.updateOne(query, amountWallet, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateOne] Error `, err);
                }
                else {                    
                    validateNotifications(transaction.userId);
                    console.log(`[${context}][updateOne] Updated ${transaction._id.toString()}`);
                };
            });
        };
    });

};

function saveRequestHistoryLogs(req, res, body) {
    var context = "Function saveRequestHistoryLogs paymentsLusoPay";
    console.log(`[${context}] Starting process`);
    var requestHistoryLogs = new RequestHistoryLogs({
        userId: req.headers['userid'],
        path: req.url,
        reqID: UUID.create(),
        clientType: req.headers['client'],
        requestType: req.method,
        queryData: req.query,
        paramsData: req.params,
        bodyData: req.body,
        responseStatus: res.statusCode,
        responseBody: JSON.stringify(body)
    });

    RequestHistoryLogs.createRequestHistoryLogs(requestHistoryLogs, (err, result) => {
        if (err) {

            console.error(`[${context}][createRequestHistoryLogs] Error `, err);

        }
        else {

            console.log("Request history log saved");

        };
    });

};

function validateFieldsSendMBWayRequest(body) {

    var context = "Function validateFieldsSendMBWayRequest";
    return new Promise((resolve, reject) => {

        if (!body)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        else if (!body.cellPhoneNumber)
            reject({ auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' });

        else if (!body.amount)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });

        else if (!body.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency is required' });

        else if (!body.amount.value)
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else
            resolve(true);

    });

};

function validateFieldsGenerateNeWDynamicReference(body) {
    var context = "Function validateFieldsGenerateNeWDynamicReference";
    return new Promise((resolve, reject) => {

        if (!body)
            reject({ auth: false, code: 'server_data_required', message: 'Data is required' });

        if (!body.amount)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });

        if (!body.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency is required' });

        if (!body.amount.value)
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else
            resolve(true);

    });

};

function sendEmailTopUpBilling(transaction) {
    var context = "Function sendEmailBilling";
    console.log(`[${context}] Starting process`);
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

    axios.post(proxyBilling, data)
        .then((result) => {
            console.log(`[${context}] `, result.data.message);
        })
        .catch((error) => {
            console.error(`[${context}] Error`, error.message);
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
            console.error(`[${context}] Error `, error.message);
        });

};

//validateNotifications('605daad1414a9f0012faf29c')
function validateNotifications_old(userId) {
    const context = "Function validateNotifications";
    try {

        let query = {
            userId: userId,
            //paymentMethod: process.env.PaymentMethodWallet,
            active: true
        };

        NotificationsPayments.find(query, (err, notificationsFound) => {

            if (err) {
                console.error(`[${context}] Error `, err.message);
            };

            console.log("notificationsFound", notificationsFound);

            if (notificationsFound.length > 0) {

                Promise.all(
                    notificationsFound.map(notification => {
                        return new Promise(async (resolve, reject) => {
                            let query = {
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

                    let query = {
                        userId: userId,
                        active: true
                    };

                    NotificationsPayments.find(query, (err, notificationsFound) => {
                        if (err) {

                            console.error(`[${context}][find] Error `, err.message);

                        }
                        else {

                            if (notificationsFound.length === 0) {
                                activateContracts(userId);
                            };
                        };

                    });


                }).catch((error) => {

                    console.error(`[${context}][makePaymentWallet] Error `, error.message);

                });

            };

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

async function validateNotifications(userId) {
    const context = "Function validateNotifications";
    try {
        console.info(`[${context}] Start - userId: ${userId}`);

        let query = {
            userId: userId,
            //paymentMethod: process.env.PaymentMethodWallet,
            active: true
        };

        let notificationsFound = await NotificationsPayments.find(query);
        console.info(`[${context}] Notifications found: ${notificationsFound.length}`);

        let notificationsResponse = [];

        if (notificationsFound.length > 0) {

            notificationsFound.forEach(async notification => {
                console.info(`[${context}] Processing notification:`, JSON.stringify(notification));
                notificationsResponse.push(makePaymentAsync(notification));
            })

            Promise.all(notificationsResponse)
                .then((results) => {
                    if (notificationsFound.length === results.length) {
                        let query = {
                            userId: userId,
                            active: true
                        };

                        NotificationsPayments.find(query, async (err, notificationsFound) => {
                            if (err) {
                                console.error(`[${context}][find] Error `, err);
                            };

                            const walletFound = await Wallet.findOne({ userId: userId });
                            if (!walletFound) {
                                console.warn(`[${context}] Wallet not found for userId: ${userId}`);
                            } else {
                                console.info(`[${context}] Wallet balance: ${walletFound.amount.value}`);
                            
                                if (walletFound.amount.value >= 20) {
                                    console.info(`[${context}] Verifying blocked RFID for userId: ${userId}`);
                                    ExternalRequestHandlers.verifyBlockedRFID(userId);
                                }
                            }

                            if (notificationsFound.length === 0) {
                                console.info(`[${context}] Verifying blocked RFID for userId: ${userId}`);
                                activateContracts(userId);
                            };
                        });
                    };
                })
        } else {
            let walletFound = await Wallet.findOne({ userId: userId });
            if (!walletFound) {
                console.warn(`[${context}] Wallet not found for userId: ${userId}`);
            } else {
                console.info(`[${context}] Wallet balance: ${walletFound.amount.value}`);
            
                if (walletFound.amount.value >= 20) {
                    console.info(`[${context}] Verifying blocked RFID for userId: ${userId}`);
                    ExternalRequestHandlers.verifyBlockedRFID(userId);

                }
            }
        }

    } catch (error) {
        console.error(`[${context}] Error `, error);
    };
};

function paymentFindOne(query) {
    var context = "Function paymentFindOne";
    return new Promise((resolve, reject) => {
        try {

            Payments.findOne(query, (err, result) => {

                if (err) {

                    reject(err);
                }
                else {
                    resolve(result);
                };

            });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
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
                    removeBalanceToWallet(result)
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
                    console.error(`[${context}][transactionsUpdate] Error `, error.message);
                    reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
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

function removeBalanceToWallet(transaction) {
    var context = "Function removeBalanceToWallet";
    return new Promise(async (resolve, reject) => {

        console.log(`[${context}] transaction: ${JSON.stringify(transaction)}`);

        let wallet = await walletFindOne({ userId: transaction.userId });

        //console.log("transaction", transaction);
        var found = wallet.transactionsList.find(elem => {
            return elem.transactionId == transaction._id
        });

        if (found) {
            if (wallet.amount.value - transaction.amount.value >= 0) {

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

                const newTransaction = {
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

function activateContracts(userId) {
    var context = "Function activateContracts";

    try {

        var headers = {
            userid: userId
        };

        var proxyIdentity = process.env.HostUser + process.env.PathActivateContracts;

        axios.patch(proxyIdentity, {}, { headers })
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

            let iva = await getChargerIva(paymentFound.hwId, paymentFound.chargerType);

            var payments = {
                payment: paymentFound.totalPrice.excl_vat,
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
                    //resolve(result.data)
                })
                .catch((error) => {
                    console.error(`[${context}][axiso.post] Error `, error.message);
                    updateSessionInvoice(paymentFound, { invoiceId: "", invoiceStatus: false });
                    //reject(error)
                });
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

function getChargerIva(hwId, chargerType) {
    var context = "Function removeObject";
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
                // console.log("Result: ", result.data);
                console.log("Invoice updated");
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

function movementsByUser_old(body, clientName) {
    const context = "Function movementsByUser";
    return new Promise((resolve, reject) => {

        let arg

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    movementType: body.movementType,
                    numOfItemsPerPage: body.numOfItemsPerPage,
                    pageNumber: body.pageNumber,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    movementType: body.movementType,
                    numOfItemsPerPage: body.numOfItemsPerPage,
                    pageNumber: body.pageNumber,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    movementType: body.movementType,
                    numOfItemsPerPage: body.numOfItemsPerPage,
                    pageNumber: body.pageNumber,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
        };
        LusoPayClient.getMovementsByUser(arg, (err, result) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                reject(err);

            };

            if (result) {

                if (result.getMovementsByUserResult.diffgram) {

                    let totalTransactionsLusopay = result.getMovementsByUserResult.diffgram.NewDataSet.Conta_Euro;


                    Promise.all(
                        totalTransactionsLusopay.map(transaction => {

                            return new Promise((resolve, reject) => {

                                let query = {
                                    _id: transaction.document,
                                    status: { $ne: process.env.TransactionStatusPaidOut }
                                };

                                Transactions.findOne(query, (err, transacionFound) => {
                                    if (err) {
                                        console.error(`[${context}] Error `, err.message);
                                        reject(err);
                                    };

                                    if (transacionFound) {

                                        var query = {
                                            _id: transacionFound._id
                                        };

                                        var newValues = {
                                            $set: {
                                                status: process.env.TransactionStatusPaidOut,
                                                dataReceived: transaction
                                            }
                                        };

                                        transactionsUpdate(query, newValues)
                                            .then(async (transactionFound) => {

                                                //let response = await transactionFindOne(query);

                                                sendEmailTopUpBilling(transactionFound);
                                                addBalanceToWallet(transactionFound);
                                                resolve(true);

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][transactionsUpdate] Error `, error.message);
                                                reject(error);

                                            });

                                    } else {

                                        resolve(true);

                                    };

                                });

                            });

                        })
                    ).then(() => {

                        resolve(result.getMovementsByUserResult);

                    }).catch((error) => {

                        console.error(`[${context}] Error `, error.message);
                        reject(error);

                    });

                } else {

                    resolve(result.getMovementsByUserResult.diffgram);

                };

            } else {

                resolve(result);

            };


        });

    });
};


function movementsByUser(body, clientName) {
    const context = "Function movementsByUser";
    return new Promise((resolve, reject) => {

        let arg

        switch (clientName) {
            case process.env.clientNameSC:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    movementType: body.movementType,
                    numOfItemsPerPage: body.numOfItemsPerPage,
                    pageNumber: body.pageNumber,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
            case process.env.clientNameHyundai:
                arg = {
                    clientGuid: lusopayClientGUIDSC,
                    vatNumber: lusopayNifSC,
                    movementType: body.movementType,
                    numOfItemsPerPage: body.numOfItemsPerPage,
                    pageNumber: body.pageNumber,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
            default:
                arg = {
                    clientGuid: lusopayClientGUID,
                    vatNumber: lusopayNif,
                    movementType: body.movementType,
                    numOfItemsPerPage: body.numOfItemsPerPage,
                    pageNumber: body.pageNumber,
                    startDate: body.startDate,
                    endDate: body.endDate
                };
                break;
        };

        LusoPayClient.getMovementsByUser(arg, (err, result) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                reject(err);

            };

            if (result) {

                if (result.getMovementsByUserResult.diffgram) {

                    console.log("result.getMovementsByUserResult.diffgram", result.getMovementsByUserResult.diffgram)

                    let totalTransactionsLusopay = result.getMovementsByUserResult.diffgram.NewDataSet.Conta_Euro;

                    if (!totalTransactionsLusopay) {
                        totalTransactionsLusopay = result.getMovementsByUserResult.diffgram.NewDataSet.Euro_account;
                    }

                    let responseToPromise = []

                    if (totalTransactionsLusopay)
                        totalTransactionsLusopay.forEach(transaction => {
                            responseToPromise.push(transactionHandler(transaction))
                        })


                    Promise.all(responseToPromise)
                        .then((values) => {

                            resolve(result.getMovementsByUserResult);

                        }).catch((error) => {

                            console.error(`[${context}] Error `, error.message);
                            reject(error);

                        });

                } else {

                    resolve(result.getMovementsByUserResult.diffgram);

                };

            } else {

                resolve(result);

            };


        });

    });
};

function transactionHandler(transaction) {
    const context = "Function transactionHandler";
    return new Promise(async (resolve, reject) => {
        try {

            let query = {
                _id: transaction.document,
                status: { $ne: process.env.TransactionStatusPaidOut }
            };

            console.log("query ", query);

            let transactionFound = await Transactions.findOne(query)

            if (transactionFound) {

                console.log("transactionFound ", transactionFound);

                let query = {
                    _id: transactionFound._id
                };

                let newValues = {
                    $set: {
                        status: process.env.TransactionStatusPaidOut,
                        dataReceived: transaction
                    }
                };

                let transactionFound = await transactionsUpdate(query, newValues)

                sendEmailTopUpBilling(transactionFound);
                addBalanceToWallet(transactionFound);
                resolve(true);

            } else {

                resolve(true);

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
}

function makePaymentAsync(notification) {
    const context = "Function makePaymentAsync";
    console.info(`[${context}] Start - paymentId: ${notification.paymentId}`);

    return new Promise(async (resolve, reject) => {

        let query = {
            _id: notification.paymentId
        };

        let payment;
        let result;

        try {
            payment = await paymentFindOne(query);
            result = await makePaymentWallet(payment);
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(error);
        };

        if (result) {
            NotificationsPayments.updateNotificationsPayments({ _id: notification._id }, { $set: { active: false } }, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateNotificationsPayments] Error `, err);
                    reject(err);
                };

                console.log(`[${context}] Notification updated successfully. notificationId: ${notification._id}`);
                resolve(result);
            });
        }
    });
}

/*
TODO

4.9 - getCheckDigitByReference
4.11 - checkRealtimeDymanicReference
4.12 - setTimeLimitedManualReference
4.13 - generateTimeLimitedDynamicReference
4.14 - getTimeLimitedManualReferenceStatus
4.15 - setTimeLimitedDynamicReference
4.16 - listTimeLimitedGeneratedDynamicReferences

*/

module.exports = router;