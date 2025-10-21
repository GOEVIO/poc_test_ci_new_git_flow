const ExternalRequestHandler = require('./externalRequestHandler');
const axios = require("axios");
const EVIOIssues = require('../models/evioIssues');
const HostIssues = require('../models/hostIssues');
const WhiteLabelMapping = require('../utils/whiteLabelMapping.json');

module.exports = {

    sendEmail: (action, body) => {
        const context = "Funciton sendEmail";
        switch (action) {
            case process.env.IssueTypeHost:
                sendEmailToSupportAndChargerOwner(body);
                break;
            case process.env.IssueTypeEVIO:
                sendEmailToSupport(body);
                break;
            default:
                break;
        };

    }
}

async function sendEmailToSupportAndChargerOwner(body) {
    const context = "Funciton sendEmailToSupportAndChargerOwner";

    try {

        let email;
        let emailTo;
        //if (process.env.NODE_ENV === 'production') { //
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'pre-production') {
            email = process.env.EMAIL2
        } else {

            switch (body.clientName) {
                case process.env.WhiteLabelGoCharge:
                    // if (process.env.ListChargersTypeGoCharge.includes(body.chargerType))
                    email = process.env.EMAILGOCCHARGE
                    /*else
                        email = process.env.EMAILEVIO*/
                    break;
                case process.env.WhiteLabelHyundai:
                    //if (process.env.ListChargersTypeGoCharge.includes(body.chargerType))
                    email = process.env.EMAILHYUNDAI
                    /*else
                         email = process.env.EMAILEVIO*/
                    break;
                case process.env.WhiteLabelACP:
                    email = process.env.EMAILACP
                    break;
                case process.env.WhiteLabelKLC:
                    email = process.env.EMAILEVIO
                    break;
                case process.env.WhiteLabelKinto:
                    email = process.env.EMAILEVIO
                    break;
                default:
                    email = process.env.EMAILEVIO
                    break;
            }

        };

        let headers = {
            clientname: body.clientName
        };


        let queryQuestion;

        if (body.reasonCode === "other" || body.reasonCode.includes("_")) {
            queryQuestion = { questionCode: body.reasonCode }
        } else {
            queryQuestion = { _id: body.reasonCode }
        }
        let charger = await ExternalRequestHandler.getCharger({ _id: body.chargerId, hwId: body.hwId });
        let chargerOwner = await ExternalRequestHandler.getUser({ userid: body.hostId });
        let user = await ExternalRequestHandler.getUser({ userid: body.issuedUserId });
        let question = await ExternalRequestHandler.getQuestion(queryQuestion);
        let translation = await ExternalRequestHandler.getTranslation({ languageCode: chargerOwner.language });

        let operatorName = chargerOwner.name
        let operatorEmail = chargerOwner.email
        let operatorMobile = chargerOwner.mobile

        if (charger.offlineEmailNotification) {
            // emailTo = `${charger.offlineEmailNotification},${chargerOwner.email},${email}`
            emailTo = `${charger.offlineEmailNotification},${email}`

        } else {
            emailTo = `${chargerOwner.email},${email}`
        };

        let host = process.env.HostNotifications + process.env.PathSendEmail;

        let key;
        if (question.questionCode === 'other') {

            key = {
                value: body.reasonText
            };

        } else {

            key = translation.translations.find(translation => {
                return translation.key === question.questionCode;
            });

        };

        let mailOptions = {
            to: emailTo,
            mailLanguage: chargerOwner.language,
            message: {
                hwId: charger.hwId,
                userName: user.name,
                username: chargerOwner.name,
                message: key.value,
                email: user.email,
                mobile: user.mobile,
                operatorName,
                operatorMobile,
                operatorEmail
            },
            type: "supportChargerIssues"
        };

        console.log("mailOptions", mailOptions)

        let response = await axios.post(host, { mailOptions }, { headers })

        if (response.data) {
            let issueUpdated = await HostIssues.findOneAndUpdate({ _id: body._id }, { $set: { emailSent: true } }, { new: true });
            console.log('Email sent');
        } else {
            console.error(`[${context}] Error: Email sending failed`);
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

async function sendEmailToSupport(body) {
    const context = "Funciton sendEmailToSupport";

    try {

        let email;
        if (process.env.NODE_ENV === 'production') {
            //if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'pre-production') {

            switch (body.clientName) {
                case process.env.WhiteLabelGoCharge:
                    email = process.env.EMAILGOCCHARGE
                    break;
                case process.env.WhiteLabelHyundai:
                    email = process.env.EMAILHYUNDAI
                    break;
                case process.env.WhiteLabelACP:
                    email = process.env.EMAILACP
                    break;
                case process.env.WhiteLabelKLC:
                    email = process.env.EMAILEVIO
                    break;
                case process.env.WhiteLabelKinto:
                    email = process.env.EMAILEVIO
                    break;
                default:
                    email = process.env.EMAILEVIO
                    break;
            }

        } else {
            email = process.env.EMAIL2
        }

        let queryQuestion;

        if (body.reasonCode === "other" || body.reasonCode.includes("_")) {
            queryQuestion = { questionCode: body.reasonCode }
        } else {
            queryQuestion = { _id: body.reasonCode }
        }

        let operatorName;
        let operatorEmail;
        let operatorMobile;
        let charger = await ExternalRequestHandler.getCharger({ _id: body.chargerId, hwId: body.hwId });

        if (!charger) {
            charger = await ExternalRequestHandler.getChargerPublic({ _id: body.chargerId, hwId: body.hwId });
            operatorName = charger.operator
            operatorEmail = charger.operatorEmail
            operatorMobile = charger.operatorContact
        } else {
            let chargerOwner = await ExternalRequestHandler.getUser({ userid: charger.createUser });
            
            operatorName = chargerOwner.name
            operatorEmail = chargerOwner.email
            operatorMobile = chargerOwner.mobile
        }

        let user = await ExternalRequestHandler.getUser({ userid: body.issuedUserId });
        let question = await ExternalRequestHandler.getQuestion(queryQuestion);
        let translation = await ExternalRequestHandler.getTranslation({ languageCode: 'pt' });

        let headers = {
            clientname: body.clientName
        };

        let host = process.env.HostNotifications + process.env.PathSendEmail;


        //Sconsole.log("translation", translation);

        let key = {};

        if (body.reasonCode === "other") {
            key.value = body.reasonText
        } else {
            key = translation.translations.find(translation => {
                return translation.key === question.questionCode;
            });
        }

        let mailOptions = {
            to: email,
            message: {
                hwId: body.hwId,
                userName: user.name,
                username: WhiteLabelMapping[body.clientName],
                message: key.value,
                email: user.email,
                mobile: user.mobile,
                operatorName,
                operatorMobile,
                operatorEmail
            },
            type: "supportChargerIssues"
        };

        let response = await axios.post(host, { mailOptions }, { headers })

        if (response.data) {

            let issueUpdated = await EVIOIssues.findOneAndUpdate({ _id: body._id }, { $set: { emailSent: true } }, { new: true });
            console.log('Email sent');
        } else {
            console.error(`[${context}] Error: Email sending failed`);
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};
