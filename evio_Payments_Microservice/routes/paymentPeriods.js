const express = require('express');
const router = express.Router();
const ListPaymentPeriods = require('../models/listPaymentPeriods');
const ListPaymentPeriodsMaping = require('../globals/paymentPeriod.json');
const RequestHistoryLogs = require('../models/requestHistoryLogs');
const UUID = require('uuid-js');
require("dotenv-safe").load();

//========== POST ==========
router.post('/api/private/paymentPeriods', (req, res, next) => {
    var context = "POST /api/private/paymentPeriods";
    try {

        let listPaymentPeriods = new ListPaymentPeriods(req.body);

        ListPaymentPeriods.createListPaymentPeriods(listPaymentPeriods, (err, result) => {
            if (err) {

                console.error(`[${context}][createListPaymentPeriods] Error `, err.message);
                res.status(500).send(err);
                saveRequestHistoryLogs(req, res, err);
                return res;

            } else {

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

//========== PATCH ==========

router.patch('/api/private/paymentPeriods', (req, res, next) => {
    var context = "PATCH /api/private/paymentPeriods";
    try {

        var userId = req.headers['userid'];
        var requestUserId = req.headers['requestuserid'];
        var received = req.body;

        if (!received.paymentPeriod || received.paymentPeriod.length === 0) {

            var message = { auth: false, code: 'server_paymentPeriod_required', message: "Payment period is required" };
            res.status(400).send(message);
            saveRequestHistoryLogs(req, res, message);
            return res;

        };

        if (requestUserId === process.env.OperationsManagementID) {

            let query = {
                userId: userId
            };

            let newValues = {
                paymentPeriod: received.paymentPeriod
            };

            ListPaymentPeriods.findOneAndUpdate(query, { $set: newValues }, { new: true }, (err, listPaymentPeriodUpdated) => {

                if (err) {

                    console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                    res.status(500).send(err);
                    saveRequestHistoryLogs(req, res, err);
                    return res;

                } else {

                    res.status(200).send(listPaymentPeriodUpdated);
                    saveRequestHistoryLogs(req, res, listPaymentPeriodUpdated);
                    return res;

                };

            });

        } else {

            var message = {
                auth: false, code: 'server_only_evio', message: "Only EVIO can edit list of payment periods."
            };
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

//========== PUT ==========

//========== GET ==========
router.get('/api/private/paymentPeriods', (req, res, next) => {
    var context = "GET /api/private/paymentPeriods";
    try {

        var userId = req.headers['userid'];
        var query = {
            userId: userId
        };

        var fields = {
            _id: 1,
            userId: 1,
            paymentPeriod: 1
        };

        ListPaymentPeriods.findOne(query, fields, (err, paymentPeriodFound) => {

            if (err) {

                console.error(`[${context}][ListPaymentPeriods.findOne] Error `, err.message);
                res.status(500).send(err);
                saveRequestHistoryLogs(req, res, err);
                return res;

            } else {

                if (paymentPeriodFound) {

                    res.status(200).send(paymentPeriodFound);
                    saveRequestHistoryLogs(req, res, paymentPeriodFound);
                    return res;

                } else {

                    let response = {
                        _id: "",
                        userId: userId,
                        paymentPeriod: []
                    };

                    res.status(200).send(response);
                    saveRequestHistoryLogs(req, res, response);
                    return res;

                };

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

router.get('/api/private/paymentPeriods/listPaymentPeriods', (req, res, next) => {
    var context = "GET /api/private/paymentPeriods/listPaymentPeriods";
    try {

        var userId = req.headers['userid'];

        res.status(200).send(ListPaymentPeriodsMaping);
        saveRequestHistoryLogs(req, res, ListPaymentPeriodsMaping);
        return res;


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        res.status(500).send(error.message);
        saveRequestHistoryLogs(req, res, error);
        return res;

    };
});

//========== DELETE ==========

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

module.exports = router;