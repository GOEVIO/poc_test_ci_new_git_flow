require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const Wallet = require('../models/wallet');
const Payments = require('../models/payments');
const Transactions = require('../models/transactions');
const RequestHistoryLogs = require('../models/requestHistoryLogs');
const PaymentMethod = require('../models/paymentMethod');
const Configs = require('../models/configs');
const UUID = require('uuid-js');
const axios = require("axios");
const Invoices = require('../handlers/invoices');
const { response } = require('express');
const { StatusCodes } = require('http-status-codes');
const Sentry = require('@sentry/node');
const walletController = require('../controllers/walletController');
const { calculateUserDebt } = require('evio-library-payments').default;

const {  verifyIfUserCanAddCard } = require('../common/preauthorization.common');
const  FeatureFlagGuard  = require('../guard/feature.flag.guard');
const toggle = require('evio-toggle').default;
const Constants = require('../utils/constants')
const { Enums } = require('evio-library-commons').default;

//========== POST ==========
//Create a wallet
router.post('/api/private/wallet', async (req, res, next) => {
    var context = "POST /api/private/wallet";
    try {

        var received = req.body;
        var userId, clientName;
        if (req.headers['userid'] != undefined) {
            userId = req.headers['userid'];
        }
        else {
            userId = received.userId;
        };

        if (req.headers['clientname'] != undefined) {
            clientName = req.headers['clientname'];
        }
        else {
            clientName = received.clientName;
        };

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            var query = {
                userId: userId,
                clientName: clientName
            };

            walletFindOne(query)
                .then((walletFound) => {
                    if (walletFound) {

                        res.status(200).send("wallet already exists");
                        saveRequestHistoryLogs(req, res, "wallet already exists");
                        return res;

                    }
                    else {

                        var wallet = new Wallet();
                        wallet.userId = userId;
                        wallet.clientName = clientName;

                        Wallet.createWallet(wallet, (err, result) => {
                            if (err) {

                                console.error(`[${context}] Error `, err.message);
                                res.status(500).send(err.message);
                                saveRequestHistoryLogs(req, res, err.message);
                                return res;

                            }
                            else {
                                if (result) {

                                    res.status(200).send("wallet created");
                                    saveRequestHistoryLogs(req, res, "wallet created");
                                    return res;

                                }
                                else {

                                    res.status(200).send("wallet not created");
                                    saveRequestHistoryLogs(req, res, "wallet not created");
                                    return res;

                                };
                            };
                        });
                    };
                })
                .catch((error) => {

                    console.error(`[${context}] Error `, error.message);
                    res.status(500).send(error.message);
                    saveRequestHistoryLogs(req, res, error.message);
                    return res;

                });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.post('/api/private/postGetWalletsByUsersId', async (req, res, next) => {
    const context = "POST /api/private/postGetWalletsByUsersId";
    try {

        const {userId} = req.body;

        if (!userId) {
            const message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            return res.status(400).send(message);
        }

        if (userId.length == 0)
            return res.status(200).send([]);

        const query = {
            userId,
        };

        Wallet.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][updateTransactions] Error `, err.message);
                return res.status(500).send(err.message);
            }

            if (result.length > 0) {
                return res.status(200).send(result);
            };

            return res.status(200).send([]);

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.post('/api/private/wallet/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/wallet/runFirstTime";

    adjustTransactions()

    return res.status(200).send("OK");

});

router.post('/api/private/wallet/updateClearanceDate', walletController.processClearenceWallet);

//========== PATCH ==========
//Patch to make a payment using wallet
router.patch('/api/private/wallet/makePayment', async (req, res, next) => {
    var context = "PATCH /api/private/wallet/makePayment";
    try {

        var received = req.body;
        var userId = req.headers['userid'];
        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            validateFields(received)
                .then(async () => {

                    //Query to wallet
                    var queryWallet = {
                        userId: userId
                    };

                    //Query to payment
                    var queryPayment = {
                        _id: received.paymentId,
                        sessionId: received.sessionId,
                        userId: userId
                    };

                    //Created a new transaction
                    var newTransaction = new Transactions(
                        {
                            userId: userId,
                            transactionType: process.env.TransactionTypeDebit,
                            status: process.env.TransactionStatusSentToGenerate,
                            provider: process.env.TransactionProviderWallet,
                            amount: received.amount,
                            sessionId: received.sessionId,
                            paymentId: received.paymentId

                        }
                    );

                    let transactionCreated = await createTransactions(newTransaction);
                    let paymentFound = await paymentFindOne(queryPayment);
                    let walletFound = await walletFindOne(queryWallet);

                    //Query to transaction
                    var queryTransaction = {
                        _id: transactionCreated._id
                    };

                    //Validate currency
                    //if (paymentFound.amount.currency <= walletFound.amount.currency) {

                    var transaction = {
                        $set: {
                            status: process.env.TransactionStatusPaidOut,
                            data: process.env.ReasonSuccessBalance
                        }
                    };

                    //Update transaction to status 
                    transactionsUpdate(queryTransaction, transaction)
                        .then((result) => {

                            result.status = process.env.TransactionStatusPaidOut;

                            //Remove balance from wallet
                            removeBalanceToWallet(result)
                                .then((value) => {

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

                                            res.status(200).send(response);
                                            saveRequestHistoryLogs(req, res, response);
                                            return res;

                                        })
                                        .catch((error) => {

                                            updateTransactionFaild(queryTransaction);
                                            console.error(`[${context}][paymentUpdate] Error `, error.message);
                                            res.status(500).send(error.message);
                                            saveRequestHistoryLogs(req, res, error.message);
                                            return res;

                                        });
                                })
                                .catch((error) => {

                                    updateTransactionFaild(queryTransaction);
                                    console.error(`[${context}][removeBalanceToWallet] Error `, error.message);
                                    res.status(500).send(error.message);
                                    saveRequestHistoryLogs(req, res, error.message);
                                    return res;

                                });

                        })
                        .catch((error) => {

                            updateTransactionFaild(queryTransaction);
                            console.error(`[${context}][transactionsUpdate] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error.message);
                            return res;

                        });

                    /*}
                    else {
                        //todo
                    };
                    */

                })
                .catch((error) => {

                    res.status(400).send(error);
                    saveRequestHistoryLogs(req, res, error);
                    return res;

                });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.patch('/api/private/wallet/autoRecharger', async (req, res, next) => {
    var context = "PATCH /api/private/wallet/autoRecharger";
    var received = req.body;
    var userId = req.headers['userid'];

    if (!userId) {

        var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
        res.status(400).send(message);
        saveRequestHistoryLogs(req, res, message);
        return res;

    };

    let query = {
        userId: userId,
        status: { $ne: process.env.PaymentMethodStatusExpired }
    };

    if (received.autoRecharger) {

        PaymentMethod.find(query, (err, paymentMethodFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            };

            if (paymentMethodFound.length === 0) {

                var message = { auth: false, code: 'server_need_paymentMethod_card', message: "You must have at least one credit card added to activate this feature." };
                res.status(400).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;

            } else {

                Wallet.findOneAndUpdate(query, { $set: { autoRecharger: received.autoRecharger } }, { new: true }, (err, walletUpdated) => {
                    if (err) {

                        console.error(`[${context}] Error `, err.message);
                        res.status(500).send(err.message);
                        saveRequestHistoryLogs(req, res, err.message);
                        return res;

                    };

                    walletUpdated = JSON.parse(JSON.stringify(walletUpdated));

                    if (walletUpdated.transactionsList != undefined)
                        delete walletUpdated.transactionsList;

                    walletUpdated.amount.value = parseFloat(walletUpdated.amount.value.toFixed(2))
                    res.status(200).send(walletUpdated);
                    saveRequestHistoryLogs(req, res, walletUpdated);
                    return res;

                });

            };

        });

    } else if (received.autoRecharger === false) {

        Wallet.findOneAndUpdate(query, { $set: { autoRecharger: received.autoRecharger } }, { new: true }, (err, walletUpdated) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                res.status(500).send(err.message);
                saveRequestHistoryLogs(req, res, err.message);
                return res;

            };

            walletUpdated = JSON.parse(JSON.stringify(walletUpdated));

            if (walletUpdated.transactionsList != undefined)
                delete walletUpdated.transactionsList;

            walletUpdated.amount.value = parseFloat(walletUpdated.amount.value.toFixed(2))
            res.status(200).send(walletUpdated);
            saveRequestHistoryLogs(req, res, walletUpdated);
            return res;

        });

    } else {

        var message = { auth: false, code: 'server_autoRecharger_required', message: "Auto recharger data is required" };
        res.status(400).send(message);
        saveRequestHistoryLogs(req, res, message);
        return res;

    };

});

