const HostIssues = require('../models/hostIssues');
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
    addHostIssues: function (req, res) {
        let context = "Funciton addHostIssues";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let hostIssue = new HostIssues(req.body);
            let clientName = req.headers['clientname'];

            hostIssue.issuedUserId = userId;
            hostIssue.clientName = clientName;

            validateFields(hostIssue)
                .then(() => {

                    HostIssues.createHostIssues(hostIssue, (err, result) => {
                        if (err) {
                            console.error(`[${context}][createHostIssues] Error `, err.message);
                            reject(err);
                        }
                        else {
                            if (result) {
                                SendEmail.sendEmail(process.env.IssueTypeHost, hostIssue);
                                resolve({ auth: true, code: 'server_issue_created', message: "Issue created" });
                            }
                            else {
                                reject({ auth: false, code: 'server_issue_not_created', message: "Issue not created" });
                            };
                        };
                    });

                })
                .catch((error) => {
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
                HostIssues.findOneAndUpdate(query, newValues, { new: true }, (err, issueFound) => {
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
            let query = {
                hostId: userId
            };

            HostIssues.find(query, (err, issuesFound) => {
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
            }
            if (params.hwId == "" && params.chargerId != "") {
                query = {
                    chargerId: params.chargerId,
                    hostId: userId
                };
            }
            else if (params.hwId != "" && params.chargerId == "") {
                query = {
                    hwId: params.hwId,
                    hostId: userId
                };
            }
            else if (params.hwId != "" && params.chargerId == "") {
                query = {
                    chargerId: params.chargerId,
                    hwId: params.hwId,
                    hostId: userId
                };
            }
            else {
                query = {
                    hostId: userId
                };
            };

            HostIssues.find(query, (err, issuesFound) => {
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
                HostIssues.findOne(query, (err, issueFound) => {
                    if (err) {
                        console.log(`[${context}][findOne] Error `, err.message);
                        reject(err);
                    }
                    else {

                        if (issueFound)
                            resolve(issueFound);
                        else {
                            reject({ auth: false, code: 'server_issue_not_found', message: "Issue not found for given parameters" });
                        };
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
            query.hostId = userId;
            HostIssues.find(query, (err, issuesFound) => {
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
            HostIssues.find(query, (err, issuesFound) => {
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
        let context = "Funciton getIssuesReportedByMeByCharger";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let params = req.query;
            let query;
            if (params.chargerId == undefined) {
                reject({ auth: false, code: 'server_charger_id_required', message: 'Charger Id is required' });
            }
            if (params.hwId == undefined) {
                reject({ auth: false, code: 'server_hwId_id_required', message: 'Hw Id is required' });
            }
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

            HostIssues.find(query, (err, issuesFound) => {
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
            HostIssues.find(query, (err, issuesFound) => {
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

async function getHostIssuesToSendEmail() {
    const context = "Funciton getHostIssuesToSendEmail";

    let issuesFound = await HostIssues.find({ emailSent: false });

    console.log("getHostIssuesToSendEmail", issuesFound.length);
    if (issuesFound.length > 0) {
        issuesFound.forEach(issue => {
            SendEmail.sendEmail(process.env.IssueTypeHost, issue);
        })
    }
}

cron.schedule('*/30 * * * *', () => {

    getHostIssuesToSendEmail()

});