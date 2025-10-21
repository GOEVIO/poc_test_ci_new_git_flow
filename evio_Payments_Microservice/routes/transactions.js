require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const Transactions = require('../models/transactions');
const Wallet = require('../models/wallet');
const RequestHistoryLogs = require('../models/requestHistoryLogs');
const UUID = require('uuid-js');
const axios = require("axios");
const TransactionsHandler = require('../handlers/transactions');
const ErrorHandler = require('../handlers/errorHandler');
const {parsePagination, buildMetadata, sortFinalOrderRecords} = require('../helpers/sort')

//========== POST ==========
router.post('/api/private/transactions/processTopUps', (req, res, next) => {
    const context = "POST /api/private/transactions/processTopUps";
    try {

        TransactionsHandler.processTopUps(req)
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

router.post('/api/private/transactions/createAndProcessVoucher', (req, res, next) => {
    const context = "POST /api/private/transactions/createAndProcessVoucher";
    try {

        TransactionsHandler.createAndProcessVoucher(req, res)

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(req, error, res);

    };
});
//========== PATCH ==========

//========== PUT ==========

//========== GET ==========
//Get transaction
router.get('/api/private/transactions', (req, res, next) => {
    const context = "GET /api/private/transactions";
    try {

        let {userid: userId, client, component, version} = req.headers;
        const { page, limit, skip } = parsePagination(req.query);
        const { inputText } = req.query


        let query;

        if (client === process.env.ClientWeb || component === 'webapp') {
            query = {
                userId: userId,
                $and: [
                    {
                        $or: [
                            { status: process.env.TransactionStatusPaidOut },
                            { status: process.env.TransactionProviderCreditCard },
                            { status: process.env.TransactionStatusRefund },
                        ]
                    },
                    {
                        $and: [
                            { transactionType: { $ne: process.env.TransactionTypeAddCard } },
                            { transactionType: { $ne: process.env.TransactionTypeForce3dsAuth } },
                            { transactionType: { $ne: process.env.TransactionTypeCheck3dsAuth } },
                            { transactionType: { $ne: process.env.TransactionTypeEditCard } },
                            { transactionType: { $ne: process.env.TransactionTypePreAuthorize } },
                            { transactionType: { $ne: process.env.TransactionTypeValidate } }
                        ]
                    }
                ],
                provider: { $ne: process.env.TransactionProviderPlafond }
            };
        } else {
            query = {
                userId: userId,
                $and: [
                    {
                        $or: [
                            { status: process.env.TransactionStatusPaidOut },
                            { status: process.env.TransactionProviderCreditCard },
                            { status: process.env.TransactionStatusRefund },
                        ]
                    },
                    {
                        $and: [
                            { transactionType: { $ne: process.env.TransactionTypeAddCard } },
                            { transactionType: { $ne: process.env.TransactionTypeForce3dsAuth } },
                            { transactionType: { $ne: process.env.TransactionTypeCheck3dsAuth } },
                            { transactionType: { $ne: process.env.TransactionTypeEditCard } },
                            { transactionType: { $ne: process.env.TransactionTypePreAuthorize } },
                            { transactionType: { $ne: process.env.TransactionTypeValidate } }
                        ]
                    }
                ]
            };
        }

        let fields = {
            _id: 1,
            amount: 1,
            userId: 1,
            transactionType: 1,
            status: 1,
            provider: 1,
            createdAt: 1,
            updatedAt: 1,
            paymentId: 1,
            sessionId: 1,
            invoiceId: 1
        };

        Transactions.find(query, fields, (err, transactionsFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            } else {

                let newTransactionsFound = transactionsFound.filter(transaction => {
                    if (transaction.transactionType !== process.env.TransactionTypeDebit) {
                        return (transaction);
                    } else {
                        if (transaction.amount.value > 0) {
                            return (transaction);
                        };
                    };
                })

                let finalTransaction = []
                Promise.all(

                    newTransactionsFound.map(transaction => {

                        return new Promise(async (resolve, rejec) => {

                            transaction = JSON.parse(JSON.stringify(transaction))


                            let hasInvoice = false

                            if (transaction.paymentId && transaction.paymentId !== "-1") {

                                let invoice = await getInvoiceDocumentPaymentId(transaction.paymentId, transaction.invoiceId)
                                if (invoice) {

                                    if (transaction.transactionType === process.env.TransactionTypeDebit)
                                        if (invoice.documentNumber)
                                            transaction.documentNumber = invoice.documentNumber

                                    if (invoice.status == process.env.InvoiceStatusCompleted) {

                                        hasInvoice = true
                                        let invoiceId = invoice._id;
                                        transaction.invoiceId = invoiceId;
                                        transaction.hasInvoice = hasInvoice;
                                        //console.log(" transaction.hasInvoice 1", transaction.hasInvoice)
                                        finalTransaction.push(transaction)
                                        resolve();

                                    } else {

                                        transaction.hasInvoice = hasInvoice;
                                        //console.log(" transaction.hasInvoice 2", transaction.hasInvoice)
                                        finalTransaction.push(transaction)
                                        resolve();

                                    };

                                } else {

                                    transaction.hasInvoice = hasInvoice;
                                    //console.log(" transaction.hasInvoice 3", transaction.hasInvoice)
                                    finalTransaction.push(transaction)
                                    resolve();

                                };

                            } else {

                                transaction.hasInvoice = hasInvoice;
                                //console.log(" transaction.hasInvoice 4", transaction.hasInvoice)
                                finalTransaction.push(transaction)
                                resolve();

                            };

                        });

                    })

                ).then(() => {
                    finalTransaction.sort((a, b) => (a.createdAt > b.createdAt) ? -1 : ((b.createdAt > a.createdAt) ? 1 : 0));

                    if(version && version === '2'){
                        let { totalCount, records } = sortFinalOrderRecords(finalTransaction, skip, limit, inputText);
                        let metadata = buildMetadata({ page, limit, totalCount });

                        const response = {
                            metadata: metadata,
                            records: records                        
                        }
                        res.status(200).send(response);
                    }else{
                        res.status(200).send(finalTransaction);
                    }

                    
                    saveRequestHistoryLogs(req, res, finalTransaction);
                    return res;

                });

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get transactions by user
router.get('/api/private/transactions/byUser', (req, res, next) => {
    var context = "GET /api/private/transactions/byUser";
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

        transactionsFind(query)
            .then((transactionsFound) => {

                res.status(200).send(transactionsFound);
                saveRequestHistoryLogs(req, res, transactionsFound);
                return res;

            })
            .catch((error) => {

                console.error(`[${context}][transactionsFind] Error `, error.message);
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

router.get('/api/private/transactions/wallet_old', (req, res, next) => {
    const context = "GET /api/private/transactions/wallet_old";

    const userId = req.headers['userid'];
    var query = {
        userId: userId
    };

    walletFindOne(query)
        .then((walletFound) => {

            if (walletFound) {
                //console.log("walletFound", walletFound)

                walletFound = JSON.parse(JSON.stringify(walletFound))

                let transactionsList = walletFound.transactionsList;
                let newList = [];

                Promise.all(transactionsList.map(transaction => {
                    return new Promise((resolve, reject) => {

                        let query = {
                            _id: transaction.transactionId
                        };

                        let fields = {
                            _id: 1,
                            amount: 1,
                            userId: 1,
                            transactionType: 1,
                            status: 1,
                            provider: 1,
                            createdAt: 1,
                            updatedAt: 1
                        };

                        Transactions.findOne(query, fields, (err, transactionFound) => {
                            if (err) {
                                console.error(`[${context}][transactionsList.map] Error `, err.message);
                                reject(err);
                            } else {
                                if (transactionFound) {
                                    if (transactionFound.transactionType === process.env.TransactionTypeDebit && transactionFound.provider === process.env.TransactionProviderCreditCard) {
                                        // newList.push(transactionFound);
                                        resolve(true);
                                    } else if (transactionFound.status !== process.env.TransactionStatusPaidOut && transactionFound.status !== process.env.TransactionStatusRefund) {
                                        resolve(true);
                                    } else {
                                        newList.push(transactionFound);
                                        resolve(true);
                                    };
                                } else {
                                    resolve(true);
                                };
                            };
                        });

                    });
                })).then(() => {

                    newList.sort((a, b) => (a.updatedAt > b.updatedAt) ? -1 : ((b.updatedAt > a.updatedAt) ? 1 : 0));
                    walletFound.transactionsList = newList;

                    res.status(200).send(walletFound);
                    saveRequestHistoryLogs(req, res, walletFound);
                    return res;

                }).catch((error) => {

                    console.error(`[${context}][transactionsList.map] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });




            } else {

                var message = { auth: false, code: 'server_wallet_not_found', message: "Wallet not found for given parameters" };
                res.status(400).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;

            };

        })
        .catch((error) => {

            console.error(`[${context}][walletFindOne] Error `, error.message);
            res.status(500).send(error.message);
            saveRequestHistoryLogs(req, res, error.message);
            return res;

        });

});

router.get('/api/private/transactions/wallet', (req, res, next) => {
    const context = "GET /api/private/transactions/wallet";

    const {userid: userId, client, component, version} = req.headers;
    const { page, limit, skip } = parsePagination(req.query);
    const { inputText } = req.query

    var query = {
        userId: userId
    };

    walletFindOne(query)
        .then((walletFound) => {

            if (walletFound) {
                //console.log("walletFound", walletFound)

                walletFound = JSON.parse(JSON.stringify(walletFound))

                let transactionsList = walletFound.transactionsList;
                let newList = [];

                Promise.all(transactionsList.map(transaction => {
                    return new Promise((resolve, reject) => {

                        if (transaction.transactionType !== "preAuthorize") {

                            if (transaction.status === "40" || transaction.status === "70") {

                                let query = {
                                    _id: transaction.transactionId
                                };

                                let fields = {
                                    _id: 1,
                                    amount: 1,
                                    userId: 1,
                                    transactionType: 1,
                                    status: 1,
                                    provider: 1,
                                    paymentId: 1,
                                    createdAt: 1,
                                    updatedAt: 1,
                                    invoiceId: 1
                                };

                                Transactions.findOne(query, fields, async (err, transactionFound) => {
                                    if (err) {
                                        console.error(`[${context}][transactionsList.map] Error `, err.message);
                                        reject(err);
                                    } else {

                                        transactionFound = JSON.parse(JSON.stringify(transactionFound))

                                        if (transactionFound) {
                                            if (transactionFound.transactionType === process.env.TransactionTypeDebit) {

                                                let invoiceFound = await getInvoiceDocumentPaymentId(transactionFound.paymentId, transactionFound.invoiceId)

                                                if (invoiceFound)
                                                    if (invoiceFound.documentNumber)
                                                        transactionFound.documentNumber = invoiceFound.documentNumber
                                            }
                                            if (transactionFound.transactionType === process.env.TransactionTypeDebit && transactionFound.provider === process.env.TransactionProviderCreditCard) {
                                                // newList.push(transactionFound);
                                                resolve(true);
                                            } else if (transactionFound.status !== process.env.TransactionStatusPaidOut && transactionFound.status !== process.env.TransactionStatusRefund) {
                                                resolve(true);
                                            } else {
                                                newList.push(transactionFound);
                                                resolve(true);
                                            };
                                        } else {
                                            resolve(true);
                                        };
                                    };
                                });

                            } else {

                                resolve();

                            };

                        } else {

                            resolve(true);

                        };

                    });
                })).then(() => {

                    newList.sort((a, b) => (a.updatedAt > b.updatedAt) ? -1 : ((b.updatedAt > a.updatedAt) ? 1 : 0));
                    walletFound.transactionsList = newList;

                    if(version && version === '2'){
                        let { totalCount, records } = sortFinalOrderRecords(walletFound.transactionsList, skip, limit, inputText);
                        let metadata = buildMetadata({ page, limit, totalCount });

                        delete walletFound.transactionsList
                        const response = {
                            metadata: metadata,
                            wallet: walletFound,
                            transactionsList: records                        
                        }
                        res.status(200).send(response);
                    }else{
                        res.status(200).send(walletFound);
                    }

                    
                    saveRequestHistoryLogs(req, res, walletFound);
                    return res;

                }).catch((error) => {

                    console.error(`[${context}][transactionsList.map] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });




            } else {

                var message = { auth: false, code: 'server_wallet_not_found', message: "Wallet not found for given parameters" };
                res.status(400).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;

            };

        })
        .catch((error) => {

            console.error(`[${context}][walletFindOne] Error `, error.message);
            res.status(500).send(error.message);
            saveRequestHistoryLogs(req, res, error.message);
            return res;

        });

});


router.get('/api/private/transactions/byInvoiceId', (req, res, next) => {
    var context = "GET /api/private/transactions/byInvoiceId";
    try {

        if (!req.query.invoices)
            return res.status(400).send()


        let invoices = req.query.invoices;

        let query = {
            "invoiceId": invoices
        }

        transactionsFind(query)
            .then((transactionsFound) => {

                res.status(200).send(transactionsFound);
                return res;

            })
            .catch((error) => {

                console.error(`[${context}][transactionsFind] Error `, error.message);
                res.status(500).send(error.message);
                return res;

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        return res;

    };
});

//========== DELETE ==========

//========== FUNCTIONS ==========
//Function find transactions
function transactionsFind(query) {
    var context = "Funciton transactionsFind";
    return new Promise((resolve, reject) => {
        Transactions.find(query, (err, result) => {
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

function saveRequestHistoryLogs(req, res, body) {
    var context = "Function saveRequestHistoryLogs transactions";
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

            console.error(`[${context}][createRequestHistoryLogs] Error `, err.message);

        }
        else {

            console.log("Request history log saved");

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
            };
        });
    });
};

function getInvoiceDocumentPaymentId(paymentId, invoiceId) {
    var context = "Function getInvoiceDocumentPaymentId";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostBilling + process.env.PathGetInvoiceDocument;
        let params = { paymentId: paymentId, invoiceId: invoiceId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve(null);
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(null);
            });
    });
}

module.exports = router;