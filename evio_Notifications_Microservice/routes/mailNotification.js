require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const nodemailer = require("nodemailer");
const axios = require("axios");
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: () => ({
        start: () => { },
        stop: () => { },
        validate: () => { },
        status: '',
    })
};
const MailNotification = require('../models/MailNotification');
const moment = require('moment');
const path = require("path");
const fs = require("fs");
const handlebars = require('handlebars');
const ejs = require("ejs");
const inlineBase64 = require('nodemailer-plugin-inline-base64');

const ParticularContract = require('../utils/ParticularContractUtils');
const Constants = require('../utils/constants');
const DeleteAccountEmailTypes = require('../utils/deleteAccountEmailTypes');

const configs_microservice_host = 'http://configs:3028';
const notificationsProxy = `${configs_microservice_host}/api/private/config/mailNotification`;

const identity_microservice_host = 'http://identity:3003'
const userAccountProxy = `${identity_microservice_host}/api/private/users/account`;

const { getTranslationsAccordingToUser } = require('../services/languageService');
const { replaceAll } = require('../middlewares/mailNotifications')
const { getEmailHeaderKey } = require('../utils/supportHeaderTypes');
const Utils = require("../utils/Utils");

const Sentry = require('@sentry/node');

const transporter = nodemailer.createTransport({
    maxConnections: 2,
    maxMessages: 1,
    pool: true,
    host: 'smtp.office365.com',
    port: 587,
    auth: {
        user: process.env.EVIOMAIL,
        pass: process.env.EVIOPASSWORD
    }
});


transporter.use('compile', inlineBase64({ cidPrefix: 'somePrefix_' }));

const splitList = ((list) => {
    let size = 1;
    let arrayOfArrays = [];

    for (let i = 0; i < list.length; i += size) {
        arrayOfArrays.push(list.slice(i, i + size));
    }

    return arrayOfArrays;
});

