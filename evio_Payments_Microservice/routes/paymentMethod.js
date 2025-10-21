const express = require('express');
const router = express.Router();
const ListPaymentMethod = require('../models/listPaymentMethod');
const RequestHistoryLogs = require('../models/requestHistoryLogs');
const PaymentMethodsMapping = require('../globals/paymentMethods.json');
const PaymentMethod = require('../models/paymentMethod');

const axios = require("axios");
const UUID = require('uuid-js');
require("dotenv-safe").load();

//========== POST ==========
router.post('/api/private/paymentMethods', (req, res, next) => {
    var context = "POST /api/private/paymentMethods";
    try {

        let listPaymentMethod = new ListPaymentMethod(req.body);

        ListPaymentMethod.createListPaymentMethod(listPaymentMethod, (err, result) => {
            if (err) {

                console.error(`[${context}][ListPaymentMethod.createListPaymentMethod] Error `, err.message);
                res.status(500).send(err);
                saveRequestHistoryLogs(req, res, err);
                return res;

            } else {
                res.status(200).send(result);
                saveRequestHistoryLogs(req, res, result);
                return res;

            }
        })

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.post('/api/private/paymentMethods/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/paymentMethods/runFirstTime";
    try {

        setNeedsThreeDSAuthenticationPaymentMethods()

        return res.status(200).send("OK");

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== PATCH ==========
router.patch('/api/private/paymentMethods', (req, res, next) => {
    var context = "PATCH /api/private/paymentMethods";
    try {

        let userId = req.headers['userid'];
        let userType = req.headers['usertype'];
        let received = req.body;

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

        if (received.length === 0) {

            updateListPaymentMethods(userId, userType, received, req, res);

        } else if (received.length === 1) {

            switch (received[0]) {

                case process.env.PaymentMethodTransfer:

                    updateListPaymentMethods(userId, userType, received, req, res);

                    break;
                case process.env.PaymentMethodCard:

                    updateListPaymentMethods(userId, userType, received, req, res);

                    break;
                default:

                    var message = { auth: false, code: 'server_unauthorized_paymentMethod', message: "Unauthorized payment method" };
                    res.status(400).send(message);
                    saveRequestHistoryLogs(req, res, message);
                    return res;

                    break;

            };

        } else if (received.length === 2) {

            if (received.includes(process.env.PaymentMethodCard) && received.includes(process.env.PaymentMethodWallet)) {

                var query = {
                    userId: userId,
                    creditCard: true
                };

                PaymentMethod.find(query, (err, paymentMethodsFound) => {
                    if (err) {

                        console.error(`[${context}] Error `, err.message);
                        reject(err);

                    } else {

                        if (paymentMethodsFound.length > 0) {

                            updateListPaymentMethods(userId, userType, received, req, res);

                        } else {

                            messageResponse = { auth: false, code: 'server_paymentMethodCard_required', message: 'Card payment method is required' };
                            res.status(400).send(messageResponse);
                            saveRequestHistoryLogs(req, res, messageResponse);
                            return res;

                        };

                    };
                });


            } else {

                var message = { auth: false, code: 'server_unauthorized_paymentMethod', message: "Unauthorized payment method" };
                res.status(400).send(message);
                saveRequestHistoryLogs(req, res, message);
                return res;

            };

        } else {

            var message = { auth: false, code: 'server_unauthorized_paymentMethod', message: "Unauthorized payment method" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== GET ==========
//Get paymentMethods by user
router.get('/api/private/paymentMethods', (req, res, next) => {
    var context = "GET /api/private/paymentMethods";
    try {
        var userId = req.headers['userid'];

        if (!userId) {

            var message = { auth: false, code: 'server_userId_required', message: "User id is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        }
        else {

            let query = {
                userId: userId
            };

            let fields = {
                _id: 1,
                userId: 1,
                paymentMethod: 1
            };

            ListPaymentMethod.findOne(query, fields, (err, paymentMethod) => {
                if (err) {

                    console.error(`[${context}][ListPaymentMethod.findOne] Error `, err.message);
                    res.status(500).send(err);
                    saveRequestHistoryLogs(req, res, err);
                    return res;

                }
                else {

                    res.status(200).send(paymentMethod);
                    saveRequestHistoryLogs(req, res, paymentMethod);
                    return res;

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

router.get('/api/private/paymentMethods/paymentMethodsMapping', (req, res, next) => {
    var context = "GET /api/private/paymentMethods/paymentMethodsMapping";
    try {

        res.status(200).send(PaymentMethodsMapping);
        saveRequestHistoryLogs(req, res, PaymentMethodsMapping);
        return res;

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//Endpoint jobs
//Job Send email card valida card date

router.post('/api/private/job/checkCardsExpiredMonth', (req, res) => {
    const context = "POST /api/private/job/checkCardsExpiredMonth";
    const query = {
        status: process.env.PaymentMethodStatusExpiredMonth
    }
    sendEmailExpired(query);

    console.log(`Send email card Job Status ${process.env.PaymentMethodStatusExpiredMonth} was executed`)
    return res.status(200).send(`Send email card Job Status ${process.env.PaymentMethodStatusExpiredMonth} was executed`);
});

router.post('/api/private/job/checkCardsExpired', (req, res) => {
    const context = "POST /api/private/job/checkCardsExpired";

    const query = {
        status: process.env.PaymentMethodStatusExpired
    }
    sendEmailExpired(query);

    console.log(`Send email card Job Status ${process.env.PaymentMethodStatusExpired} was executed`)
    return res.status(200).send(`Send email card Job Status ${process.env.PaymentMethodStatusExpired} was executed`);
});



//========== FUNCTIONS ==========
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

//setNeedsThreeDSAuthenticationPaymentMethods()
function setNeedsThreeDSAuthenticationPaymentMethods() {
    var context = "Function setNeedsThreeDSAuthenticationPaymentMethods";

    PaymentMethod.updateMany({}, { $set: { needsThreeDSAuthentication: true } }, (err, result) => {

        if (err) {

            console.error(`[${context}][PaymentMethod.updateMany] Error `, err.message);

        }

        console.log(result);

    });

};

function updateListPaymentMethods(userId, userType, received, req, res) {
    var context = "Function updateListPaymentMethods";

    let query = {
        userId: userId
    };

    let values = {
        userType: userType
    };

    if (Object.keys(received).length === 0 || received.length === 0) {
        values.paymentMethod = [];
    } else {
        values.paymentMethod = received;
    };

    ListPaymentMethod.findOneAndUpdate(query, { $set: values }, { new: true }, (err, paymentMethod) => {
        if (err) {
            console.error(`[${context}][PaymentMethod.findOneAndUpdate] Error `, err.message);
            res.status(500).send(err);
            saveRequestHistoryLogs(req, res, err);
            return res;
        } else {

            //console.log("result", result);
            if (paymentMethod) {

                res.status(200).send({ _id: paymentMethod._id, userId: paymentMethod.userId, paymentMethod: paymentMethod.paymentMethod });
                saveRequestHistoryLogs(req, res, { _id: paymentMethod._id, userId: paymentMethod.userId, paymentMethod: paymentMethod.paymentMethod });
                return res;

            } else {
                var newPaymentMethod = new ListPaymentMethod({
                    userId: userId,
                    paymentMethod: received,
                    userType: userType
                });

                ListPaymentMethod.create(newPaymentMethod, (err, paymentMethod) => {
                    if (err) {
                        console.error(`[${context}][PaymentMethod.findOneAndUpdate] Error `, err.message);
                        res.status(500).send(err);
                        saveRequestHistoryLogs(req, res, err);
                        return res;
                    } else {

                        res.status(200).send({ _id: paymentMethod._id, userId: paymentMethod.userId, paymentMethod: paymentMethod.paymentMethod });
                        saveRequestHistoryLogs(req, res, { _id: paymentMethod._id, userId: paymentMethod.userId, paymentMethod: paymentMethod.paymentMethod });
                        return res;

                    };
                });

            };

        };
    });
};

async function sendEmailExpired(query) {
    const context = "Function sendEmailExpired";

    try {
        // Ajusta a query para status expirado do mês, se necessário
        if (process.env.PaymentMethodStatusExpired == query.status) {
            const now = new Date();
            let month = now.getMonth() + 1;
            const year = now.getFullYear();
            month = month < 10 ? `0${month}` : `${month}`;
            query.updatedAt = { $gte: new Date(`${year}-${month}-01T00:00:00`) };
        }

        // Busca todos os userIds que atendem à query
        const userIds = await PaymentMethod.find(query).distinct("userId");
        if (!userIds.length) return;

        // Filtra userIds que NÃO têm cartões ativos (status: "APPROVED")
        const finalUserIds = [];
        for (const userId of userIds) {
            const hasApprovedCard = await PaymentMethod.exists({ userId, status: "APPROVED" });
            if (!hasApprovedCard || hasApprovedCard.length === 0) finalUserIds.push(userId);
        }

        // Envia email para cada usuário válido
        for (const userId of finalUserIds) {
            const user = await getUser(userId);
            if (user?.email) {
                await sendEmail(query.status, user);
            } else {
                console.warn(`[${context}] User with ID ${userId} does not have an email or does not exist.`);
            }
        }
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
    }
}

async function sendEmail(status, user) {
    var context = "Function sendEmail";

    try {

        let mailOptions = {
            to: user.email,
            message: {
                "username": user.name
            },
            type: status === process.env.PaymentMethodStatusExpiredMonth ? status.toLowerCase().replace(/(_\w)/g, match => match[1].toUpperCase()) : status.toLowerCase()
        };

        let headers = {
            clientname: user.clientName
        }
        const sendEmailRequest = process.env.NotificationsHost + process.env.PathSenEmail;
        await axios.post(sendEmailRequest, { mailOptions }, { headers });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

async function getUser(userId) {
    var context = "Function getUser";
    try {
        var host = process.env.HostUser + process.env.PathGetUser;
        var headers = {
            userid: userId
        };

        const result = await axios.get(host, { headers });

        if (result.data) {
            var user = result.data;
            user = JSON.parse(JSON.stringify(user));
            user.userId = userId;
            return user;
        } else {
            return {};
        }
    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        throw error;
    }
}


module.exports = router;