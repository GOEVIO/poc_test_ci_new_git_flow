require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const nodemailer = require("nodemailer");
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
const SenderEmail = require('../models/senderEmail');
const fs = require('fs')
const Support = require('../models/Support');

const configs_microservice_host = 'http://configs:3028';
const supportProxy = `${configs_microservice_host}/api/private/config/support`;

/*const transporter = nodemailer.createTransport({
    maxConnections: 2,
    maxMessages: 1,
    pool: true,
    host: 'smtp.office365.com',
    port: 587,
    auth: {
        user: process.env.EVIOMAIL,
        pass: process.env.EVIOPASSWORD
    }
});*/

/*let supportEmail = null;
let params = {
    clientName: "EVIO"

}
axios.get(supportProxy, { params })
    .then((supportConfig) => {

        console.log("supportConfig.data", supportConfig.data);
        if (supportConfig) {

            let result = supportConfig.data;
            if (result) {
                supportEmail = result.supportEmail;
            }
            else {
                supportEmail = process.env.EVIOMAILSUPPORT;
            }
        }
        else {
            supportEmail = process.env.EVIOMAILSUPPORT;
        }
    }).catch((error) => {
        if (error.response)
            console.log(`[getMailList][400] Error `, error.response.data);
        else
            console.log(`[getMailList][500] Error `, error.message);
        //res.send(false);
    });*/


router.post('/api/private/support', async (req, res, next) => {
    const context = "POST /api/private/support";
    try {

        if (!req.body.name) {
            return res.status(400).send({ code: 'name_missing', message: "Name is required!" });
        }

        if (!req.body.email) {
            return res.status(400).send({ code: 'email_missing', message: "Email is required!" });
        }

        if (!req.body.mobile) {
            return res.status(400).send({ code: 'mobile_missing', message: "Mobile is required!" });
        }

        if (!req.body.message) {
            return res.status(400).send({ code: 'message_missing', message: "Message is required!" });
        }

        let supportRequest = new Support(req.body);
        supportRequest.mobileBrand = req.headers['mobilebrand'];
        supportRequest.mobileModel = req.headers['mobilemodel'];
        supportRequest.mobileVersion = req.headers['mobileversion'];
        supportRequest.evioAppVersion = req.headers['evioappversion'];
        supportRequest.clientType = req.headers['client'];
        supportRequest.userId = req.headers['userid'];
        supportRequest.clientName = req.headers['clientname'];
        let clientName = req.headers['clientname'];

        if (!supportRequest.imageContent || supportRequest.imageContent.length === 0) {

            Support.createSupportRequest(supportRequest, (err, requestCreated) => {
                if (err) {
                    console.log(`[${context}][createSupportRequest] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (requestCreated) {
                        if (clientName === process.env.clientNameEVIO)
                            return res.status(200).send({ auth: true, code: 'support_request_received', message: "Support request received with success" });
                        else
                            return res.status(200).send({ auth: true, code: 'support_request_received_' + clientName, message: "Support request received with success" });
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'support_request_not_received', message: "Support request failed" });
                    }
                }
            });

        } else {

            let response = await saveImageContent(supportRequest);

            Support.createSupportRequest(supportRequest, (err, requestCreated) => {
                if (err) {
                    console.log(`[${context}][createSupportRequest] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (requestCreated) {
                        if (clientName === process.env.clientNameEVIO)
                            return res.status(200).send({ auth: true, code: 'support_request_received', message: "Support request received with success" });
                        else
                            return res.status(200).send({ auth: true, code: 'support_request_received_' + clientName, message: "Support request received with success" });
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'support_request_not_received', message: "Support request failed" });
                    }
                }
            });

        }

    } catch (error) {
        console.log(`[${context}] Error`, error);
        return res.status(500).send(error.message);
    };
});

router.post('/api/public/support', async (req, res, next) => {
    var context = "POST /api/public/support";
    try {

        if (!req.body.name) {
            return res.status(400).send({ code: 'name_missing', message: "Name is required!" });
        }

        if (!req.body.email) {
            return res.status(400).send({ code: 'email_missing', message: "Email is required!" });
        }

        if (!req.body.mobile) {
            return res.status(400).send({ code: 'mobile_missing', message: "Mobile is required!" });
        }

        if (!req.body.message) {
            return res.status(400).send({ code: 'message_missing', message: "Message is required!" });
        }


        let supportRequest = new Support(req.body);
        supportRequest.mobileBrand = req.headers['mobilebrand'];
        supportRequest.mobileModel = req.headers['mobilemodel'];
        supportRequest.mobileVersion = req.headers['mobileversion'];
        supportRequest.evioAppVersion = req.headers['evioappversion'];
        supportRequest.clientType = req.headers['client'];
        supportRequest.userId = "";
        supportRequest.clientName = req.headers['clientname'];
        let clientName = req.headers['clientname'];

        if (!supportRequest.imageContent || supportRequest.imageContent.length === 0) {

            Support.createSupportRequest(supportRequest, (err, requestCreated) => {
                if (err) {
                    console.log(`[${context}][createSupportRequest] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (requestCreated) {
                        if (clientName === process.env.clientNameEVIO)
                            return res.status(200).send({ auth: true, code: 'support_request_received', message: "Support request received with success" });
                        else
                            return res.status(200).send({ auth: true, code: 'support_request_received_' + clientName, message: "Support request received with success" });
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'support_request_not_received', message: "Support request failed" });
                    }
                }
            });

        } else {

            let response = await saveImageContent(supportRequest);

            Support.createSupportRequest(supportRequest, (err, requestCreated) => {
                if (err) {
                    console.log(`[${context}][createSupportRequest] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (requestCreated) {
                        if (clientName === process.env.clientNameEVIO)
                            return res.status(200).send({ auth: true, code: 'support_request_received', message: "Support request received with success" });
                        else
                            return res.status(200).send({ auth: true, code: 'support_request_received_' + clientName, message: "Support request received with success" });
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'support_request_not_received', message: "Support request failed" });
                    }
                }
            });

        }

    } catch (error) {
        console.log(`[${context}] Error`, error);
        return res.status(500).send(error.message);
    };
});

