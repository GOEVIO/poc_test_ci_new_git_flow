const Messages = require('../models/messages');
const fs = require('fs');
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
const axios = require("axios");
require("dotenv-safe").load();

module.exports = {
    addMessages: function (req) {
        let context = "Funciton addMessages";
        return new Promise((resolve, reject) => {

            var userId = req.headers['userid'];
            var message = new Messages(req.body);
            message.userId = userId;

            validateFields(message)
                .then(() => {

                    if (message.type === process.env.TypeStop) {

                        Messages.disableAllMessagesStop((error, result) => {

                            if (error) {

                                console.log(`[${context}][disableAllMessagesStop] Error `, error.message);
                                reject(error);

                            }
                            else {

                                Messages.createMessages(message, (error, result) => {

                                    if (error) {

                                        console.log(`[${context}][createMessages] Error `, error.message);
                                        reject(error);

                                    }
                                    else {

                                        resolve(result);

                                    };

                                });

                            };

                        });

                    }
                    else if (message.type === process.env.TypeInfo) {

                        Promise.all(
                            message.infoMessage.map(info => {
                                return new Promise((resolve, reject) => {

                                    if (info.image === undefined) {

                                        info.image = "";
                                        resolve(true);

                                    }
                                    else if (info.image === "") {

                                        info.image = "";
                                        resolve(true);

                                    }
                                    else if (info.image.includes('base64')) {

                                        saveImage(info)
                                            .then((imagePath) => {

                                                info.image = imagePath;
                                                resolve(true);

                                            })
                                            .catch((error) => {

                                                console.log(`[${context}][saveImage] Error `, error.message);
                                                reject(false);

                                            });

                                    }
                                    else {

                                        resolve(true);

                                    };

                                });
                            })
                        ).then(() => {

                            Messages.createMessages(message, (error, result) => {

                                if (error) {

                                    console.log(`[${context}][createMessages] Error `, error.message);
                                    reject(error);

                                }
                                else {

                                    resolve(result);

                                };

                            });

                        }).catch((error) => {

                            console.log(`[${context}] Error `, error.message);
                            reject(error);

                        });

                    }
                    else {

                        if (message.active) {
                            sendSMS(message);
                        };

                        Messages.createMessages(message, (error, result) => {

                            if (error) {

                                console.log(`[${context}][createMessages] Error `, error.message);
                                reject(error);

                            }
                            else {

                                resolve(result);

                            };

                        });

                    };

                })
                .catch((error) => {

                    reject(error);

                });
        });
    },
    getMessagesLandingPage: function (req) {
        let context = "Funciton getMessagesLandingPage";
        return new Promise(async (resolve, reject) => {

            var queryWarning = {
                type: process.env.TypeWarning,
                active: true
            };

            var fieldsWarning = {
                type: 1,
                message: 1,
                active: 1,
                startDateStopMessage: 1,
                endDateStopMessage: 1
            };

            var queryStop = {
                type: process.env.TypeStop,
                active: true,
                startDateStopMessage: { $lte: new Date() },
                endDateStopMessage: { $gte: new Date() }
            };

            var fieldsStop = {
                type: 1,
                message: 1,
                active: 1,
                startDateStopMessage: 1,
                endDateStopMessage: 1
            };

            var queryInfo = {
                type: process.env.TypeInfo,
                active: true,

            };

            var fieldsInfo = {
                type: 1,
                infoMessage: 1,
                active: 1,
                startDateStopMessage: 1,
                endDateStopMessage: 1
            };

            let warningsMessage = await getWarnings(queryWarning, fieldsWarning);
            let stopMessage = await getStop(queryStop, fieldsStop);
            let infoMessage = await getInfo(queryInfo, fieldsInfo);

            if (warningsMessage.length === 0) {

                var warning = {
                    warningsMessage: warningsMessage,
                    warningActive: false
                };

            }
            else {

                var warning = {
                    warningsMessage: warningsMessage,
                    warningActive: true
                };

            };

            if (Object.keys(stopMessage).length === 0) {

                var stop = {
                    stopMessage: stopMessage,
                    stopActive: false
                };

            }
            else {

                var stop = {
                    stopMessage: stopMessage,
                    stopActive: true
                };

            };

            if (Object.keys(infoMessage).length === 0) {

                var info = {
                    infoMessage: infoMessage,
                    infoActive: false
                };

            }
            else {

                var info = {
                    infoMessage: infoMessage,
                    infoActive: true
                };

            };

            let response = {
                warnings: warning,
                stop: stop,
                info: info
            };

            resolve(response);

        });
    },
    getMessages: function (req) {
        let context = "Funciton getMessages";
        return new Promise((resolve, reject) => {

            let query;

            if (Object.keys(req.query).length === 0) {

                query = {};

            }
            else {

                if (req.query.startDateStopMessage !== undefined && req.query.endDateStopMessage !== undefined) {

                    var startDateStopMessage = req.query.startDateStopMessage;
                    var endDateStopMessage = req.query.endDateStopMessage;

                    query = req.query;
                    query.startDateStopMessage = { $lte: startDateStopMessage };
                    query.endDateStopMessage = { $gte: endDateStopMessage };

                }
                else if (req.query.startDateStopMessage !== undefined) {

                    var startDateStopMessage = req.query.startDateStopMessage;
                    query = req.query;
                    query.startDateStopMessage = { $lte: startDateStopMessage };

                }
                else if (req.query.endDateStopMessage !== undefined) {

                    var endDateStopMessage = req.query.endDateStopMessage;
                    query = req.query;
                    query.endDateStopMessage = { $gte: endDateStopMessage };

                }
                else {

                    query = req.query;

                };

            };

            Messages.find(query, (error, result) => {

                if (error) {

                    console.log(`[${context}][Messages.find] Error `, error.message);
                    reject(error);

                }
                else {

                    resolve(result);

                };

            });

        });
    },
    deleteMessages: function (req) {
        let context = "Funciton deleteMessages";
        return new Promise((resolve, reject) => {

            var received = req.body;

            Promise.all(
                received.map(message => {
                    return new Promise((resolve, reject) => {

                        var query = { _id: message._id };
                        var values = { $set: { active: false } };

                        Messages.updateMessages(query, values, (error, result) => {

                            if (error) {

                                console.error(`[${context}] Error `, error.message);
                                reject(error);
                            }
                            else {

                                resolve(true);

                            };

                        });

                    });
                })
            ).then(() => {

                resolve({ auth: true, code: 'server_disabled_messages', message: 'Disabled messages' })

            }).catch((error) => {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            });

        });
    }
}

