const EVIOIssues = require('../models/evioIssues');
const ExternalAPI = require('./externalAPI');
const SendEmail = require('./sendEmail');
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

module.exports = {
    addEvioIssues: function (req, res) {
        let context = "Funciton addEvioIssues";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let evioIssues = new EVIOIssues(req.body);
            let clientName = req.headers['clientname'];

            evioIssues.issuedUserId = userId;
            evioIssues.clientName = clientName;

            validateFields(evioIssues)
                .then(() => {
                    EVIOIssues.createEVIOIssues(evioIssues, (err, result) => {
                        if (err) {
                            console.log(`[${context}][createevioIssues] Error `, err.message);
                            reject(err);
                        }
                        else {
                            if (result) {
                                SendEmail.sendEmail(process.env.IssueTypeEVIO, evioIssues);
                                resolve({ auth: true, code: 'server_issue_created', message: "Issue created" });
                            }
                            else {
                                reject({ auth: false, code: 'server_issue_not_created', message: "Issue not created" });
                            };
                        };
                    });
                })
                .catch((error) => {
                    console.log(`[${context}][validateFields] Error `, error.message);
                    reject(error);
                });
        });
    },
    updateStatusIssues: function (req, res) {
        let context = "Funciton updateStatusIssues";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let received = req.body;
            let query = {
                _id: received._id
            };

            if (!received.status) {
                reject({ auth: false, code: 'server_status_required', message: "Status data is required" });
            }
            else {
                let newValues = { $set: { status: received.status } };
                EVIOIssues.findOneAndUpdate(query, newValues, { new: true }, (err, issueFound) => {
                    if (err) {
                        console.log(`[${context}][findOneAndUpdate] Error `, err.message);
                        reject(err);
                    }
                    else {
                        resolve(issueFound);
                    };
                })
            }

        });
    },
    getAllIssues: function (req, res) {
        let context = "Funciton getAllIssues";
        return new Promise((resolve, reject) => {
            let userId = req.headers['userid'];
            let query = {};

            EVIOIssues.find(query, (err, issuesFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (issuesFound.length === 0)
                        resolve(issuesFound);
                    else {
                        ExternalAPI.getNameOfUser(issuesFound)
                            .then((issuesFound) => {
                                resolve(issuesFound);
                            })
                            .catch((error) => {
                                console.log(`[${context}][getNameOfUser][.catch] Error `, error.message);
                                reject(error);
                            });
                    };
                };
            });

        });
    },
    getIssuesByCharger: function (req, res) {
        let context = "Funciton getIssuesByCharger";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let params = req.query;
            let query;
            if (params.chargerId == undefined) {
                reject({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });
            }
            if (params.hwId == undefined) {
                reject({ auth: false, code: 'server_hwId_id_required', message: 'Hw Id is required' });
            };

            if (params.hwId == "" && params.chargerId != "") {
                query = {
                    chargerId: params.chargerId
                };
            }
            else if (params.hwId != "" && params.chargerId == "") {
                query = {
                    hwId: params.hwId
                };
            }
            else if (params.hwId != "" && params.chargerId == "") {
                query = {
                    chargerId: params.chargerId,
                    hwId: params.hwId
                };
            }
            else {
                query = {
                };
            };

            EVIOIssues.find(query, (err, issuesFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (issuesFound.length === 0)
                        resolve(issuesFound);
                    else {
                        ExternalAPI.getNameOfUser(issuesFound)
                            .then((issuesFound) => {
                                resolve(issuesFound);
                            })
                            .catch((error) => {
                                console.log(`[${context}][getNameOfUser][.catch] Error `, error.message);
                                reject(error);
                            });
                    };
                };
            });

        });
    },
    getIssuesById: function (req, res) {
        let context = "Funciton getIssuesById";
        return new Promise((resolve, reject) => {
            let userId = req.headers['userid'];
            let params = req.query;

            if (params._id == "" || params._id === undefined) {

                reject({ auth: false, code: 'server_issue_id_required', message: 'Issue id is required' });

            }
            else {

                let query = {
                    _id: params._id
                };

                EVIOIssues.findOne(query, (err, issueFound) => {
                    if (err) {
                        console.log(`[${context}][findOne] Error `, err.message);
                        reject(err);
                    }
                    else {
                        resolve(issueFound);
                    };
                });

            };
        });
    },
    getIssuesByFilter: function (req, res) {
        let context = "Funciton getIssuesByFilter";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let query = req.query;

            EVIOIssues.find(query, (err, issuesFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (issuesFound.length === 0)
                        resolve(issuesFound);
                    else {
                        ExternalAPI.getNameOfUser(issuesFound)
                            .then((issuesFound) => {
                                resolve(issuesFound);
                            })
                            .catch((error) => {
                                console.log(`[${context}][getNameOfUser][.catch] Error `, error.message);
                                reject(error);
                            });
                    };
                };
            });

        });
    },
    getIssuesReportedByMe: function (req, res) {
        let context = "Funciton getIssuesReportedByMe";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let query = {
                issuedUserId: userId
            };

            EVIOIssues.find(query, (err, issuesFound) => {
                if (err) {

                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);

                }
                else {

                    resolve(issuesFound);

                };
            });

        });
    },
    getIssuesReportedByMeFilter: function (req, res) {
        let context = "Funciton getIssuesReportedByMeFilter";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let query = req.query;
            query.issuedUserId = userId;

            EVIOIssues.find(query, (err, issuesFound) => {
                if (err) {

                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);

                }
                else {

                    resolve(issuesFound);

                };
            });

        });
    },
    getIssuesReportedByMeByCharger: function (req, res) {
        let context = "Funciton getIssuesReportedByMeFilter";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let params = req.query;
            let query;

            if (params.chargerId == undefined) {
                reject({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });
            }
            if (params.hwId == undefined) {
                reject({ auth: false, code: 'server_hwId_id_required', message: 'Hw Id is required' });
            };

            if (params.hwId == "" && params.chargerId != "") {
                query = {
                    chargerId: params.chargerId,
                    issuedUserId: userId
                };
            }
            else if (params.hwId != "" && params.chargerId == "") {
                query = {
                    hwId: params.hwId,
                    issuedUserId: userId
                };
            }
            else if (params.hwId != "" && params.chargerId == "") {
                query = {
                    chargerId: params.chargerId,
                    hwId: params.hwId,
                    issuedUserId: userId
                };
            }
            else {
                query = {
                    issuedUserId: userId
                };
            };

            EVIOIssues.find(query, (err, issuesFound) => {
                if (err) {

                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);

                }
                else {

                    resolve(issuesFound);

                };
            });

        });
    }
};

//========== FUNCTION ==========
//Function to validate fields received 
function validateFields(evioIssues) {
    return new Promise((resolve, reject) => {
        if (!evioIssues)
            reject({ auth: false, code: 'server_issue_data_required', message: 'Issue data required' });

        else if (!evioIssues.chargerId && !evioIssues.hwId)
            reject({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });

        else if (!evioIssues.issuedUserId)
            reject({ auth: false, code: 'server_user_required', message: 'User id required!' });

        else if (!evioIssues.reasonCode)
            reject({ auth: false, code: 'server_reasonCode_required', message: 'Reason code is required' });
        else
            resolve(true);
    });
};

async function getIssuesToSendEmail() {
    const context = "Funciton getIssuesToSendEmail";

    let issuesFound = await EVIOIssues.find({ emailSent: false });

    console.log("getIssuesToSendEmail", issuesFound.length);
    if (issuesFound.length > 0) {
        issuesFound.forEach(issue => {
            SendEmail.sendEmail(process.env.IssueTypeEVIO, issue);
        })
    }
}

cron.schedule('*/30 * * * *', () => {

    getIssuesToSendEmail()

});