router.post('/api/public/support_old', (req, res, next) => {
    var context = "POST /api/public/support_old";
    try {

        if (!req.body.name) {
            return res.status(400).send({ code: 'name_missing', message: "Name is required!" });
        }

        if (!req.body.email) {
            return res.status(400).send({ code: 'email_missing', message: "Email is required!" });
        }

        if (!req.body.mobile) {
            return res.status(400).send({ code: 'mobile_missing', message: "Mobile is required!" });
        }

        if (!req.body.message) {
            return res.status(400).send({ code: 'message_missing', message: "Message is required!" });
        }

        let supportRequest = new Support(req.body);
        supportRequest.mobileBrand = req.headers['mobilebrand'];
        supportRequest.mobileModel = req.headers['mobilemodel'];
        supportRequest.mobileVersion = req.headers['mobileversion'];
        supportRequest.evioAppVersion = req.headers['evioappversion'];
        supportRequest.clientType = req.headers['client'];
        supportRequest.userId = "";
        let clientName = req.headers['clientname'];

        Support.createSupportRequest(supportRequest, (err, requestCreated) => {
            if (err) {
                console.log(`[${context}][createSupportRequest] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (requestCreated) {
                    if (clientName === process.env.clientNameEVIO)
                        return res.status(200).send({ auth: true, code: 'support_request_received', message: "Support request received with success" });
                    else
                        return res.status(200).send({ auth: true, code: 'support_request_received_' + clientName, message: "Support request received with success" });
                }
                else {
                    return res.status(400).send({ auth: true, code: 'support_request_not_received', message: "Support request failed" });
                }
            }
        });

    } catch (error) {
        console.log(`[${context}] Error`, error);
        return res.status(500).send(error.message);
    };
});


//Runs every 30 min
//cron.schedule('*/30 * * * *', () => {
cron.schedule('*/1 * * * *', () => {
    console.log('check for support requests');

    Support.find({ isToSend: true }, (err, requests) => {
        if (err) {
            console.error(`[][find] Error `, err.message);
        }
        else {
            if (requests.length == 0) {
                console.log("No support requests found");
            } else {

                //let promises = [];

                for (let i = 0; i < requests.length; i++) {

                    setTimeout(async function () {
                        let request = requests[i];

                        // promises.push(new Promise(function (resolve, reject) {

                        try {

                            let params = {
                                clientName: request.clientName
                            };
                            console.log("1");
                            let supportEmail = await axios.get(supportProxy, { params });
                            console.log("2");
                            let senderInfo = await getWLSenderEmailInfo(request.clientName);
                            console.log("2");

                            //console.log("supportEmail", supportEmail);
                            //console.log("senderInfo", senderInfo);

                            let imageToSend = '<b> image:</b><br>';

                            let mailOptions;
                            if (request.imageContent.length > 0) {

                                request.imageContent.forEach(image => {

                                    imageToSend += '<img width="300px" height="300px" style="width:300px;height:300px;" src=' + image + '></img><br>'
                                    //imageToSend += '<b> image: <link>' + image + ' </link></b>'

                                    //console.log("image 1", imageToSend);
                                })
                                // console.log("image", imageToSend);

                                mailOptions = {
                                    //source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
                                    //from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
                                    source: senderInfo.sourceInfo + '<' + senderInfo.email + '>',
                                    from: senderInfo.fromInfo + '<' + senderInfo.email + '>', // sender address
                                    to: supportEmail.data.supportEmail,
                                    subject: `[Support Request - ${request.userId} - ${request.name} ]`,
                                    text: 'Support Request',
                                    html: '<b> Name: ' + request.name + ' </b><br>' +
                                        '<b> Email: ' + request.email + ' </b><br>' +
                                        '<b> Mobile: ' + request.mobile + ' </b><br>' +
                                        '<b> Mobile brand: ' + request.mobileBrand + ' </b><br>' +
                                        '<b> Mobile model: ' + request.mobileModel + ' </b><br>' +
                                        '<b> Mobile version: ' + request.mobileVersion + ' </b><br>' +
                                        '<b> EVIO app version: ' + request.evioAppVersion + ' </b><br>' +
                                        '<b> Client type who make the request: ' + request.clientType + ' </b><br>' +
                                        '<b> Message: ' + request.message + ' </b><br>' +
                                        '<b> ' + imageToSend + ' </b><br>'
                                };

                                console.log("mailOptions", mailOptions);
                            } else {
                                mailOptions = {
                                    //source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
                                    //from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
                                    source: senderInfo.sourceInfo + '<' + senderInfo.email + '>',
                                    from: senderInfo.fromInfo + '<' + senderInfo.email + '>', // sender address
                                    to: supportEmail.data.supportEmail,
                                    subject: `[Support Request - ${request.userId} - ${request.name} ]`,
                                    text: 'Support Request',
                                    html: '<b> Name: ' + request.name + ' </b><br>' +
                                        '<b> Email: ' + request.email + ' </b><br>' +
                                        '<b> Mobile: ' + request.mobile + ' </b><br>' +
                                        '<b> Mobile brand: ' + request.mobileBrand + ' </b><br>' +
                                        '<b> Mobile model: ' + request.mobileModel + ' </b><br>' +
                                        '<b> Mobile version: ' + request.mobileVersion + ' </b><br>' +
                                        '<b> EVIO app version: ' + request.evioAppVersion + ' </b><br>' +
                                        '<b> Client type who make the request: ' + request.clientType + ' </b><br>' +
                                        '<b> Message: ' + request.message + ' </b><br>'
                                };
                            }

                            const transporter = nodemailer.createTransport({
                                maxConnections: 2,
                                maxMessages: 1,
                                pool: true,
                                host: senderInfo.host,
                                port: senderInfo.port,
                                auth: {
                                    user: senderInfo.email,
                                    pass: senderInfo.password
                                }
                            });


                            //console.log("mailOptions", mailOptions);

                            transporter.verify((error, success) => {
                                if (error) {
                                    console.error(`[transporter.verify] Error `, error.message);;
                                }
                                console.log("Server is ready to take our messages");

                                transporter.sendMail(mailOptions, (error, info) => {
                                    if (error) {
                                        console.log('Email not sent: ' + error);
                                    }
                                    else {
                                        console.log('Email sent: ' + info.response);

                                        let updateRequest = {
                                            isToSend: false,
                                            sent: true
                                        };

                                        let query = { _id: request._id }

                                        updateSupportRequest(query, updateRequest);
                                    }
                                });

                            });

                        } catch (error) {
                            if (error)
                                console.error(`[][] Error `, error.message);
                            else
                                console.error(`[${i}][] Error `, error);
                        };

                        //}));

                    }, i * 2 * 1000);

                }

                /* Promise.all(promises).then(() => {
                     resolve(true);
                 });*/

            }
        }
    });

});

function updateSupportRequest(query, updateRequest) {
    return new Promise((resolve, reject) => {

        Support.updateSupportRequest(query, { $set: updateRequest }, (err, result) => {
            if (err) {
                console.log(`[${context}][updateSupportRequest] Error `, err.message);
                reject(err);
            } else {
                if (result) {
                    console.log("Request " + query._id + " updated");
                    resolve();
                } else {
                    console.log("Request " + query._id + " not updated");
                    resolve();
                }
            }

        });

    });
}

function getWLSenderEmailInfo(clientName) {
    return new Promise((resolve, reject) => {

        let query = {
            clientName: clientName
        };

        SenderEmail.findOne(query, (err, info) => {
            if (err) {
                console.error(`[getWLSenderEmailInfo][find] Error `, err);
                reject(err);
            }
            else {
                if (info) {
                    resolve(info)
                } else {
                    reject("No sender email found");
                }
            }
        });

    });
}

function saveImageContent(supportRequest) {
    const context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {
            const saveImageContent = (image, index) => {
                return new Promise((resolve, reject) => {

                    if (image) {
                        let dateNow = Date.now();
                        let path = `/usr/src/app/img/support/${supportRequest._id}_${dateNow}_${index}.jpg`;
                        let pathImage = '';
                        let base64Image = image.split(';base64,').pop();
                        if (process.env.NODE_ENV === 'production') {
                            pathImage = `${process.env.HostProd}support/${supportRequest._id}_${dateNow}_${index}.jpg`; // For PROD server
                        }
                        else if (process.env.NODE_ENV === 'pre-production') {
                            pathImage = `${process.env.HostPreProd}support/${supportRequest._id}_${dateNow}_${index}.jpg`;// For Pred PROD server
                        }
                        else {
                            //pathImage = `${process.env.HostLocal}support/${supportRequest._id}_${dateNow}_${index}.jpg`;
                            pathImage = `${process.env.HostQA}support/${supportRequest._id}_${dateNow}_${index}.jpg`; // For QA server
                        };
                        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                                //resolve(true);
                            };

                            supportRequest.imageContent[index] = pathImage;
                            resolve(true);

                        });
                    } else {
                        resolve(true);
                    };

                });
            };
            Promise.all(
                supportRequest.imageContent.map((image, index) => saveImageContent(image, index))
            ).then((result) => {
                resolve(supportRequest);
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
}

module.exports = router;