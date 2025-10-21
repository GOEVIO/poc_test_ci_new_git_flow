const express = require('express');
const router = express.Router();
var HostIssues = require('../models/hostIssues');
const axios = require("axios");

//========== POST ==========
//Create a new issue to report to the charger owner
router.post('/api/private/hostIssues', (req, res, next) => {
    var context = "POST /api/private/hostIssues";
    try {
        var userId = req.headers['userid'];
        var hostIssue = new HostIssues(req.body);
        hostIssue.issuedUserId = userId;
        validateFields(hostIssue)
            .then(() => {
                HostIssues.createHostIssues(hostIssue, (err, result) => {
                    if (err) {
                        console.error(`[${context}][createHostIssues] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (result) {
                            return res.status(200).send({ auth: true, code: 'server_issue_created', message: "Issue created" });
                        }
                        else {
                            return res.status(400).send({ auth: false, code: 'server_issue_not_created', message: "Issue not created" });
                        };
                    };
                });
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========

//========== PATCH ==========
//Update the status of the issue
router.patch('/api/private/hostIssues', (req, res, next) => {
    var context = "PATCH /api/private/hostIssues";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        if (received.status == "") {
            return res.status(400).send({ auth: false, code: 'server_status_required', message: "Status data is required" });
        }
        else {
            findOneHostIssues(query)
                .then((issueFound) => {
                    if (issueFound) {
                        issueFound.status = received.status;
                        var newValues = { $set: issueFound };
                        updateHostIssues(query, newValues)
                            .then((result) => {
                                if (result)
                                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                else
                                    return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                            })
                            .catch((error) => {
                                console.error(`[${context}][updateHostIssues][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_issue_not_found', message: "Issue not found for given parameters" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][findOneHostIssues][.catch] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        }
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get all issues that were reported to me
router.get('/api/private/hostIssues', (req, res, next) => {
    var context = "GET /api/private/hostIssues";
    try {
        var userId = req.headers['userid'];
        var query = {
            hostId: userId
        };
        findHostIssues(query)
            .then((issuesFound) => {
                if (issuesFound.length == 0)
                    return res.status(200).send(issuesFound);
                else {
                    getNameOfUser(issuesFound)
                        .then((issuesFound) => {
                            return res.status(200).send(issuesFound);
                        })
                        .catch((error) => {
                            console.error(`[${context}][getNameOfUser][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findHostIssues][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all issues that were reported to me by charger
router.get('/api/private/hostIssues/byCharger', (req, res, next) => {
    var context = "GET /api/private/hostIssues/byCharger";
    try {
        var userId = req.headers['userid'];
        var params = req.query;
        if (params.chargerId == undefined) {
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });
        }
        if (params.hwId == undefined) {
            return res.status(400).send({ auth: false, code: 'server_hwId_id_required', message: 'Hw Id is required' });
        }
        if (params.hwId == "" && params.chargerId != "") {
            var query = {
                chargerId: params.chargerId,
                hostId: userId
            };
        }
        else if (params.hwId != "" && params.chargerId == "") {
            var query = {
                hwId: params.hwId,
                hostId: userId
            };
        }
        else if (params.hwId != "" && params.chargerId == "") {
            var query = {
                chargerId: params.chargerId,
                hwId: params.hwId,
                hostId: userId
            };
        }
        else {
            var query = {
                hostId: userId
            };
        };
        findHostIssues(query)
            .then((issuesFound) => {
                if (issuesFound.length == 0)
                    return res.status(200).send(issuesFound);
                else {
                    getNameOfUser(issuesFound)
                        .then((issuesFound) => {
                            return res.status(200).send(issuesFound);
                        })
                        .catch((error) => {
                            console.error(`[${context}][getNameOfUser][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findHostIssues][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get issue by id
router.get('/api/private/hostIssues/byId', (req, res, next) => {
    var context = "GET /api/private/hostIssues/byId";
    try {
        var userId = req.headers['userid'];
        var params = req.query;
        if (params._id == "" || params._id === undefined) {
            return res.status(400).send({ auth: false, code: 'server_issue_id_required', message: 'Issue id is required' });
        }
        else {
            var query = {
                _id: params._id
            };
            findOneHostIssues(query)
                .then((issuesFound) => {
                    if (issuesFound)
                        return res.status(200).send(issuesFound);
                    else {
                        return res.status(400).send({ auth: false, code: 'server_issue_not_found', message: "Issue not found for given parameters" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][findOneHostIssues][.catch] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        }
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all issues that were reported to me using filters
router.get('/api/private/hostIssues/filter', (req, res, next) => {
    var context = "GET /api/private/hostIssues/filter";
    try {
        var userId = req.headers['userid'];
        var query = req.query;
        query.hostId = userId;
        findHostIssues(query)
            .then((issuesFound) => {
                if (issuesFound.length == 0)
                    return res.status(200).send(issuesFound);
                else {
                    getNameOfUser(issuesFound)
                        .then((issuesFound) => {
                            return res.status(200).send(issuesFound);
                        })
                        .catch((error) => {
                            console.error(`[${context}][getNameOfUser][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findHostIssues][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all issues reported by me
router.get('/api/private/hostIssues/reportedByMe', (req, res, next) => {
    var context = "GET /api/private/hostIssues/reportedByMe";
    try {
        var userId = req.headers['userid'];
        var query = {
            issuedUserId: userId
        };
        findHostIssues(query)
            .then((issuesFound) => {
                return res.status(200).send(issuesFound);
            })
            .catch((error) => {
                console.error(`[${context}][findHostIssues] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all issues reported by me by charger
router.get('/api/private/hostIssues/reportedByMe/byCharger', (req, res, next) => {
    var context = "GET /api/private/hostIssues/reportedByMe/byCharger";
    try {
        var userId = req.headers['userid'];
        var params = req.query;
        if (params.chargerId == undefined) {
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });
        }
        if (params.hwId == undefined) {
            return res.status(400).send({ auth: false, code: 'server_hwId_id_required', message: 'Hw Id is required' });
        }
        if (params.hwId == "" && params.chargerId != "") {
            var query = {
                chargerId: params.chargerId,
                issuedUserId: userId
            };
        }
        else if (params.hwId != "" && params.chargerId == "") {
            var query = {
                hwId: params.hwId,
                issuedUserId: userId
            };
        }
        else if (params.hwId != "" && params.chargerId == "") {
            var query = {
                chargerId: params.chargerId,
                hwId: params.hwId,
                issuedUserId: userId
            };
        }
        else {
            var query = {
                issuedUserId: userId
            };
        };
        findHostIssues(query)
            .then((issuesFound) => {
                return res.status(200).send(issuesFound);
            })
            .catch((error) => {
                console.error(`[${context}][findHostIssues] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all issues reported by me using filters
router.get('/api/private/hostIssues/reportedByMe/filter', (req, res, next) => {
    var context = "GET /api/private/hostIssues/reportedByMe/filter";
    try {
        var userId = req.headers['userid'];
        var query = req.query;
        query.issuedUserId = userId;
        findHostIssues(query)
            .then((issuesFound) => {
                return res.status(200).send(issuesFound);
            })
            .catch((error) => {
                console.error(`[${context}][findHostIssues] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
//Function to validate fields received 
function validateFields(hostIssue) {
    return new Promise((resolve, reject) => {
        if (!hostIssue)
            reject({ auth: false, code: 'server_issue_data_required', message: 'Issue data required' });

        else if (!hostIssue.chargerId && !hostIssue.hwId)
            reject({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });

        else if (!hostIssue.hostId)
            reject({ auth: false, code: 'server_host_user_required', message: 'Host user id required!' });

        else if (!hostIssue.issuedUserId)
            reject({ auth: false, code: 'server_user_required', message: 'User id required!' });

        else if (!hostIssue.reasonCode)
            reject({ auth: false, code: 'server_reasonCode_required', message: 'Reason code is required' });
        else
            resolve(true);
    });
};

//Funtion to find on Data base using query
function findHostIssues(query) {
    var context = "Function findHostIssues";
    return new Promise((resolve, reject) => {
        try {

            HostIssues.find(query, (err, issuesFound) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(issuesFound);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Funtion to find one issue on Data base using query
function findOneHostIssues(query) {
    var context = "Function findOneHostIssues";
    return new Promise((resolve, reject) => {
        try {

            HostIssues.findOne(query, (err, issueFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(issueFound);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Funciton to update on data base
function updateHostIssues(query, newValues) {
    var context = "Function updateHostIssues";
    return new Promise((resolve, reject) => {
        try {
            HostIssues.updateHostIssues(query, newValues, (error, result) => {
                if (error) {
                    console.error(`[${context}][updateHostIssues] Error `, error.message);
                    reject(error);
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

//Function to get Name of an user
function getNameOfUser(issuesFound) {
    var context = "Function getNameOfUser";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.HostUser + process.env.PathGetUser;
            const getNameOfUser = (issue) => {
                return new Promise((resolve, reject) => {
                    var headers = {
                        userid: issue.issuedUserId
                    };
                    axios.get(host, { headers })
                        .then((value) => {
                            var userFound = value.data;
                            issue.issuedUserId = userFound.name;
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error(`[${context}][getNameOfUser] Error `, error.message);
                            reject(error);
                        });
                });
            };

            Promise.all(
                issuesFound.map(issue => getNameOfUser(issue))
            ).then(() => {
                resolve(issuesFound);
            }).catch((error) => {
                console.error(`[${context}][issuesFound.map] Error `, error.message);
                reject(error);
            })

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

module.exports = router;