//========== FUNCTIONS ==========
function validateFields(message) {
    return new Promise((resolve, reject) => {
        if (!message)
            reject({ auth: false, code: 'server_message_data_required', message: 'Message data is required' });

        else if (!message.type)
            reject({ auth: false, code: 'server_typeMessage_required', message: 'Type of message is required' });

        else if (!message.userId)
            reject({ auth: false, code: 'server_userId_required', message: 'User Id is required' });

        else if (!message.dateToDeactivate)
            reject({ auth: false, code: 'server_dateToDeactivate_required', message: 'Deactivate date is required' });

        else if (message.type === process.env.TypeStop) {

            if (!message.message)
                reject({ auth: false, code: 'server_message_required', message: 'Message is required' });

            else if (!message.startDateStopMessage)
                reject({ auth: false, code: 'server_startDateStopMessage_required', message: 'Start Date is required' });

            else if (!message.endDateStopMessage)
                reject({ auth: false, code: 'server_endDateStopMessage_required', message: 'End Date is required' });

            else
                resolve(true);
        }
        else if (message.type === process.env.TypeInfo) {

            if (message.infoMessage.length === 0)
                reject({ auth: false, code: 'server_message_required', message: 'Message is required' });

            else
                resolve(true);

        }
        else if (message.type === process.env.TypeWarning) {

            if (!message.message)
                reject({ auth: false, code: 'server_message_required', message: 'Message is required' });

            else
                resolve(true);
        }

        else
            resolve(true);
    });
};

function saveImage(info) {
    var context = "Function saveImage";
    return new Promise((resolve, reject) => {
        try {

            var path = '/usr/src/app/img/infoMessage/' + info._id + '.jpg';
            var pathImage = '';
            var base64Image = info.image.split(';base64,').pop();

            if (process.env.NODE_ENV === 'production') {
                pathImage = process.env.HostProd + 'infoMessage/' + info._id + '.jpg'; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = process.env.HostPreProd + 'infoMessage/' + info._id + '.jpg'; // For PROD server
            }
            else {
                //pathImage = process.env.HostLocal+'infoMessage/' + info._id + '.jpg'; // For local host
                pathImage = process.env.HostQA + 'infoMessage/' + info._id + '.jpg'; // For QA server
            };

            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {

                    console.error(`[${context}] Error `, err.message);
                    reject(err);

                }
                else {

                    resolve(pathImage);

                };
            });

        }
        catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};

