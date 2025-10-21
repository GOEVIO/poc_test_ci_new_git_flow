const PasswordRecovery = require('../models/password_recovery');
const User = require('../models/user');
const ExternalRequestsHandler = require('./externalRequests');
const jwt = require('jsonwebtoken');
const AxiosHandler = require("../services/axios");
const Constants = require('../utils/constants');
const { BadRequest, errorResponse, ServerError } = require('../utils');
const { statusEnum } = require('../utils/enums/users');
const UserPasswords = require("../models/userPasswords");
const Sentry = require("@sentry/node");
const { logger, default: constants } = Constants;

module.exports = {
    recoverPasswordWlLoginMobileRequest: (req) => {
        const context = "Funciton recoverPasswordWlLoginMobile";
        return new Promise(async (resolve, reject) => {
            try {
                let code = getRandomInt(10000, 100000);
                let headers = req.headers;
                let clientName = headers["clientname"]
                //Generating Token
                const token = jwt.sign({ code }, process.env.token_recovery_secret, { expiresIn: process.env.token_recovery_life });

                //Get user ID by mobile
                let mobile = req.body.mobile;
                let internationalPrefix = req.body.internationalPrefix;

                if (!req.body.mobile) {
                    reject({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });
                };

                let userId;

                let query = {
                    mobile: mobile,
                    internationalPrefix: internationalPrefix,
                    clientName: clientName
                };

                let user = await User.findOne(query);
                if (user) {

                    userId = user._id;
                    PasswordRecovery.markAsUsedById(userId, function (err, objdeleted) { });

                    let newPasswordRecovery = new PasswordRecovery({
                        userId: userId,
                        code: code,
                        used: false,
                        token: token
                    });

                    PasswordRecovery.createPasswordRecovery(newPasswordRecovery, function (err, recoveryPass) {
                        if (err) {
                            console.log(`[${context}][createPasswordRecovery] Error `, err.message);
                            reject(err);
                        }
                        else {
                            // Created Successfully
                            if (recoveryPass) {
                                //Send email
                                //sendEmail(email, code, res);
                                ExternalRequestsHandler.sendRecoverSMS(user, code, headers)
                                    .then(() => {
                                        cancelFirebaseTokens(userId);
                                        cancelAllTokens(userId);
                                        cancelFirebaseWLTokens(userId);
                                        resolve({ auth: true, code: 'server_sms_sent_success', message: "SMS sent successfully" });
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][sendRecoverSMS][.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else
                                reject({ auth: false, code: 'server_password_not_recovery', message: "Password not recovery" });
                        };
                    });

                }
                else
                    reject({ auth: false, code: 'server_user_not_found_mobile', message: "User not found for given phone number: " + mobile });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        })
    },
    updateRecoverPasswordWlLoginMobile: (req) => {
        const context = "Function recoverPasswordWlLoginMobile";
        return new Promise(async (resolve, reject) => {
            try {

                let headers = req.headers;
                let clientName = headers["clientname"]

                //Get code
                let code = req.body.code;
                let password = req.body.password;
                let internationalPrefix = req.body.internationalPrefix;

                if (!req.body.mobile)
                    reject({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });

                let userId;
                let mobile;
                let query = {
                    mobile: mobile,
                    internationalPrefix: internationalPrefix,
                    clientName: clientName
                };

                console.log(`[${context}] Query for fetch user: `, query);

                let user = await User.findOne(query);

                if (user) {
                    userId = user._id;
                    mobile = user.mobile;

                    //Check If Code Belongs To UserId
                    let query = { code: code, userId: userId };
                    let belongs;
                    try {
                        belongs = await PasswordRecovery.findOne(query);
                    } catch (error) {
                        console.log(`[${context}][Check If Code Belongs To UserId] Error `, error.message);
                        reject(error);
                    };

                    if (belongs) {

                        //Check If Code Was Already Used
                        query = { code: code, used: true };
                        let objUsed;
                        try {
                            objUsed = await PasswordRecovery.findOne(query)
                        } catch (error) {
                            console.log(`[${context}][Check If Code Was Already Used] Error `, error.message);
                            reject(error);
                        };

                        if (objUsed) {
                            reject({ auth: false, code: 'server_code_already_used', message: "Provided code was already used" });
                        } else {

                            //Get Password Recovery By Code
                            query = { code: code };
                            let passwordRecovery;
                            try {
                                passwordRecovery = await PasswordRecovery.findOne(query);
                            } catch (error) {
                                console.log(`[${context}][Get Password Recovery By Code] Error `, error.message);
                                reject(error);
                            };

                            if (passwordRecovery) {

                                //Check token validity
                                let token = passwordRecovery.token;

                                jwt.verify(token, process.env.token_recovery_secret, function (err, decoded) {
                                    if (err) reject({ auth: false, code: 'server_code_expired', message: 'Code expired' });

                                    PasswordRecovery.markAsUsedByCode(code, async (err, result) => {
                                        if (err) {
                                            Sentry.captureException(err);
                                            console.log(`[${context}][markAsUsedByCode] Error `, err.message);
                                            reject(err.message);
                                        }
                                        else {
                                            if (result) {
                                                console.log(`[${context}] Changing password for for userId ${userId} ...`);
                                                await UserPasswords.updatePassword(userId, password);

                                                resolve({ auth: true, code: 'server_password_changed', message: 'Password changed' });
                                            } else {
                                                reject({
                                                    auth: false,
                                                    code: 'server_password_changed_wrong',
                                                    message: 'Password changed but something was wrong'
                                                });
                                            }
                                        }
                                    });

                                });

                            }
                            else
                                reject({ auth: false, code: 'server_invalid_code', message: "Invalid code" });

                        }
                    }
                    else
                        reject({ auth: false, code: 'server_code_dont_belongs_mobile', message: "Provided code don't belogns to provided phone number : " + mobile });

                }
                else {
                    console.log(`[${context}] User not found for given phone number: ${mobile}`);
                    reject({ auth: false, code: 'server_user_not_found_mobile', message: "User not found for given phone number: " + mobile });
                }


            } catch (error) {
                Sentry.captureException(error);
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        })
    },
    changeCompanyPasswordWithCode: async (req, res) => {
        const context = 'Function changeCompanyPasswordWithCode';
        try {
            const { clientname: clientName } = req.headers;
            const { code, email, password } = req.body;

            if (!code) throw BadRequest({ auth: false, code: 'server_code_required', message: 'Code required' });

            if (!email) throw BadRequest({ auth: false, code: 'server_email_required', message: 'Email required' });

            if (!password) throw BadRequest({ auth: false, code: 'server_password_required', message: 'Password required' });

            const query = {
                email: new RegExp(email, 'i'), // DCL - Case-Insensitive Query
                clientName,
                status: statusEnum.registered
            };
            const userFound = await User.findOne(query);

            if (!userFound) throw BadRequest({ auth: false, code: 'server_user_not_found_email', message: `User not found for given email: ${email}` });

            const {
                _id: userId,
                clientType,
            } = userFound;

            if (clientType !== constants.clientTypes.ClientB2B) throw BadRequest({ auth: false, code: 'server_user_not_company', message: 'User is not a company' });

            const codeFound = await PasswordRecovery.getCodeByUser(code, userId);

            if (!codeFound) throw BadRequest({ auth: false, code: 'server_invalid_code', message: 'Invalid code' });

            const { token, used } = codeFound;

            if (used) throw BadRequest({ auth: false, code: 'server_code_already_used', message: 'Provided code was already used' });

            try {
                jwt.verify(token, process.env.token_recovery_secret);
            } catch {
                throw BadRequest({ auth: false, code: 'server_code_expired', message: 'Code expired' });
            }

            try {
                console.log(`[${context}] Changing password for userId ${userId} ...`);
                await UserPasswords.updatePassword(userId, password);

            } catch (error) {
                throw ServerError(error.message);
            }

            const passwordChanged = await PasswordRecovery.markAsUsedById(userId);

            if (!passwordChanged) throw BadRequest({ auth: false, code: 'server_password_changed_wrong', message: 'Password changed but something was wrong' });

            return res.status(200).send({ auth: true, code: 'server_password_changed', message: 'Password changed' });
        } catch (error) {
            errorResponse(res, error, context);
        }
    }
};

//========== FUNCTION ==========
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

function cancelAllTokens(userId) {
    let context = "Function cancelAllTokens";

    let data = {
        userId: userId
    };

    let host = "http://authorization:3001/api/validTokens";

    AxiosHandler.axiosPatchBody(host, data)
        .then(() => {
            console.log("Tokens updated");
        })
        .catch(error => {
            console.log(`[${context}][.catch] Error `, error.message);
        });

};

function cancelFirebaseTokens(userId) {
    let context = "Function cancelFirebaseTokens";

    let data = {
        userId: userId
    };

    //let host = "http://notifications:3008/api/private/firebase/firebaseUserTokens";
    let host = process.env.NotificationsHost + process.env.PathNotificationFirebaseUserTokens;

    AxiosHandler.axiosPatchBody(host, data)
        .then(() => {
            console.log("Tokens firebase updated");
        })
        .catch(error => {
            console.log(`[${context}][.catch] Error `, error.message);
        });

};

function cancelFirebaseWLTokens(userId) {
    let context = "Function cancelFirebaseWLTokens";

    let data = {
        userId: userId
    };

    //let host = "http://notifications-firebase-wl:3032/api/private/firebase/firebaseUserTokens";
    let host = process.env.NotificationsFirebaseWLHost + process.env.PathNotificationFirebaseUserTokens;

    AxiosHandler.axiosPatchBody(host, data)
        .then(() => {
            console.log("Tokens firebase WL updated");
        })
        .catch(error => {
            console.log(`[${context}][.catch] Error `, error.message);
        });

};