router.patch('/api/private/wallet/makeDebitTransaction', async (req, res, next) => {
    let context = "PATCH /api/private/wallet/makeDebitTransaction";
    try {

        let received = req.body;
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];

        //console.log("received", received);
        //console.log("userId", userId);
        //console.log("clientName", clientName);
        validateFieldsTransactionWallet(received)
            .then(async () => {

                //Query to wallet
                let queryWallet = {
                    userId: received.userId
                };

                let walletFound = await walletFindOne(queryWallet);
                let newTransaction = new Transactions(
                    {
                        userId: received.userId,
                        transactionType: process.env.TransactionTypeDebit,
                        status: process.env.TransactionStatusSentToGenerate,
                        provider: process.env.TransactionProviderWallet,
                        amount: received.amount,
                        notes: received.notes,
                        clientName: clientName
                    }
                );

                let transactionCreated = await createTransactions(newTransaction);

                if (walletFound.amount.value - received.amount.value >= 0) {

                    let newPayment = new Payments(
                        {
                            userId: received.userId,
                            transactionType: process.env.TransactionTypeDebit,
                            status: process.env.PaymentStatusInPayment,
                            provider: process.env.TransactionProviderWallet,
                            paymentType: process.env.PaymentTypeAD_HOC,
                            amount: received.amount,
                            notes: received.notes,
                            transactionId: transactionCreated._id,
                            clientName: clientName
                        }
                    )

                    let paymentCreated = await createPayments(newPayment);

                    removeBalanceFromWallet(paymentCreated.transactionId, paymentCreated.userId, paymentCreated.amount)
                        .then((value) => {

                            let newValuesPayments = {
                                $set: {
                                    status: process.env.PaymentStatusPaidOut,
                                    reason: process.env.ReasonSuccessBalance
                                }
                            };

                            //Update payment
                            paymentUpdate({ _id: paymentCreated._id }, newValuesPayments)
                                .then(async (paymentsUpdated) => {

                                    res.status(200).send(paymentsUpdated);
                                    saveRequestHistoryLogs(req, res, paymentsUpdated);
                                    return res;

                                })
                                .catch((error) => {

                                    updateTransactionFaild({ _id: transactionCreated._id });
                                    updatePaymentFaild({ _id: paymentCreated._id });
                                    console.error(`[${context}][paymentUpdate] Error `, error.message);
                                    res.status(500).send(error.message);
                                    saveRequestHistoryLogs(req, res, error.message);
                                    return res;

                                });
                        })
                        .catch((error) => {

                            updateTransactionFaild({ _id: transactionCreated._id });
                            updatePaymentFaild({ _id: paymentCreated._id });
                            console.error(`[${context}][removeBalanceToWallet] Error `, error.message);
                            res.status(500).send(error.message);
                            saveRequestHistoryLogs(req, res, error.message);
                            return res;

                        });
                    //console.log("paymentCreated", paymentCreated);


                } else {

                    let updatedTransaction = await transactionsUpdate({ _id: transactionCreated._id }, { $set: { status: process.env.TransactionStatusFaild, notes: process.env.ReasonFailNoBalance } })
                    updateTransactionToWallet(updatedTransaction);
                    let messageResponse = { auth: false, code: 'server_no_balance', message: 'No balance available for transaction' };
                    res.status(400).send(messageResponse);
                    saveRequestHistoryLogs(req, res, messageResponse);
                    return res;

                };

            })
            .catch(error => {
                res.status(400).send(error);
                saveRequestHistoryLogs(req, res, error);
                return res;
            })




    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.get('/api/public/wallet/enableBalanceClearance', walletController.enableBalanceClearance);


//========== PUT ==========

//========== GET ==========
//Get wallet by user
router.get('/api/private/wallet/byUser', (req, res, next) => {
    var context = "GET /api/private/wallet/byUser";
    try {
        var userId = req.headers['userid'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            var query = {
                userId: userId
            };

            walletFindOne(query)
                .then(async (walletFound) => {

                    if (walletFound) {

                        walletFound = JSON.parse(JSON.stringify(walletFound));

                        if (walletFound.transactionsList != undefined)
                            delete walletFound.transactionsList;

                        walletFound.amount.value = parseFloat(walletFound.amount.value.toFixed(2))
                        walletFound.allowCreditCard = true;

                        const userInfo = await getUser(userId);
                        if(await FeatureFlagGuard.canActivate('blockcreditcard')){
                            const blockCreditCard = await verifyIfUserCanAddCard(userInfo); 
                            console.log('[',context,'] blockCreditCard: ', blockCreditCard);       
                    
                            if (blockCreditCard) {
                                const currentDate = new Date();
                                // Subtract one month from the current date
                                const minPastDate = new Date(currentDate.getTime() - blockCreditCard.minAccoutCreatedDays * 24 * 60 * 60 * 1000);
                                const userCreatedDate = new Date(userInfo.createdAt);
                                // Compare the dates
                                if (userCreatedDate > minPastDate) {
                                    walletFound.allowCreditCard = false;
                                }
                            }    
                        }

                        const debtValue = await calculateUserDebt(userId);
                        const isDebtValueVisible = await toggle.isEnable("identity_show_debt_value");
                        

                        if (isDebtValueVisible && debtValue.value !== 0 && userInfo.blocked) {
                            walletFound.debtValue = debtValue;
                        }

                        res.status(200).send(walletFound);
                        saveRequestHistoryLogs(req, res, walletFound);
                        return res;

                    }
                    else {

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
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Get wallet to landing page
router.get('/api/private/wallet/landingPage', (req, res, next) => {
    var context = "GET /api/private/wallet/landingPage";
    try {
        var userId = req.headers['userid'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            var query = {
                userId: userId
            };

            walletFindOne(query)
                .then((walletFound) => {

                    if (walletFound) {

                        walletFound = JSON.parse(JSON.stringify(walletFound));
                        if (walletFound.transactionsList != undefined)
                            delete walletFound.transactionsList;


                        walletFound.amount.value = parseFloat(walletFound.amount.value.toFixed(2))

                        res.status(200).send(walletFound);
                        saveRequestHistoryLogs(req, res, walletFound);
                        return res;

                    }
                    else {

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
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//Verify if have balance on wallet
router.get('/api/private/wallet/validateBalance', (req, res, next) => {
    var context = "GET /api/private/wallet/validateBalance";
    try {

        var userId = req.headers['userid'];
        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            var query = {
                userId: userId,
                "amount.value": {
                    $gte: Number(process.env.MinimumQuantity)
                }
            };

            walletFindOne(query)
                .then((walletFound) => {

                    if (walletFound) {

                        var message = { auth: true, code: 'server_wallet_funds', message: "Existing funds to make transaction" };
                        res.status(200).send(message);
                        saveRequestHistoryLogs(req, res, message);
                        return res;

                    }
                    else {

                        var message = { auth: false, code: 'server_wallet_dont_funds', message: "Non existing funds to make transaction" };
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
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

router.get('/api/private/wallet/byUser/:userId', (req, res, next) => {
    const context = "GET /api/private/wallet/byUser/:userId";

    var userId
    if (req.params.userId)
        userId = req.params.userId;
    else
        userId = req.headers['userid'];

    const query = {
        userId: userId
    };

    walletFindOne(query)
        .then((walletFound) => {

            walletFound = JSON.parse(JSON.stringify(walletFound));

            if (walletFound.transactionsList != undefined)
                delete walletFound.transactionsList;


            walletFound.amount.value = parseFloat(walletFound.amount.value.toFixed(2))

            res.status(200).send(walletFound);
            saveRequestHistoryLogs(req, res, walletFound);
            return res;

        })
        .catch((error) => {

            console.error(`[${context}][walletFindOne] Error `, error.message);
            res.status(500).send(error.message);
            saveRequestHistoryLogs(req, res, error.message);
            return res;

        });

});

router.get('/api/private/wallet/totalValue_old', (req, res, next) => {
    const context = "GET /api/private/wallet/totalValue";
    //console.log("2")
    const received = req.query;

    const query = {
        $where: "this.transactionsList.length > 0"
    };

    var totalAmount = 0;

    Wallet.find(query, async (err, walletsFound) => {
        if (err) {

            console.error(`[${context}] Error `, err.message);
            res.status(500).send(err.message);
            saveRequestHistoryLogs(req, res, err.message);
            return res;

        };

        if (walletsFound.length > 0) {

            Promise.all(

                walletsFound.map(wallet => {

                    return new Promise((reolve, reject) => {

                        Promise.all(

                            wallet.transactionsList.map(transaction => {

                                return new Promise((reolve, reject) => {

                                    let query = {
                                        _id: transaction.transactionId,
                                        status: process.env.TransactionStatusPaidOut,
                                        createdAt: { $lte: received.date }
                                    };

                                    Transactions.findOne(query, (err, transactionFound) => {

                                        if (err) {

                                            console.error(`[${context}][Transactions.findOne] Error `, err.message);
                                            totalAmount += 0;
                                            reolve();

                                        };

                                        if (transactionFound) {

                                            if (transactionFound.transactionType === process.env.TransactionTypeCredit || transactionFound.transactionType === process.env.TransactionTypeRefund) {

                                                totalAmount += transactionFound.amount.value;
                                                reolve();

                                            } else if (transactionFound.transactionType === process.env.TransactionTypeDebit) {

                                                totalAmount -= transactionFound.amount.value;
                                                reolve();

                                            } else {

                                                totalAmount += 0;
                                                reolve();

                                            };

                                        } else {

                                            totalAmount += 0;
                                            reolve();

                                        };

                                    });

                                });

                            })

                        ).then(() => {

                            reolve();

                        });

                    });

                })

            ).then(() => {

                totalAmount = parseFloat(totalAmount.toFixed(2));
                var message = { totalAmount: totalAmount };
                res.status(200).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;

            });

        } else {

            var message = { totalAmount: totalAmount };
            res.status(200).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

    });

});

router.get('/api/private/wallet/totalValue', (req, res, next) => {
    const context = "GET /api/private/wallet/totalValue";

    const received = req.query;
    //console.log("1")
    totalWallet(received)
        .then((result) => {

            res.status(200).send(result);
            saveRequestHistoryLogs(req, res, result);
            return res;

        })
        .catch((err) => {

            console.error(`[${context}] Error `, err.message);
            res.status(500).send(err.message);
            saveRequestHistoryLogs(req, res, err.message);
            return res;

        });

});

router.get('/api/private/wallet/listOfTransactions_old', (req, res, next) => {
    const context = "GET /api/private/wallet/listOfTransactions";

    const received = req.query;

    const query = {
        $where: "this.transactionsList.length > 0"
    };

    var totalAmount = 0;
    var listOfTransactions = [];

    Wallet.find(query, async (err, walletsFound) => {
        if (err) {

            console.error(`[${context}] Error `, err.message);
            res.status(500).send(err.message);
            saveRequestHistoryLogs(req, res, err.message);
            return res;

        };

        if (walletsFound.length > 0) {

            Promise.all(

                walletsFound.map(wallet => {

                    return new Promise((reolve, reject) => {

                        Promise.all(

                            wallet.transactionsList.map(transaction => {

                                return new Promise((reolve, reject) => {

                                    let query = {
                                        _id: transaction.transactionId,
                                        status: process.env.TransactionStatusPaidOut,
                                        createdAt: { $lte: received.date }
                                    };

                                    Transactions.findOne(query, (err, transactionFound) => {

                                        if (err) {

                                            console.error(`[${context}][Transactions.findOne] Error `, err.message);
                                            totalAmount += 0;
                                            reolve();

                                        };

                                        if (transactionFound) {

                                            if (transactionFound.transactionType === process.env.TransactionTypeCredit || transactionFound.transactionType === process.env.TransactionTypeRefund) {

                                                totalAmount += transactionFound.amount.value;
                                                listOfTransactions.push(transactionFound);
                                                reolve();

                                            } else if (transactionFound.transactionType === process.env.TransactionTypeDebit) {

                                                totalAmount -= transactionFound.amount.value;
                                                listOfTransactions.push(transactionFound);
                                                reolve();

                                            } else {

                                                totalAmount += 0;
                                                reolve();

                                            };

                                        } else {

                                            totalAmount += 0;
                                            reolve();

                                        };

                                    });

                                });

                            })

                        ).then(() => {

                            reolve();

                        });

                    });

                })

            ).then(() => {

                totalAmount = parseFloat(totalAmount.toFixed(2));
                var message = { totalAmount: totalAmount, listOfTransactions: listOfTransactions };
                res.status(200).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;

            });

        } else {

            var message = { totalAmount: totalAmount };
            res.status(200).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

    });

});

router.get('/api/private/wallet/listOfTransactions', (req, res, next) => {
    const context = "GET /api/private/wallet/listOfTransactions";

    const received = req.query;
    //console.log("1")
    totalWalletListTransations(received)
        .then((result) => {

            res.status(200).send(result);
            saveRequestHistoryLogs(req, res, result);
            return res;

        })
        .catch((err) => {

            console.error(`[${context}] Error `, err.message);
            res.status(500).send(err.message);
            saveRequestHistoryLogs(req, res, err.message);
            return res;

        });

});

//========== DELETE ==========
//Delete a wallet
router.delete('/api/private/wallet', async (req, res, next) => {
    var context = "DELETE /api/private/wallet";
    try {

        var received = req.body;
        if (req.headers['userid'] != undefined) {
            var userId = req.headers['userid'];
        }
        else {
            var userId = received.userId;
        };

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {
            var query = {
                userId: userId
            };

            Wallet.removeWallet(query, (err, result) => {
                if (err) {

                    console.error(`[${context}] Error `, err.message);
                    res.status(500).send(err.message);
                    saveRequestHistoryLogs(req, res, err.message);
                    return res;

                }
                else {

                    var message = { auth: true, code: "server_wallet_deleted", message: "Wallet deleted" };
                    res.status(200).send(message);
                    saveRequestHistoryLogs(req, res, message);
                    return res;

                };
            });
        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error.message);
        return res;

    };
});

//========== FUNCTION ==========
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

                console.error(`[${context}][createPayments] Error `, err.message);
                reject(err);

            }
            else {

                Transactions.updateTransactions({ _id: result.transactionId }, { $set: { paymentId: result._id, status: process.env.TransactionStatusInPayment } }, (err, response) => {
                    if (err) {

                        console.error(`[${context}][updateTransactions] Error `, err.message);
                        reject(err);

                    };

                    resolve(result);

                })

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
            };
        });
    });
};

function transactionsFindOne(query) {
    var context = "Funciton transactionsFindOne";
    return new Promise((resolve, reject) => {
        Transactions.findOne(query, (err, result) => {
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
    var context = "Funciton paymentUpdate";
    return new Promise((resolve, reject) => {
        Payments.updatePayments(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            };

            Transactions.updateTransactions({ _id: result.transactionId }, { $set: { status: process.env.TransactionStatusPaidOut } }, (err, response) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                };

                resolve(result);

            });
        });
    });
};

function getListTransactions(transactionsList) {
    var context = "Funciton getListTransactions";
    return new Promise((resolve, reject) => {
        transactionsList = JSON.parse(JSON.stringify(transactionsList));

        Promise.all(
            transactionsList.map(transaction => {
                return new Promise((resolve, reject) => {

                    var query = {
                        _id: transaction.transactionId
                    };

                    transactionsFindOne(query)
                        .then((result) => {

                            delete transaction.status;
                            delete transaction.transactionType;
                            transaction.transaction = result;
                            resolve(true);

                        })
                        .catch((error) => {

                            console.error(`[${context}][transactionsFindOne] Error `, error.message);
                            reject(error);

                        });
                });
            })
        ).then((result) => {

            resolve(transactionsList);

        }).catch((error) => {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        });
    });
};

async function saveRequestHistoryLogs(req, res, body) {
    var context = "Function saveRequestHistoryLogs wallet";

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
                    status: transaction.status,
                    notes: transaction.notes
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
                //reject(result);
            };

        });

    });
};

function removeBalanceToWallet(transaction) {
    var context = "Function removeBalanceToWallet";
    return new Promise((resolve, reject) => {

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

                resolve(result);

            };
        });

    });
};

function removeBalanceFromWallet(transactionId, userId, amount) {
    var context = "Function removeBalanceFromWallet";
    return new Promise((resolve, reject) => {

        let query = {

            userId: userId,
            "transactionsList.transactionId": transactionId

        };

        let newTransaction = {

            $set: {
                "transactionsList.$.status": process.env.TransactionStatusPaidOut,
                "transactionsList.$.transactionType": process.env.TransactionTypeDebit
            },
            $inc: {
                "amount.value": -amount.value

            }
        };

        Wallet.updateOne(query, newTransaction, (err, result) => {
            if (err) {

                console.error(`[${context}][updateOne] Error `, err.message);
                reject(err);

            }
            else {

                resolve(result);

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

function updatePaymentFaild(query) {
    var context = "Function updatePaymentFaild";

    let paymentStatus = {
        $set: {
            status: process.env.PaymentStatusFaild,
            data: process.env.ReasonFail
        }
    };

    Payments.updatePayments(query, paymentStatus)
        .then((result) => {

            console.log("Payment Updated")

        })
        .catch((error) => {

            console.error(`[${context}][updatePayments] Error `, error.message);

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

        else if (!received.amount.value)
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else
            resolve(true);

    });
};

function validateFieldsTransactionWallet(received) {
    var context = "Function validateFieldsTransactionWallet";
    return new Promise((resolve, reject) => {

        if (!received.userId)
            reject({ auth: false, code: 'server_userId_required', message: 'User Id is required' });

        if (Object.keys(received.amount).length === 0)
            reject({ auth: false, code: 'server_amount_required', message: 'Amount data is required' });

        if (!received.amount.currency)
            reject({ auth: false, code: 'server_currency_required', message: 'Currency data is required' });

        if (received.amount.value === undefined)
            reject({ auth: false, code: 'server_value_required', message: 'Value is required' });

        else
            resolve(true);

    });
};

function removeObject(body) {
    var context = "Function removeObject";
    return new Promise((resolve, reject) => {
        if (body.transactionsList) {
            Promise.all(
                body.transactionsList.map(transaction => {
                    return new Promise((resolve, reject) => {

                        if (transaction.transaction) {
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
                            } else {
                                resolve(true);
                            };
                        } else {
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
                resolve(body);
            });
        }
        else {
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
            resolve(body);
        };
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

        if (body['additionalData.visaTemplate']) {
            body.visaTemplate = body['additionalData.visaTemplate'];
            delete body['additionalData.visaTemplate'];
        }

        resolve(body);
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
                console.log("Result: ", result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

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

//adjustTransactions()
function adjustTransactions() {
    var context = "Function adjustTransactions";

    var query = {
        "transactionsList.0": { "$exists": true }
    };

    Wallet.find(query, (err, result) => {
        if (err) {
            console.error(`[${context}][updateTransactions] Error `, err.message);

        } else {

            if (result.length > 0) {
                result.map(wallet => {
                    //console.log("wallet", wallet);
                    wallet.transactionsList.forEach(transaction => {
                        //console.log("transaction", transaction);
                        if (transaction.status === process.env.TransactionStatusPaidOut || transaction.status === process.env.TransactionStatusRefund) {
                            let newValues = {
                                transactionType: transaction.transactionType,
                                status: transaction.status,
                                provider: process.env.TransactionProviderWallet
                            }
                            Transactions.updateTransactions({ _id: transaction.transactionId }, { $set: newValues }, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateTransactions] Error `, err.message);
                                }
                                console.log("Transaction Updated")
                            })
                        }
                    });
                })
            };
        };
    });
};

/*totalWallet({ date: "2022-01-01T00:00:00" })
    .then((values) => {
        console.log("Values", values)
    })*/

function totalWallet(received) {
    return new Promise((resolve) => {
        const query = {

            $where: "this.transactionsList.length > 0"
        };

        var date = new Date(received.date);

        var totalAmount = 0;
        var totalSum = 0;
        var totalSub = 0;
        var listDebits = [];
        var listCredits = [];

        Wallet.find(query, async (err, walletsFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                var message = {
                    totalAmount: totalAmount,
                    totalSum: totalSum,
                    totalSub: totalSub,
                    listDebits_length: listDebits.length,
                    listDebits: listDebits,
                    listCredits_length: listCredits.length,
                    listCredits: listCredits
                };
                resolve(message)
            };

            if (walletsFound.length > 0) {

                Promise.all(

                    walletsFound.map(wallet => {

                        return new Promise((resolve, reject) => {

                            Promise.all(

                                wallet.transactionsList.map(transaction => {

                                    return new Promise((resolve, reject) => {

                                        if (transaction.transactionType !== "preAuthorize") {

                                            if (transaction.status === "40" || transaction.status === "70") {

                                                let query = {
                                                    _id: transaction.transactionId,
                                                    $or: [
                                                        { status: process.env.TransactionStatusPaidOut },
                                                        { status: process.env.TransactionStatusRefund }
                                                    ],
                                                    createdAt: { $lte: date }
                                                };

                                                Transactions.findOne(query, (err, transactionFound) => {

                                                    if (err) {

                                                        console.error(`[${context}][Transactions.findOne] Error `, err.message);
                                                        resolve();

                                                    };

                                                    if (transactionFound) {

                                                        let response;

                                                        switch (transactionFound.transactionType) {

                                                            case process.env.TransactionTypeCredit:

                                                                response = {
                                                                    type: process.env.TransactionTypeCredit,
                                                                    value: transactionFound.amount.value,
                                                                    id: transactionFound._id
                                                                };

                                                                listCredits.push(response);

                                                                totalSum += transactionFound.amount.value
                                                                //console.log("totalSum ", totalSum);
                                                                resolve();
                                                                break;

                                                            case process.env.TransactionTypeRefund:

                                                                response = {
                                                                    type: process.env.TransactionTypeRefund,
                                                                    value: transactionFound.amount.value,
                                                                    id: transactionFound._id
                                                                };

                                                                listCredits.push(response);

                                                                totalSum += transactionFound.amount.value
                                                                //console.log("totalSum ", totalSum);
                                                                resolve();
                                                                break;

                                                            case process.env.TransactionTypeDebit:

                                                                response = {
                                                                    type: process.env.TransactionTypeDebit,
                                                                    value: transactionFound.amount.value,
                                                                    id: transactionFound._id
                                                                };

                                                                listDebits.push(response);

                                                                totalSub += transactionFound.amount.value
                                                                //console.log("totalSub ", totalSub);
                                                                resolve();
                                                                break;

                                                            default:

                                                                resolve();
                                                                break;

                                                        };

                                                    } else {

                                                        resolve();

                                                    };

                                                });

                                            } else {

                                                resolve();

                                            };

                                        } else {

                                            resolve();

                                        };

                                    });

                                })

                            ).then(() => {


                                //console.log("totalSum ", totalSum);
                                //console.log("totalSub ", totalSub);

                                //console.log("listDebits ", listDebits);
                                //console.log("listCredits ", listCredits);
                                resolve();

                            });

                        });

                    })

                ).then(() => {

                    //console.log("totalSum ", totalSum);
                    //console.log("totalSub ", totalSub);

                    //console.log("listDebits ", listDebits.length);
                    //console.log("listCredits ", listCredits.length);

                    totalAmount = totalSum - totalSub;
                    //console.log("totalAmount ", totalAmount);
                    totalAmount = parseFloat(totalAmount.toFixed(2));
                    var message = {
                        totalAmount: totalAmount,
                        totalSum: parseFloat(totalSum.toFixed(2)),
                        totalSub: parseFloat(totalSub.toFixed(2)),
                        listDebits_length: listDebits.length,
                        listDebits: listDebits,
                        listCredits_length: listCredits.length,
                        listCredits: listCredits
                    };
                    //console.log("message 1 ", message);

                    resolve(message)

                });

            } else {

                //var message = { totalAmount: totalAmount };

                var message = {
                    totalAmount: totalAmount,
                    totalSum: totalSum,
                    totalSub: totalSub,
                    listDebits_length: listDebits.length,
                    listDebits: listDebits,
                    listCredits_length: listCredits.length,
                    listCredits: listCredits
                };
                //console.log("message 2 ", message);
                resolve(message);

            };

        });

    });



};

function totalWalletListTransations(received) {
    return new Promise((resolve) => {
        const query = {

            $where: "this.transactionsList.length > 0"
        };

        var date = new Date(received.date);

        var totalAmount = 0;
        var totalSum = 0;
        var totalSub = 0;
        var listDebits = [];
        var listCredits = [];
        var listOfTransactions = [];

        Wallet.find(query, async (err, walletsFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                var message = {
                    totalAmount: totalAmount,
                    totalSum: totalSum,
                    totalSub: totalSub,
                    listDebits_length: listDebits.length,
                    listDebits: listDebits,
                    listCredits_length: listCredits.length,
                    listCredits: listCredits,
                    listOfTransactions: listOfTransactions
                };
                resolve(message)
            };

            if (walletsFound.length > 0) {

                Promise.all(

                    walletsFound.map(wallet => {

                        return new Promise((resolve, reject) => {

                            Promise.all(

                                wallet.transactionsList.map(transaction => {

                                    return new Promise((resolve, reject) => {

                                        if (transaction.transactionType !== "preAuthorize") {

                                            if (transaction.status === "40" || transaction.status === "70") {

                                                let query = {
                                                    _id: transaction.transactionId,
                                                    $or: [
                                                        { status: process.env.TransactionStatusPaidOut },
                                                        { status: process.env.TransactionStatusRefund }
                                                    ],
                                                    createdAt: { $lte: date }
                                                };

                                                Transactions.findOne(query, (err, transactionFound) => {

                                                    if (err) {

                                                        console.error(`[${context}][Transactions.findOne] Error `, err.message);
                                                        resolve();

                                                    };

                                                    if (transactionFound) {

                                                        let response;

                                                        listOfTransactions.push(transactionFound);

                                                        switch (transactionFound.transactionType) {

                                                            case process.env.TransactionTypeCredit:

                                                                response = {
                                                                    type: process.env.TransactionTypeCredit,
                                                                    value: transactionFound.amount.value,
                                                                    id: transactionFound._id
                                                                };

                                                                listCredits.push(response);

                                                                totalSum += transactionFound.amount.value
                                                                //console.log("totalSum ", totalSum);
                                                                resolve();
                                                                break;

                                                            case process.env.TransactionTypeRefund:

                                                                response = {
                                                                    type: process.env.TransactionTypeRefund,
                                                                    value: transactionFound.amount.value,
                                                                    id: transactionFound._id
                                                                };

                                                                listCredits.push(response);

                                                                totalSum += transactionFound.amount.value
                                                                //console.log("totalSum ", totalSum);
                                                                resolve();
                                                                break;

                                                            case process.env.TransactionTypeDebit:

                                                                response = {
                                                                    type: process.env.TransactionTypeDebit,
                                                                    value: transactionFound.amount.value,
                                                                    id: transactionFound._id
                                                                };

                                                                listDebits.push(response);

                                                                totalSub += transactionFound.amount.value
                                                                //console.log("totalSub ", totalSub);
                                                                resolve();
                                                                break;

                                                            default:

                                                                resolve();
                                                                break;

                                                        };

                                                    } else {

                                                        resolve();

                                                    };

                                                });

                                            } else {

                                                resolve();

                                            };

                                        } else {

                                            resolve();

                                        };

                                    });

                                })

                            ).then(() => {


                                //console.log("totalSum ", totalSum);
                                //console.log("totalSub ", totalSub);

                                //console.log("listDebits ", listDebits);
                                //console.log("listCredits ", listCredits);
                                resolve();

                            });

                        });

                    })

                ).then(() => {

                    //console.log("totalSum ", totalSum);
                    //console.log("totalSub ", totalSub);

                    //console.log("listDebits ", listDebits.length);
                    //console.log("listCredits ", listCredits.length);

                    totalAmount = totalSum - totalSub;
                    //console.log("totalAmount ", totalAmount);
                    totalAmount = parseFloat(totalAmount.toFixed(2));
                    var message = {
                        totalAmount: totalAmount,
                        totalSum: parseFloat(totalSum.toFixed(2)),
                        totalSub: parseFloat(totalSub.toFixed(2)),
                        listDebits_length: listDebits.length,
                        listDebits: listDebits,
                        listCredits_length: listCredits.length,
                        listCredits: listCredits,
                        listOfTransactions: listOfTransactions
                    };
                    //console.log("message 1 ", message);

                    resolve(message)

                });

            } else {

                //var message = { totalAmount: totalAmount };

                var message = {
                    totalAmount: totalAmount,
                    totalSum: totalSum,
                    totalSub: totalSub,
                    listDebits_length: listDebits.length,
                    listDebits: listDebits,
                    listCredits_length: listCredits.length,
                    listCredits: listCredits,
                    listOfTransactions: listOfTransactions
                };
                //console.log("message 2 ", message);
                resolve(message);

            };

        });

    });



};

module.exports = router;