async function sendSMS(message) {
    var context = "Function deativateMessagens";

    try {

        var proxyUser = process.env.HostUsers + process.env.PathUsers;

        var params = {
            active: true
        };

        let listOfUsers = await axios.get(proxyUser, { params });

        var proxyLanguage = process.env.HostLanguage + process.env.PathGetLanguage;

        var params = {
            languageCode: 'pt'
        };

        let language = await axios.get(proxyLanguage, { params });

        var proxyNotifications = process.env.HostNotifications + process.env.PathSendSMS;


        if (listOfUsers.data.length != 0) {

            var users = listOfUsers.data;

            var message = language.data[0].translations.find(translation => {
                return translation.key === message.message;
            });

            users.map(newUser => {

                var data = {
                    user: [
                        {
                            internationalPrefix: newUser.internationalPrefix,
                            mobile: newUser.mobile
                        }
                    ],
                    message: message.value
                }
                axios.post(proxyNotifications, data)
                    .then(() => {
                        console.log(`[${context}] SMS send `);
                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                    });

            });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };

};

function getWarnings(query, fields) {
    var context = "Function getWarnings";
    return new Promise((resolve, reject) => {

        Messages.find(query, fields, (error, result) => {

            if (error) {

                console.log(`[${context}] Error `, error.message);
                reject(error);

            }
            else {

                resolve(result);

            };

        });

    });
};

function getStop(query, fields) {
    var context = "Function getWarnings";
    return new Promise((resolve, reject) => {

        Messages.findOne(query, fields, (error, result) => {

            if (error) {

                console.log(`[${context}] Error `, error.message);
                reject(error);

            }
            else {

                if (result) {

                    resolve(result);

                }
                else {

                    resolve({});

                };

            };

        });

    });
};

function getInfo(query, fields) {
    var context = "Function getInfo";
    return new Promise((resolve, reject) => {

        Messages.findOne(query, fields, (error, result) => {

            if (error) {

                console.log(`[${context}] Error `, error.message);
                reject(error);

            }
            else {

                if (result) {

                    resolve(result);

                }
                else {

                    resolve({});

                };

            };

        });

    });
};

//Runs at 0:01 everyday
cron.schedule('1 0 * * *', () => {
    console.log("Start cron update");
    disableMessages();
    enableMessages();
});

//disableMessages();
//enableMessages();

function disableMessages() {
    var context = "Function deativateMessagens";
    var query = {
        active: true,
        dateToDeactivate: { $lte: new Date() }
    };

    var values = { $set: { active: false } };


    Messages.updateMessages(query, values, (error, result) => {

        if (error) {

            console.error(`[${context}][updateMessages] Error `, error.message);

        }
        else {

            console.log(`[${context}][updateMessages] Updated`);

        };

    });

};

function enableMessages() {
    var context = "Function deativateMessagens";
    var query = {
        active: false,
        dateToActivate: { $lte: new Date() },
        dateToDeactivate: { $gt: new Date() }
    };

    var values = { $set: { active: true } };

    Messages.updateMany(query, values, (error, result) => {

        if (error) {

            console.error(`[${context}][updateMessages] Error `, error.message);

        }
        else {

            console.log(`[${context}][updateMessages] Updated`);

        };

    });

};

//Runs at 10:00 everyday
//cron.schedule('0 10 * * *', () => {
/*
console.log("Start cron update", new Date());
messageToSendSMS()
});
*/

function dataAtualFormatada(data) {

    return new Promise(resolve => {
        //var data = new Date(),
        var dia = data.getDate().toString().padStart(2, '0'),
            mes = (data.getMonth() + 1).toString().padStart(2, '0'), //+1 pois no getMonth Janeiro começa com zero.
            ano = data.getFullYear();
        resolve(dia + "/" + mes + "/" + ano);
    });

};

//messageToSendSMS();

async function messageToSendSMS() {
    var context = "Function messageToSendSMS";

    let dateNow = await dataAtualFormatada(new Date());

    var query = {
        active: true,
        type: process.env.TypeWarning
    };

    Messages.find(query, (error, result) => {

        if (error) {

            console.error(`[${context}] Error `, error.message);
            //reject(error);

        }
        else {

            if (result.length != 0) {

                result.map(async message => {
                    let date = await dataAtualFormatada(message.dateToActivate);
                    if (date === dateNow) {
                        sendSMS(message);
                    };

                });

            };

        };

    });
};


//
//var logos = require('../models/logos.json');

//saveImageEVIO(logos);

function saveImageEVIO(images) {
    images.map(image => {
        var path = '/usr/src/app/img/logos/' + image.name;
        var base64Image = image.image.split(';base64,').pop();

        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
            if (err) {

                console.error(`[$] Error `, err.message);

            }
            else {

                console.log(`[$] UPDATE `);

            };
        });

    })

};