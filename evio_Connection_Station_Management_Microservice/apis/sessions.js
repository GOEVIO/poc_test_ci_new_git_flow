const axios = require("axios");

function updateAutoStop(query, autoStop) {
    var context = "Function stoppedByOwner";
    try {
        var host = process.env.ChargersServiceProxy + process.env.ChargingSessionAutoStop;
        var data = {
            query: query,
            autoStop: autoStop
        };
        axios.patch(host, data)
            .then((result) => {

                if (result.data) {
                    console.log(`[${context}][${host}] Update successfully`);
                }
                else {
                    console.log(`[${context}][${host}] Update unsuccessfully`);
                };
            })
            .catch((error) => {
                if (error.response) {
                    console.log(`[${context}][.catch] Error`, error.response.data);
                }
                else {
                    console.log(`[${context}][${host}][.catch] Error`, error.message);
                };
            });
    } catch (error) {
        console.log(`[${context}] Error`, error.message);
    };
};

function stoppedByOwner(stopReason, sessionId) {
    var context = "Function stoppedByOwner";
    try {
        var data = {
            _id: sessionId,
            stopReason: stopReason
        };
        var host = process.env.ChargersServiceProxy + process.env.ChargingSessionStopPath
        axios.put(host, data)
            .then((result) => {
                console.log(`[${context}] Result`, result.data.message);
            })
            .catch((error) => {
                if (error.response) {
                    console.log(`[${context}][.catch] Error`, error.response.data);
                }
                else {
                    console.log(`[${context}][${host}][.catch] Error`, error.message);
                };
            });
    } catch (error) {
        console.log(`[${context}] Error`, error.message);
    };
};

function sendToStart(stationUrl, data, headers, res, stopReason, autoStop, req) {
    var context = "Function sendToStart";
    axios.post(stationUrl, data, { headers: headers })
        .then((result) => {
            if (stopReason !== undefined) {
                stoppedByOwner(stopReason, req.body._id);
            };
            if (Object.keys(autoStop).length != 0) {
                var query = {
                    _id: result.data.sessionId
                };
                updateAutoStop(query, autoStop);
            };
            return res.status(200).send(result.data);
        })
        .catch((error) => {
            console.log(`[${context}][${stationUrl}] Error`, error);
            if (error.response != undefined) {
                if (error.response.data.auth != undefined) {
                    console.log(`[${context}][${stationUrl}][.auth] Error`, error?.response?.data || {});
                    return res.status(400).send(error.response.data);
                }
                else {
                    console.log(`[${context}][${stationUrl}][.catch] Error`,  error?.response?.data || {});
                    return res.status(500).send(error.response.data);
                };
            }
            else {
                console.log(`[${context}][${stationUrl}][] Error`, error.message);
                return res.status(500).send(error);
            };
        });
};

module.exports = {
    updateAutoStop,
    stoppedByOwner,
    sendToStart
};