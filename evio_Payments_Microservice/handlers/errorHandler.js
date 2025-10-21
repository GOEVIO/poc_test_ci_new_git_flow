const RequestHistoryLogs = require('./requestHistoryLogsHandler');

module.exports = {
    ErrorHandler: function (req, error, res) {
        let context = "Function ErrorHandler";
        //return new Promise((resolve, reject)=>{

        if (error.auth === false) {

            console.error(`[${context}] [Status 400] Error `, error.message);
            res.status(400).send(error);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
            return res;
        }
        else {

            if (error.response) {

                console.error(`[${context}] [Status 400] Error `, error.response.data);
                res.status(400).send(error.response.data);
                RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.response.data);
                return res;

            }
            else {
                if (error.details) {
                    console.error(`[${context}] [Status 400] Error `, error.message);
                    res.status(400).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error);
                } else {
                    console.error(`[${context}] [Status 500] Error `, error.message);
                    res.status(500).send(error.message);
                    RequestHistoryLogs.saveRequestHistoryLogs(req, res, error.message);
                    return res;
                }

            };

        };

        //});
    }
};


