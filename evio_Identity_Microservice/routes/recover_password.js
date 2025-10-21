require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const PasswordRecovery = require('../models/password_recovery');
const PasswordRecoveryController = require('../controllers/recover_password');
const ErrorHandler = require('../controllers/errorHandler');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Sentry = require('@sentry/node');
const nodemailer = require('nodemailer');
const axios = require("axios");
const user = require('../models/user');
const { logger } = require('../utils/constants');
const { statusEnum } = require('../utils/enums/users');
const UserPasswords = require("../models/userPasswords");

//========== POST ==========
//Create Password Recovery
router.post('/api/recover_password', (req, res, next) => {
    var context = "POST /api/recover_password";
    try {
        //Generating code
        var code = getRandomInt(10000, 100000);
        var headers = req.headers;
        var clientName = headers["clientname"]
        //Generating Token
        const token = jwt.sign({ code }, process.env.token_recovery_secret, { expiresIn: process.env.token_recovery_life });

        //Get user ID by email
        //var email = req.body.email;

        console.log("clientName", clientName);

        if (clientName === "EVIO") {
            //Get user ID by mobile
            var mobile = req.body.mobile;
            var internationalPrefix = req.body.internationalPrefix;

            if (!req.body.mobile) {
                return res.status(400).send({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });
            };

            var userId;

            var query = {
                mobile: mobile,
                internationalPrefix: internationalPrefix,
                clientName: clientName,
                status: statusEnum.registered
            };
            User.findOne(query, function (err, user) {
                if (err) {
                    Sentry.captureException(err);
                    console.error(`[${context}][getUserByMobile] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (user) {
                        userId = user._id;

                        //Check if has any active code of this email and update them
                        PasswordRecovery.markAsUsedById(userId, function (err, objdeleted) { });

                        //Insert data on recovery password table
                        var newPasswordRecovery = new PasswordRecovery({
                            userId: userId,
                            code: code,
                            used: false,
                            token: token
                        });

                        PasswordRecovery.createPasswordRecovery(newPasswordRecovery, function (err, recoveryPass) {
                            if (err) {
                                Sentry.captureException(err);
                                console.error(`[${context}][createPasswordRecovery] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                // Created Successfully
                                if (recoveryPass) {
                                    //Send email
                                    //sendEmail(email, code, res);
                                    sendRecoverSMS(user, code, headers)
                                        .then(() => {
                                            cancelFirebaseTokens(userId);
                                            cancelAllTokens(userId);
                                            return res.status(200).send({ auth: true, code: 'server_sms_sent_success', message: "SMS sent successfully" });
                                        })
                                        .catch((error) => {
                                            Sentry.captureException(error);
                                            console.error(`[${context}][sendRecoverSMS][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                }
                                else
                                    return res.status(400).send({ auth: false, code: 'server_password_not_recovery', message: "Password not recovery" });
                            };
                        });
                    }
                    else
                        return res.status(200).send({ auth: true, code: 'server_sms_sent_success', message: "SMS sent successfully" });
                    //return res.status(400).send({ auth: false, code: 'server_user_not_found_mobile', message: "User not found for given phone number: " + mobile });
                };
            });

        } else if (process.env.clientNameLoginMobile.includes(clientName)) {
            PasswordRecoveryController.recoverPasswordWlLoginMobileRequest(req)
                .then((response) => {
                    return res.status(200).send(response);
                })
                .catch((err) => {
                    Sentry.captureException(err);
                    console.error(`[${context}][removeUserById][.catch] Error `, err.message);
                    ErrorHandler.ErrorHandler(err, res);
                });
        } else {

            var email = req.body.email;
            var userId;

            let query = {
                email: new RegExp(email, "i") , // DCL - Case-Insensitive Query
                clientName: clientName,
                status: statusEnum.registered
            };

            User.findOne(query, (err, userFound) => {

                if (err) {
                    Sentry.captureException(err);
                    console.error(`[${context}][User.findOne] Error `, err.message);

                    return res.status(500).send(err.message);
                } else {

                    if (userFound) {

                        userId = userFound._id;

                        //Check if has any active code of this email and update them
                        PasswordRecovery.markAsUsedById(userId, function (err, objdeleted) { });

                        //Insert data on recovery password table
                        var newPasswordRecovery = new PasswordRecovery({
                            userId: userId,
                            code: code,
                            used: false,
                            token: token
                        });

                        PasswordRecovery.createPasswordRecovery(newPasswordRecovery, function (err, recoveryPass) {
                            if (err) {
                                Sentry.captureException(err);
                                console.log(`[${context}][createPasswordRecovery] Error `, err.message);

                                return res.status(500).send(err.message);
                            }
                            else {
                                // Created Successfully
                                if (recoveryPass) {

                                    //Send email                                   
                                    sendEmail(email, code, userFound.name, clientName)
                                        .then(() => {
                                            cancelFirebaseWLTokens(userId);
                                            cancelAllTokens(userId);
                                            return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                                        })
                                        .catch((error) => {
                                            Sentry.captureException(error);
                                            console.log(`[${context}][sendRecoverSMS][.catch] Error `, error.message);

                                            return res.status(500).send(error.message);
                                        });
                                }
                                else
                                    return res.status(400).send({ auth: false, code: 'server_password_not_recovery', message: "Password not recovery" });
                            };
                        });

                    } else {
                        return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                        //return res.status(400).send({ auth: false, code: 'server_user_not_found_email', message: "User not found for given email: " + email });

                    };

                };

            });

        };

    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Create Password Recovery company
router.post('/api/company/recover_password', (req, res, next) => {
    var context = "POST /api/company/recover_password";
    try {

        var code = getRandomInt(10000, 100000);
        var headers = req.headers;

        var clientName = headers["clientname"]
        console.log("clientName", clientName);
        //Generating Token
        const token = jwt.sign({ code }, process.env.token_recovery_secret, { expiresIn: process.env.token_recovery_life });

        //Get user ID by email
        var email = req.body.email;

        if (!req.body.email) {
            return res.status(400).send({ auth: false, code: 'server_email_required', message: "Email required" });
        }
        else {

            let query = {
                email:new RegExp(email, "i") , // DCL - Case-Insensitive Query
                active: true,
                clientName: clientName,
                status: statusEnum.registered
            };

            var userId;

            if (clientName === "EVIO") {
                User.findOne(query, (err, userFound) => {
                    if (err) {
                        console.log(`[${context}][User.findOne] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (userFound) {
                            userId = userFound._id;
                            if (userFound.clientType === process.env.ClientTypeB2B) {

                                //Check if has any active code of this email and update them
                                PasswordRecovery.markAsUsedById(userFound._id, function (err, objdeleted) { });

                                //Insert data on recovery password table
                                var newPasswordRecovery = new PasswordRecovery({
                                    userId: userFound._id,
                                    code: code,
                                    used: false,
                                    token: token
                                });
                                PasswordRecovery.createPasswordRecovery(newPasswordRecovery, function (err, recoveryPass) {
                                    if (err) {
                                        console.log(`[${context}][createPasswordRecovery] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        // Created Successfully
                                        if (recoveryPass) {
                                            //Send email
                                            sendEmail(email, code, userFound.name, clientName)
                                                //sendRecoverSMS(user, code, headers)
                                                .then(() => {
                                                    cancelFirebaseTokens(userId);
                                                    cancelAllTokens(userId);
                                                    return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][sendEmail][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        }
                                        else
                                            return res.status(400).send({ auth: false, code: 'server_password_not_recovery', message: "Password not recovery" });
                                    };
                                });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_user_not_company', message: "User is not a company" });

                            };
                        }
                        else {

                            return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                            //return res.status(400).send({ auth: false, code: 'server_user_not_found_email', message: "User not found for given email: " + email });

                        };
                    };
                });
            } else {

                //TODO
                User.findOne(query, (err, userFound) => {
                    if (err) {
                        console.log(`[${context}][User.findOne] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (userFound) {
                            userId = userFound._id;
                            if (userFound.clientType === process.env.ClientTypeB2B) {

                                //Check if has any active code of this email and update them
                                PasswordRecovery.markAsUsedById(userFound._id, function (err, objdeleted) { });

                                //Insert data on recovery password table
                                var newPasswordRecovery = new PasswordRecovery({
                                    userId: userFound._id,
                                    code: code,
                                    used: false,
                                    token: token
                                });
                                PasswordRecovery.createPasswordRecovery(newPasswordRecovery, function (err, recoveryPass) {
                                    if (err) {
                                        console.log(`[${context}][createPasswordRecovery] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        // Created Successfully
                                        if (recoveryPass) {
                                            //Send email
                                            sendEmail(email, code, userFound.name, clientName)
                                                //sendRecoverSMS(user, code, headers)
                                                .then(() => {
                                                    cancelFirebaseWLTokens(userId);
                                                    cancelAllTokens(userId);
                                                    return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][sendEmail][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        }
                                        else
                                            return res.status(400).send({ auth: false, code: 'server_password_not_recovery', message: "Password not recovery" });
                                    };
                                });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_user_not_company', message: "User is not a company" });

                            };
                        }
                        else {

                            return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                            //return res.status(400).send({ auth: false, code: 'server_user_not_found_email', message: "User not found for given email: " + email });

                        };
                    };
                });
            }

        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========
router.put('/api/recover_password', (req, res, next) => {
    const context = "PUT /api/recover_password PUT entrypoint";

    try {

        var headers = req.headers;
        var clientName = headers["clientname"]

        //Get code
        var code = req.body.code;
        var email = req.body.email;
        var password = req.body.password;
        var mobile = req.body.mobile;
        var internationalPrefix = req.body.internationalPrefix;
        let regexPasswordValidation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/


        if (!code)
            return res.status(400).send({ auth: false, code: 'server_code_required', message: "Code required" });

        if (!password)
            return res.status(400).send({ auth: false, code: 'server_password_required', message: "Password required" });

        if (!(regexPasswordValidation.test(password)))
            return res.status(400).send({ auth: false, code: 'server_invalid_password', message: "New password is invalid" });

        if (clientName === "EVIO") {

            if (!req.body.mobile)
                return res.status(400).send({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });

            var userId;
            var mobile;
            let query = {
                mobile: mobile,
                internationalPrefix: internationalPrefix,
                clientName: clientName,
                status: statusEnum.registered
            };
            User.findOne(query, function (err, user) {
                if (err) {
                    console.log(`[${context}][getUserByMobile] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (user) {
                        userId = user._id;
                        mobile = user.mobile;

                        PasswordRecovery.checkIfCodeBelongsToUserId(code, userId, function (err, belongs) {
                            if (err) {
                                console.log(`[${context}][checkIfCodeBelongsToUserId] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (belongs) {
                                    //Check if code was already used
                                    PasswordRecovery.checkIfCodeWasAlreadyUsed(code, userId, function (err, usedCodeFound) {
                                        if (err) {
                                            console.log(`[${context}][checkIfCodeWasAlreadyUsed] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            if (usedCodeFound) {
                                                return res.status(400).send({ auth: false, code: 'server_code_already_used', message: "Provided code was already used" });
                                            }
                                            else {
                                                //Get Token by code
                                                PasswordRecovery.getPasswordRecoveryByCode(code, function (err, passwordRecovery) {
                                                    if (err) {
                                                        console.log(`[${context}][getPasswordRecoveryByCode] Erro `, err);
                                                        return res.status(500).send(err.message);
                                                    }
                                                    else {
                                                        if (passwordRecovery) {
                                                            //Check token validity
                                                            var token = passwordRecovery.token;

                                                            jwt.verify(token, process.env.token_recovery_secret, function (err, decoded) {
                                                                if (err) return res.status(400).send({ auth: false, code: 'server_code_expired', message: 'Code expired' });

                                                                // Update user password
                                                                PasswordRecovery.markAsUsedByCode(code, async (err, result2) => {
                                                                    if (err) {
                                                                        Sentry.captureException(err);
                                                                        console.log(`[${context}][markAsUsedByCode] Error `, err.message);

                                                                        return res.status(500).send(err.message);
                                                                    }
                                                                    else {
                                                                        if (result2) {
                                                                            console.log(`[${context}] Updating password for userId ${userId}`);
                                                                            await UserPasswords.updatePassword(userId, password);

                                                                            return res.status(200).send({ auth: true, code: 'server_password_changed', message: 'Password changed' });
                                                                        } else {
                                                                            return res.status(400).send({ auth: false, code: 'server_password_changed_wrong', message: 'Password changed but something was wrong' });
                                                                        }

                                                                    }
                                                                });

                                                            });
                                                        }
                                                        else
                                                            return res.status(400).send({ auth: false, code: 'server_invalid_code', message: "Invalid code" });
                                                    };
                                                });
                                            };
                                        };
                                    });
                                }
                                else
                                    return res.status(400).send({ auth: false, code: 'server_code_dont_belongs_mobile', message: "Provided code don't belogns to provided phone number : " + mobile });
                            };
                        });
                    }
                    else
                        return res.status(400).send({ auth: false, code: 'server_code_dont_belongs_mobile', message: "Provided code don't belogns to provided phone number : " + mobile });

                    //return res.status(400).send({ auth: false, code: 'server_user_not_found_mobile', message: "User not found for given phone number: " + mobile });
                };
            });

        } else if (process.env.clientNameLoginMobile.includes(clientName)) {
            PasswordRecoveryController.updateRecoverPasswordWlLoginMobile(req)
                .then((response) => {
                    return res.status(200).send(response);
                })
                .catch((err) => {
                    Sentry.captureException(err);
                    console.log(`[${context}][removeUserById][.catch] Error `, err.message);
                    ErrorHandler.ErrorHandler(err, res);
                });
        } else {

            if (!email)
                return res.status(400).send({ auth: false, code: 'server_email_required', message: "Email required" });

            let query = {
                email: new RegExp(email, "i") , // DCL - Case-Insensitive Query
                clientName: clientName
            };

            User.findOne(query, function (err, user) {
                if (err) {
                    Sentry.captureException(err);
                    console.log(`[${context}][User.findOne] Error `, err.message);

                    return res.status(500).send(err.message);
                }
                else {
                    if (user) {

                        userId = user._id;

                        console.log(`[${context}] Checking if code ${code} belongs to user id ${userId}`);

                        PasswordRecovery.checkIfCodeBelongsToUserId(code, userId, function (err, belongs) {

                            if (err) {
                                Sentry.captureException(err);
                                console.log(`[${context}][checkIfCodeBelongsToUserId] Error `, err.message);

                                return res.status(500).send(err.message);

                            } else {
                                if (belongs) {

                                    console.log(`[${context}] Checking if code ${code} was already used to user id ${userId}`);

                                    //Check if code was already used
                                    PasswordRecovery.checkIfCodeWasAlreadyUsed(code, userId, function (err, usedCodeFound) {
                                        if (err) {
                                            Sentry.captureException(err);
                                            console.log(`[${context}][checkIfCodeWasAlreadyUsed] Error `, err.message);

                                            return res.status(500).send(err.message);
                                        } else {
                                            if (usedCodeFound) {
                                                console.log(`[${context}] Code ${code} was already used to user id ${userId}`);

                                                return res.status(400).send({ auth: false, code: 'server_code_already_used', message: "Provided code was already used" });

                                            } else {

                                                //Get Token by code
                                                PasswordRecovery.getPasswordRecoveryByCode(code, function (err, passwordRecovery) {
                                                    if (err) {
                                                        Sentry.captureException(err);
                                                        console.log(`[${context}][getPasswordRecoveryByCode] Erro `, err);

                                                        return res.status(500).send(err.message);
                                                    }
                                                    else {
                                                        if (passwordRecovery) {
                                                            //Check token validity
                                                            var token = passwordRecovery.token;

                                                            jwt.verify(token, process.env.token_recovery_secret, async (err, decoded) => {
                                                                if (err) return res.status(400).send({ auth: false, code: 'server_code_expired', message: 'Code expired' });

                                                                // Update user password
                                                                console.log(`[${context}] Updating password for userId ${userId}`);
                                                                await UserPasswords.updatePassword(userId, password);

                                                                return res.status(200).send({ auth: true, code: 'server_password_changed', message: 'Password changed' });
                                                            });
                                                        }
                                                        else {
                                                            console.log(`[${context}] Invalid code ${code}`);

                                                            return res.status(400).send({ auth: false, code: 'server_invalid_code', message: "Invalid code" });
                                                        }
                                                    }
                                                });

                                            }
                                        }
                                    });
                                }
                                else {
                                    console.log(`[${context}] Code ${code} doesn't belong to user id ${userId}`);

                                    return res.status(400).send({ auth: false, code: 'server_code_dont_belongs_email', message: "Provided code don't belongs to provided email : " + email });
                                }

                            }

                        });

                    }
                    else
                        return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
                    //return res.status(400).send({ auth: false, code: 'server_user_not_found_email', message: "User not found for given email: " + email });
                };
            });

        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/company/recover_password', PasswordRecoveryController.changeCompanyPasswordWithCode);

//========== FUNCTION ==========
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

function sendEmail(email, code, username, clientName) {
    var context = "Function sendEmail";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.HostNotifications + process.env.PathNotificationsSendEmail;

            var mailOptions = {
                to: email,
                message: {
                    username: username,
                    passwordCode: code
                },
                type: "recoverPassword"
            };

            let headers = {
                clientname: clientName
            }

            axios.post(host, { mailOptions }, { headers })
                .then((result) => {
                    if (result)
                        resolve();
                    else
                        reject("email sent unsuccessfully!");
                })
                .catch((error) => {
                    if (error.response) {
                        console.log(`[${context}][.catch] Error `, error.response.data);
                        reject(error);
                    }
                    else {
                        console.log(`[${context}][.catch] Error `, error.message);
                        reject(error);
                    };
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to send SMS for activation
function sendRecoverSMS(user, code, headers) {
    var context = "Function sendRecoverSMS";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.HostNotifications + process.env.PathNotificationsRecoverPassword;
            var params = {
                user: user,
                message: code,
                headers: headers
            };
            axios.post(host, params)
                .then((result) => {
                    if (result)
                        resolve();
                    else
                        reject("SMS sent unsuccessfully!");
                })
                .catch((error) => {
                    console.log(`[${context}][.catch] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function cancelAllTokens(userId) {
    var context = "Function cancelAllTokens";

    let data = {
        userId: userId
    };

    let host = "http://authorization:3001/api/validTokens";

    axios.patch(host, data)
        .then(() => {
            console.log("Tokens updated");
        })
        .catch(error => {
            console.log(`[${context}][.catch] Error `, error.message);
        });

};

function cancelFirebaseTokens(userId) {
    var context = "Function cancelFirebaseTokens";

    let data = {
        userId: userId
    };

    //let host = "http://notifications:3008/api/private/firebase/firebaseUserTokens";
    let host = process.env.NotificationsHost + process.env.PathNotificationFirebaseUserTokens;

    axios.patch(host, data)
        .then(() => {
            console.log("Tokens firebase updated");
        })
        .catch(error => {
            Sentry.captureException(error);
            console.log(`[${context}][.catch] Error `, error.message);
        });

};

function cancelFirebaseWLTokens(userId) {
    var context = "Function cancelFirebaseWLTokens";

    let data = {
        userId: userId
    };

    //let host = "http://notifications-firebase-wl:3032/api/private/firebase/firebaseUserTokens";
    let host = process.env.NotificationsFirebaseWLHost + process.env.PathNotificationFirebaseUserTokens;

    axios.patch(host, data)
        .then(() => {
            console.log("Tokens firebase updated");
        })
        .catch(error => {
            Sentry.captureException(error);
            console.log(`[${context}][.catch] Error `, error.message);
        });

};

module.exports = router;