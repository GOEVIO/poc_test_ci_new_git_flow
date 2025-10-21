const RequestHistoryLogs = require('../models/requestHistoryLogs');
const UUID = require('uuid-js');

module.exports = {
    saveRequestHistoryLogs: function (req, res, body) {
        const context = "Function saveRequestHistoryLogs payments";

        const requestHistoryLogs = new RequestHistoryLogs({
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

    }
}