router.post('/api/private/mailNotification', (req, res, next) => {
    var context = "POST /api/private/mailNotification";
    try {

        if (req.body != null) {

            console.log(req.body.chargersList.length + " messages to send.");

            let chargersList = req.body.chargersList;

            chargersList = splitList(chargersList);

            for (let i = 0; i < chargersList.length; i++) {
                setTimeout(function () {

                    let list = chargersList[i];
                    console.log("list", list);

                    setTimeout(function () {
                        list.map(ch => sendOfflineChargerEmail(ch));
                    }, 5000)
                }, i * 5 * 1000);
            }

            return res.status(200).send({ code: 'notification_success', message: "Notification success" });

        } else {
            return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

const getOwnerInfo = ((userId) => {
    return new Promise((resolve, reject) => {

        var headers = {
            userid: userId
        }

        axios.get(userAccountProxy, { headers })
            .then((response) => {
                if (response) {
                    let info = {
                        email: response.data.email,
                        name: response.data.name
                    }
                    resolve(info);
                } else {
                    console.log(response);
                    resolve(false);
                }
            })
            .catch((error) => {
                console.log("[Error] " + error.message);
                resolve(false);
            });

    });
});

const getMailingList = ((clientName) => {
    return new Promise((resolve, reject) => {


        let headers = {
            clientname: clientName
        };

        axios.get(notificationsProxy, { headers })
            .then((notificationsConfig) => {

                if (notificationsConfig) {
                    let result = notificationsConfig.data;

                    if (result) {
                        if (result.mailList.length > 0) {
                            resolve(result.mailList);
                        } else {
                            resolve([]);
                        }
                    }
                    else {
                        resolve([]);
                    }
                }
                else {
                    resolve([]);
                }

            }).catch((error) => {
                if (error.response) {
                    console.log(`[getMailList][400] Error `, error.response.data);
                }
                else {
                    console.log(`[getMailList][500] Error `, error.message);
                };
                resolve([]);
            });

    });
});

function sendOfflineChargerEmail(charger) {
    var context = "Function sendOfflineChargerEmail";
    return new Promise((resolve, reject) => {

        console.log("sendOfflineChargerEmail", charger);
        let promises = [];
        let createUser = charger.createUser;

        getOwnerInfo(createUser)
            .then((info) => {
                if (charger.offlineEmailNotification) {

                    console.log("info - ", info)
                    let sendList = [];
                    let email;
                    if (charger.offlineEmailNotification === undefined || charger.offlineEmailNotification === "")
                        email = info.email;
                    else
                        email = charger.offlineEmailNotification;


                    let name = info.name;

                    console.log("email - ", email)
                    sendList = email.split(";");
                    console.log("sendList - ", sendList)

                    getMailingList(charger.clientName)
                        .then((mailList) => {

                            console.log("mailList - ", mailList)
                            sendList = sendList.concat(mailList);
                            console.log("sendList 2 - ", sendList)


                            let sendListUnique = sendList.filter(function (item, pos, self) {
                                return self.indexOf(item) == pos;
                            });

                            for (let i = 0; i < sendListUnique.length; i++) {

                                setTimeout(function () {
                                    let mail = sendListUnique[i];

                                    promises.push(new Promise(function (resolve, reject) {

                                        let host;
                                        if (charger.clientName === undefined || charger.clientName === process.env.clientNameEVIO) {
                                            host = process.env.HostNotifications + process.env.PathSendEmail;
                                        }
                                        else {
                                            //WL notification
                                            host = process.env.HostNotifications + process.env.PathSendEmailWL;
                                        }

                                        let mailOptions = {
                                            to: mail,
                                            message: {
                                                username: name,
                                                hwId: charger.hwId,
                                                lastDate: formatDateToPrint(charger.lastHeartBeat)
                                            },
                                            type: "offlineCharger"
                                        }

                                        let headers = {
                                            clientname: charger.clientName
                                        }

                                        axios.post(host, { mailOptions }, { headers })
                                            .then(() => {
                                                console.log('Email sent: ' + sendListUnique[i]);
                                                if (i == 0) {
                                                    let data = {
                                                        hwId: charger.hwId,
                                                        userId: charger.createUser,
                                                        lastHeartBeat: charger.lastHeartBeat,
                                                        status: '200',
                                                        to: sendListUnique
                                                    }
                                                    createMailNotification(data);
                                                }
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.log(error.message);
                                                if (i == 0) {
                                                    let data = {
                                                        hwId: charger.hwId,
                                                        userId: charger.createUser,
                                                        lastHeartBeat: charger.lastHeartBeat,
                                                        status: '400',
                                                        to: sendListUnique
                                                    }
                                                    createMailNotification(data);
                                                }
                                                resolve(false);
                                            });

                                    }));

                                }, i * 2 * 1000);
                            }

                            Promise.all(promises).then(() => {
                                resolve(true);
                            });

                        })
                        .catch((error) => {
                            console.log(`[${context}][findOne] Error `, error.message);
                            reject(error);
                        })

                }
                else {
                    console.log("Email not found for " + charger.hwId);
                }
            });

    });

};

const createMailNotification = ((notificationInfo) => {
    return new Promise((resolve, reject) => {
        const new_mailNotification = new MailNotification(notificationInfo);
        MailNotification.createMailNotification(new_mailNotification, (err, result) => {
            if (result) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });

});

router.post('/api/private/chargerNotification', (req, res, next) => {
    var context = "POST /api/private/chargerNotification";
    try {

        if (req.body != null) {

            let hwId = req.body.data.hwId;
            let time_interval = req.body.data.interval;
            let lastHeartBeat = req.body.data.lastHeartBeat;

            let lastUpdateDate = moment.utc();
            lastUpdateDate = lastUpdateDate.subtract(time_interval, 'minutes').format();

            let query = {
                sentDate: {
                    $gte: lastUpdateDate
                },
                hwId: hwId
            }

            MailNotification.find(query, (err, notifications) => {
                if (err) {
                    return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
                }
                else {
                    if (notifications.length == 0) {
                        return res.status(200).send({ code: 'send_email' });
                    }
                    else {

                        for (let i = 0; i < notifications.length; i++) {
                            let notification = notifications[i];

                            let lastHeartBeatDate = new Date(lastHeartBeat);
                            lastHeartBeatDate = moment(lastHeartBeatDate).format();

                            let lastHeartbeatDateNotification = new Date(notification.lastHeartBeat);
                            lastHeartbeatDateNotification = moment(lastHeartbeatDateNotification).format();

                            if (lastHeartBeatDate === lastHeartbeatDateNotification) {
                                return res.status(200).send({ code: 'not_send_email' });
                            }

                            if (i == notifications.length - 1) {
                                return res.status(200).send({ code: 'send_email' });
                            }
                        }

                    }
                }
            })

        } else {
            return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/mailNotification/recoverPassword', (req, res, next) => {
    var context = "POST /api/private/mailNotification/recoverPassword";
    try {

        var email = req.body.email;

        //EVIO\nYour recover code is:

        var mailOptions = {
            source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
            from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
            to: email,
            subject: 'EVIO - Recover password',
            text: 'Validate Email', // plaintext body
            html: '<h1>EVIO</h1>' + '<h3>Recover password</h3>' +
                '<p>Your recover code is: <b>' + req.body.message + '</b> </p>'
        };

        transporter.verify(function (error, success) {
            if (error) {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            } else {

                console.log("Server is ready to take our messages");

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log(`[${context}] Error `, error.message);

                        let history = {
                            isToSend: false,
                            sent: false,
                            mailOptions: mailOptions,
                            status: '500',
                            clientName: process.env.clientNameEVIO
                        }
                        Utils.sendFailedEmailToSentry(history, error);

                        return res.status(500).send(error.message);
                    } else {
                        let history = {
                            isToSend: false,
                            sent: true,
                            mailOptions: mailOptions,
                            status: '200',
                            clientName: process.env.clientNameEVIO
                        }

                        return res.status(200).send(true);
                    }
                });
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/mailNotification/changeEmail', (req, res, next) => {
    var context = "POST /api/private/mailNotification/changeEmail";
    try {

        var email = req.body.email;

        //EVIO\nYour recover code is:

        var mailOptions = {
            source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
            from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
            to: email,
            subject: 'EVIO - Change Email',
            text: 'Validate Email', // plaintext body
            html: '<h1>EVIO</h1>' + '<h3>change email</h3>' +
                '<p>Your recover code is: <b>' + req.body.message + '</b> </p>'
        };

        transporter.verify(function (error, success) {
            if (error) {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            } else {

                console.log("Server is ready to take our messages");

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log(`[${context}] Error `, error.message);

                        let history = {
                            isToSend: false,
                            sent: false,
                            mailOptions: mailOptions,
                            status: '500',
                            clientName: process.env.clientNameEVIO
                        }
                        Utils.sendFailedEmailToSentry(history, error);

                        return res.status(500).send(error.message);
                    } else {
                        let history = {
                            isToSend: false,
                            sent: true,
                            mailOptions: mailOptions,
                            status: '200',
                            clientName: process.env.clientNameEVIO
                        }

                        return res.status(200).send(true);
                    }
                });
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/sendEmail', async (req, res, next) => {
    const context = "POST /api/private/sendEmail";
    try {

        let clientName = req.headers['clientname'];

        console.log(`[${context}] Handling email for clientName (${clientName})`);
        console.info(`[${context}] Request body:`, req.body); 
        
        if (clientName === undefined || clientName === process.env.clientNameEVIO) {
            //EVIO email

            if (req.body != null) {

                if (!req.body.mailOptions) {
                    console.warn(`[${context}] Mail options data require`);

                    return res.status(400).send({ auth: false, code: 'server_mailOptions_require', message: "Mail options data require" });
                }

                if (!req.body.mailOptions.to && !req.body.mailOptions.cc) {
                    console.warn(`[${context}] Mail to or cc require`);

                    return res.status(400).send({ auth: false, code: 'server_to_require', message: "Mail to require" });
                }

                if (!req.body.mailOptions.message) {
                    console.warn(`[${context}] Message data require`);

                    return res.status(400).send({ auth: false, code: 'server_message_require', message: "Message data require" });
                }

                if (!req.body.mailOptions.type) {
                    console.warn(`[${context}] Type data require`);

                    return res.status(400).send({ auth: false, code: 'server_type_require', message: "Type data require" });
                }

                let notificationBody = JSON.stringify(req.body);
                let mail = req.body.mailOptions;
                let emailSubject;

                const templatesPath = path.resolve(__dirname, "../emailTemplates")
                const template = mail?.emailTemplate ?? mail.type;

                const imgDirectory = templatesPath + `/${template}` + '/img';

                if (mail.type === "globalNotification") {
                    // Add environment to email subject
                    emailSubject = addEnvironmentToSubject(mail.message.emailSubject)
                } else {

                    //console.log("mail", mail);

                    let emailLanguage = mail.to;
                    if (DeleteAccountEmailTypes.includes(mail.type)) {
                        emailLanguage = mail.message.userEmail;
                    } else if (mail?.userEmail) {
                        emailLanguage = mail.userEmail
                    }

                    // This function gets all translation keys according to the user language ans checks if the mail is for suport EVIO or a current user
                    let { translations, isSupportEVIO, language } = await getTranslationsAccordingToUser(emailLanguage, clientName, mail.mailLanguage)

                    // Query the keys according to mail.type for the emails
                    emailSubject = translations.filter(translation => translation.key === `email_${mail.type}_subject` || translation.key === `shared_email_${mail.type}_subject`)[0].value
                    let emailTitle = translations.filter(translation => translation.key === `email_${mail.type}_title` || translation.key === `shared_email_${mail.type}_title`)[0].value
                    let emailHeader  
                    const headerKey = getEmailHeaderKey(mail.type);
                    emailHeader = translations.find(translation => translation.key === headerKey)?.value;

                    let emailBody = translations.filter(translation => translation.key === `email_${mail.type}_body` || translation.key === `shared_email_${mail.type}_body`)[0].value
                    let emailFooter = translations.filter(translation => translation.key === `email_footer`)[0].value
                    let emailAfterFooter = translations.filter(translation => translation.key === `email_after_footer`)[0].value
                    let emailCancelSubscription = translations.filter(translation => translation.key === `email_cancel_subscription`)[0].value
                    let linkText = mail.message?.linkUrl ? translations.filter(translation => translation.key === `email_${mail.type}_link_text`) : null;
                    
                    //Replacing the strings with the values from mail.message
                    emailSubject = replaceAll(emailSubject, mail.message)
                    emailTitle = replaceAll(emailTitle, mail.message)
                    emailHeader = replaceAll(emailHeader, mail.message)
                    emailBody = replaceAll(emailBody, mail.message)

                    if (mail.type === 'account_deletion_refund_finance') {
                        const confirmClearenceBalance = await createBalanceClearanceLink(mail);
                        mail.message["confirmClearenceBalance"] = confirmClearenceBalance
                        mail.message["transactionRows"] = generateTableRefundDeleteAccount(mail.message.paymentMethod);
                    }

                    if (mail.type === 'account_deletion_wallet_clearance_finance') {
                        emailBody = await generateConfirmDeleteAccountFinance(emailBody, mail.message.walletsData, language);
                        emailHeader = '';
                        emailFooter = '';
                    }
                    emailCancelSubscription = replaceAll(emailCancelSubscription, { contactEmail: Constants.company.evio.contactEmail })

                    // if the email is for us (support evio) the subject is set on the body of the request
                    if (isSupportEVIO && mail.subject) {
                        emailSubject = mail.subject
                    }

                    if (mail.type === "requestCardEvio") {

                        emailSubject = mail.subject
                    }

                    // Add environment to email subject
                    emailSubject = addEnvironmentToSubject(emailSubject)

                    console.log("emailSubject", emailSubject);

                    // Add translation keys values to template

                    mail.message["emailTitle"] = emailTitle
                    mail.message["emailHeader"] = emailHeader
                    mail.message["emailBody"] = emailBody
                    mail.message["emailFooter"] = emailFooter
                    mail.message["contactEmail"] = Constants.company.evio.contactEmail
                    mail.message["emailAfterFooter"] = emailAfterFooter
                    mail.message["emailCancelSubscription"] = emailCancelSubscription
                    mail.message["linkText"] = linkText && linkText.length > 0 ? linkText[0].value : null

                    if (mail.type === "sendCardB2C") {
                        let message_step1 = translations.filter(translation => translation.key === `email_${mail.type}_step1`)[0].value;
                        let message_step2 = translations.filter(translation => translation.key === `email_${mail.type}_step2`)[0].value;
                        let message_step3 = translations.filter(translation => translation.key === `email_${mail.type}_step3`)[0].value;
                        let message_step4 = translations.filter(translation => translation.key === `email_${mail.type}_step4`)[0].value;
                        let message_step5 = translations.filter(translation => translation.key === `email_${mail.type}_step5`)[0].value;

                        mail.message["message_step1"] = message_step1;
                        mail.message["message_step2"] = message_step2;
                        mail.message["message_step3"] = message_step3;
                        mail.message["message_step4"] = message_step4;
                        mail.message["message_step5"] = message_step5;
                    }

                    if (mail.type === "sendCardB2B") {
                        let message_step1 = translations.filter(translation => translation.key === `email_${mail.type}_step1`)[0].value;
                        let message_step2 = translations.filter(translation => translation.key === `email_${mail.type}_step2`)[0].value;
                        let message_step3 = translations.filter(translation => translation.key === `email_${mail.type}_step3`)[0].value;
                        let message_step4 = translations.filter(translation => translation.key === `email_${mail.type}_step4`)[0].value;

                        mail.message["message_step1"] = message_step1;
                        mail.message["message_step2"] = message_step2;
                        mail.message["message_step3"] = message_step3;
                        mail.message["message_step4"] = message_step4;
                    }

                    const supportEmail = translations.filter(translation => translation.key === `email_support`)
                    mail.message[`email_support`] = supportEmail.length > 0 ? supportEmail[0]?.value : Constants.company.evio?.contactEmail
                    const supportNumber = translations.filter(translation => translation.key === `number_support`)
                    console.log("supportNumber ", supportNumber)
                    mail.message[`number_support`] = supportNumber.length > 0 ? supportNumber[0].value : Constants.company.evio?.numberSupport
                    const footerDownloadApps = translations.filter(translation => translation.key === `footer_download_apps`)
                    mail.message[`footer_download_apps`] = footerDownloadApps.length > 0 ? footerDownloadApps[0]?.value : Constants.company.evio?.numberSupport
                    mail.message["appleStoreLink"] = Constants.company.evio?.appleStoreLink || Constants.company.evio.appleStoreLink
                    mail.message["playStoreLink"] = Constants.company.evio?.playStoreLink || Constants.company.evio.playStoreLink
                    mail.message[`facebook_link`] = translations.filter(translation => translation.key === `facebook_link`)[0]?.value || null;
                    mail.message[`twitter_link`] = translations.filter(translation => translation.key === `twitter_link`)[0]?.value || null;

                    mail.message["contactWebsite"] = Constants.company.evio?.contactWebsite


                    if (['account_deletion_request', 'account_deletion_request_support', 'revert_deletion_account', 'account_deletion_refund_finance', 'account_deletion_refund_customer', 'account_deletion_reminder'].includes(mail.type)) {
                        mail.message[`footer_Newsletter_Unsubscribe1`] = translations.filter(translation => translation.key === `footer_Newsletter_Unsubscribe1`)[0].value
                        mail.message[`footer_Newsletter_Unsubscribe2`] = translations.filter(translation => translation.key === `footer_Newsletter_Unsubscribe2`)[0].value
                    }
                }

                // Add hyperlinks to template
                mail.message["appleStoreLink"] = process.env.appleStoreLink
                mail.message["playStoreLink"] = process.env.playStoreLink
                mail.message["evioWebsite"] = process.env.evioWebsite

                // This function reads our HTML template file according to its email type ( contract , session, etc.)
                readHTMLFile(templatesPath + `/${template}` + '/index.html')
                    .then(async html => {

                        // The images in the email HTML are being sent as base64 strings.
                        // I found this approach better than sending them as attachments since it wasn't even working with Gmail
                        let filenames = fs.readdirSync(imgDirectory);
                        filenames.forEach((file) => {
                            const contents = fs.readFileSync(imgDirectory + `/${file}`, { encoding: 'base64' });
                            let base64name = file.split('.')[0]
                            mail.message[base64name] = contents
                        });

                        // In order to replace our HTML with values we use the handlebars library and pass it as argument the mail.message
                        const template = handlebars.compile(html);
                        var htmlToSend = template(mail.message);

                        var mailOptions = {
                            source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
                            from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
                            to: mail.to,
                            cc: mail.cc,
                            subject: emailSubject,
                            html: htmlToSend,
                        };

                        if (mail.type === "contract" || mail.type === "scheduledContract") {
                            let contractInfo = req.body.contract;
                            if (contractInfo) {
                                mailOptions = await addAttachmentsToContractEmail(mailOptions, contractInfo);
                            }
                        }

                        if (mail.type === "contractb2b" || mail.type === "scheduledContractb2b") {
                            mailOptions = await addAttachmentsToContractB2BEmail(mailOptions);
                        }

                        transporter.verify(function (error, success) {
                            if (error) {
                                console.log(`[${context}][transporter.verify] Error `, error.message);

                                let history = {
                                    isToSend: true,
                                    sent: false,
                                    requestBody: JSON.parse(notificationBody),
                                    status: '500',
                                    clientName: process.env.clientNameEVIO
                                }
                                Utils.sendFailedEmailToSentry(history, error);

                                return res.status(500).send(error.message);
                            } else {
                                console.log("Server is ready to take our messages");

                                transporter.sendMail(mailOptions, async (error, info) => {
                                    if (error) {
                                        console.log('Email failed: ' + error.message);

                                        let history = {
                                            isToSend: true,
                                            sent: false,
                                            requestBody: JSON.parse(notificationBody),
                                            status: '400',
                                            clientName: process.env.clientNameEVIO
                                        }
                                        Utils.sendFailedEmailToSentry(history, error);

                                        return res.status(400).send({ code: 'send_email_failed', message: "Send email error" });
                                    }   
                                    else {
                                        console.log('Email sent: ' + info.response);

                                        let history = {
                                            isToSend: false,
                                            sent: true,
                                            requestBody: JSON.parse(notificationBody),
                                            status: '200',
                                            clientName: process.env.clientNameEVIO
                                        }

                                        if (mail.type === "contractb2b" || mail.type === "scheduledContractb2b") {
                                            let contractInfo = req.body.contract;
                                            if (contractInfo) {
                                                await notifyEVIOnewParticularConditionsToSend(contractInfo);
                                                console.log("Email enviado para o suporte com sucesso");
                                            }
                                            else {
                                                console.log("Não foi possível notificar o suporte de um contrato ");
                                            }
                                        }

                                        return res.status(200).send({ code: 'send_email_success', message: "Email sent" });
                                    }
                                });
                            }
                        });

                    })
                    .catch(error => {
                        Sentry.captureException(error);
                        console.log(`[${context}] Error `, error);

                        return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
                    });

            } else {
                return res.status(400).send({ code: 'mail_notification_error', message: "Mail notification error" });
            }

        } else {
            //Send to WL to process email
            var host = process.env.HostNotifications + process.env.PathSendEmailWL;

            axios.post(host, req.body, { headers: req.headers })
                .then((result) => {
                    return res.status(200).send(result.data);
                })
                .catch((error) => {
                    Sentry.captureException(error);
                    if (error.response) {
                        console.error(`[${context}][WL][.catch] Error`, error.response.data);
                        return res.status(400).send(error);
                    }
                    else {
                        console.error(`[${context}][WL][.catch] Error`, error.message);
                        return res.status(400).send(error.message);
                    }
                });

        }

    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);

        return res.status(500).send(error.message);
    }
});

function generateConfirmDeleteAccountFinance(htmlContent, walletsData, language) {
    walletsData.forEach(wallet => {
      htmlContent += `
        <tr style="border: 1px solid #dddddd;">
          <td style="padding: 8px;">${wallet.walletId}</td>
          <td style="padding: 8px;">${wallet.userId}</td>
          <td style="padding: 8px;">${wallet.previousBalance}</td>
          <td style="padding: 8px;">${new Date(wallet.clearenceDate).toLocaleString()}</td>
        </tr>
      `;
    });

    if (language === 'en') {
      htmlContent += `
          </tbody>
        </table><br>
        Please review these updates for accuracy. For any issues or additional information, contact the support team or refer to the system logs.<br><br>
        Thank you for your attention.
      `;
    } else {
      htmlContent += `
          </tbody>
        </table><br>
        Por favor, revejam estas atualizações para garantir a sua precisão. Em caso de dúvidas ou necessidade de mais informações, entrem em contacto com a equipa de suporte ou consultem os registos do sistema.<br><br>
        Obrigado pela vossa atenção.
      `;
    }
  
    return htmlContent;
}

function generateTableRefundDeleteAccount(transactions) {
    return transactions.map(({ amount, transactionId, provider }) => `
      <tr style="border: 1px solid #dddddd;">
        <td style="padding: 8px;">${amount}</td>
        <td style="padding: 8px;">${transactionId}</td>
        <td style="padding: 8px;">${provider}</td>
      </tr>
    `).join('');
}


const createBalanceClearanceLink = async (mail) => {
    let confirmClearenceBalance;
    const apiUrl = Constants.apiUrls[Constants.environment] || Constants.apiUrls.local;
    confirmClearenceBalance = `${apiUrl}/api/public/wallet/enableBalanceClearance?user=${mail.message.userId}`;
    return confirmClearenceBalance;
};

const readHTMLFile = function (path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, { encoding: 'utf-8' }, function (err, html) {
            if (err) {
                reject(err);
            }
            else {
                resolve(html);
            }
        });

    });
};

function formatDateToPrint(timestamp) {

    let format = timestamp.split("T");
    let date = format[0];
    let time = format[1].split(".");

    return date + ' à ' + time[0];
}

function addEnvironmentToSubject(subject) {
    let environment = "";
    let position = 0;

    if (process.env.NODE_ENV === 'pre-production') {
        environment = ' [QA]'
    } else if (process.env.NODE_ENV === 'development') {
        environment = ' [DEV]'
    }
    return [subject.slice(0, position), environment, subject.slice(position)].join('');
}

function addAttachmentsToContractEmail(mailOptions, contractInfo) {
    return new Promise((resolve, reject) => {

        const pdfGeralPath = path.resolve(__dirname, "../assets")

        fs.readFile(pdfGeralPath + '/evio_geral.pdf', (err, pdfBuffer) => {
            if (err) {
                console.log(err);
                reject();
            }

            if (pdfBuffer) {

                let attachments = [
                    {
                        filename: "EVIO Condições Gerais CEME" + '.pdf',
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                        encoding: 'base64'
                    }
                ];

                ParticularContract.createParticularContract(contractInfo)
                    .then((particularContractBuffer) => {

                        attachments.push(
                            {
                                filename: "EVIO Condições Particulares CEME" + '.pdf',
                                content: particularContractBuffer,
                                contentType: 'application/pdf',
                                encoding: 'base64'
                            }
                        );

                        mailOptions.attachments = attachments;
                        resolve(mailOptions);

                    })
                    .catch((error) => {
                        console.log("Failed to create particular contract");
                        mailOptions.attachments = attachments;
                        resolve(mailOptions);
                    });
            }
            else {
                resolve(mailOptions);
            }

        });

    });
}

function addAttachmentsToContractB2BEmail(mailOptions) {
    return new Promise((resolve, reject) => {

        const pdfGeralPath = path.resolve(__dirname, "../assets")

        fs.readFile(pdfGeralPath + '/evio_geral.pdf', (err, pdfBuffer) => {
            if (err) {
                console.log(err);
                reject();
            }

            if (pdfBuffer) {

                let attachments = [
                    {
                        filename: "EVIO Condições Gerais CEME" + '.pdf',
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                        encoding: 'base64'
                    }
                ];

                mailOptions.attachments = attachments;
                resolve(mailOptions);

            }
            else {
                resolve(mailOptions);
            }

        });

    });
}

function notifyEVIOnewParticularConditionsToSend(contractInfo) {
    return new Promise((resolve, reject) => {

        let email;
        if (process.env.NODE_ENV === 'production' /*|| process.env.NODE_ENV === 'pre-production'*/) {
            email = process.env.EMAIL1
        }
        else {
            email = process.env.EMAIL2
        };

        var mailOptions = {
            source: '"EVIO support" <' + process.env.EVIOMAIL + '>',
            from: '"EVIO support" <' + process.env.EVIOMAIL + '>', // sender address
            to: email,
            subject: "EVIO - Adesão CEME B2B Condições Particulares",
            html: `<body>
            <b> Necessário enviar as Condições Particulares para o seguinte contrato: </b>
            <br> <br> <b> contractId: </b> ${contractInfo._id}
            <br> <b> name: </b> ${contractInfo.name} 
            <br> <b> email: </b> ${contractInfo.email} 
            <br> <b> contract_id: </b> ${contractInfo.contract_id} 
            </body>`
        };

        transporter.verify(function (error, success) {
            if (error) {
                console.log(`[${context}] Error `, error.message);

                let history = {
                    isToSend: true,
                    sent: false,
                    mailOptions: mailOptions,
                    status: '500',
                    clientName: process.env.clientNameEVIO
                }
                Utils.sendFailedEmailToSentry(history, error);

                reject();

            } else {
                console.log("Server is ready to take our messages");

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log('Email failed: ' + error.message);

                        let history = {
                            isToSend: true,
                            sent: false,
                            mailOptions: mailOptions,
                            status: '400',
                            clientName: process.env.clientNameEVIO
                        }
                        Utils.sendFailedEmailToSentry(history, error);

                        reject();
                    }
                    else {
                        console.log('Email sent: ' + info.response);

                        let history = {
                            isToSend: false,
                            sent: true,
                            mailOptions: mailOptions,
                            status: '200',
                            clientName: process.env.clientNameEVIO
                        }

                        resolve();
                    }
                });
            }
        });

    });

}

module.exports = router;

