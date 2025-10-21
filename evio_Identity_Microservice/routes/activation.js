const express = require('express');
const router = express.Router();
const axios = require("axios");
const Activation = require('../models/activation');
const User = require('../models/user');
const GuestUser = require('../models/guestUsers');
const PasswordRecovery = require('../models/password_recovery');

const UserService = require('../services/users').default;
const Sentry = require('@sentry/node');
const { default: { clientNames } } = require('../utils/constants');
const { default: { sendActivationSMS, sendEmail } } = require('../services/notificationsService');
const { default: { getRandomInt } } = require('../utils/randomNum');

require("dotenv-safe").load();

//========== POST ==========
router.post('/api/accountActivation', (req, res, next) => {
    const context = "POST /api/accountActivation";
    try {

        const headers = req.headers;
        const user = req.body;
        const clientName = headers["clientname"];

        console.log(`[${context}] Handling accountActivation for clientName=${clientName}`);

        if (clientName === clientNames.evio) {

            if (user.mobile === undefined) {
                return res.status(400).send({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });
            } else {
                let query = {
                    mobile: user.mobile,
                    clientName: clientName,
                    status: process.env.USERRREGISTERED
                };
                User.findOne(query, (err, result) => {
                    if (err) {
                        console.error(`[${context}][findOne] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (result) {
                            var params = {
                                $and: [
                                    {
                                        userId: result._id,
                                        used: false
                                    }
                                ]
                            };
                            Activation.findOne(params, (err, resultActivation) => {
                                if (err) {
                                    console.error(`[${context}][Activation.findOne] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    if (resultActivation) {
                                        updateActivation(resultActivation)
                                            .then((values) => {
                                                if (values) {
                                                    saveActivation(result)
                                                        .then(async(activationCode) => {
                                                            await sendActivationSMS(result, activationCode, headers.client);

                                                            return res.status(200).send({ auth: true, code: 'server_sms_sent_success', message: "SMS sent successfully" });
                                                        })
                                                        .catch((error) => {
                                                            Sentry.captureException(error);
                                                            console.error(`[${context}][saveActivation][.catch] Error `, error.message);

                                                            return res.status(400).send({ auth: false, code: 'server_error_activation_code', message: "We are currently unable to fulfill your request, please try again later." });
                                                        });
                                                }
                                                else {
                                                    return res.status(400).send({ auth: false, code: 'server_error_activation_code', message: "We are currently unable to fulfill your request, please try again later." });
                                                }
                                            })
                                            .catch((error) => {
                                                Sentry.captureException(error);
                                                console.error(`[${context}][updateActivation][.catch] Error `, error.message);

                                                return res.status(400).send({ auth: false, code: 'server_error_activation_code', message: "We are currently unable to fulfill your request, please try again later." });
                                            });
                                    }
                                    else {
                                        saveActivation(result)
                                            .then(async(activationCode) => {
                                                await sendActivationSMS(result, activationCode, headers.client);

                                                return res.status(200).send({ auth: true, code: 'server_sms_sent_success', message: "SMS sent successfully" });
                                            })
                                            .catch((error) => {
                                                Sentry.captureException(error);
                                                console.error(`[${context}][saveActivation][.catch] Error `, error.message);

                                                return res.status(400).send({ auth: false, code: 'server_error_activation_code', message: "We are currently unable to fulfill your request, please try again later." });
                                            });
                                    }
                                }
                            });
                        }
                        else {
                            return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given mobile" });
                        }
                    }
                });
            }


        } else {

            if (!user.email) {

                return res.status(400).send({ auth: false, code: 'server_email_required', message: 'Email is required' });

            };

            var query = {
                email: user.email,
                clientName: clientName,
                status: process.env.USERRREGISTERED
            };

            User.findOne(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                };

                if (result) {

                    var params = {
                        $and: [
                            {
                                userId: result._id,
                                used: false
                            }
                        ]
                    };

                    Activation.findOne(params, (err, resultActivation) => {

                        if (err) {

                            console.error(`[${context}][Activation.findOne] Error `, err.message);
                            return res.status(500).send(err.message);

                        };

                        if (resultActivation) {

                            updateActivation(resultActivation)
                                .then((values) => {

                                    if (values) {

                                        saveActivation(result)
                                            .then((value) => {

                                                sendActivationEmailWl(user, value, "activeAccount", clientName)
                                                    .then(() => {

                                                        return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });

                                                    })
                                                    .catch((error) => {

                                                        console.error(`[${context}][sendActivationEmailWl][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);

                                                    });

                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][saveActivation][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);

                                            });

                                    } else {

                                        return res.status(400).send({ auth: false, code: 'server_error_activation_code', message: "We are currently unable to fulfill your request, please try again later." })

                                    };

                                })
                                .catch((error) => {
                                    console.error(`[${context}][updateActivation][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });

                        } else {

                            saveActivation(result)
                                .then((value) => {

                                    sendActivationEmailWl(user, value, "activeAccount", clientName)
                                        .then(() => {

                                            return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });

                                        })
                                        .catch((error) => {

                                            console.error(`[${context}][sendActivationEmailWl][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);

                                        });

                                })
                                .catch((error) => {

                                    console.error(`[${context}][saveActivation][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });

                        };

                    });

                } else {

                    return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given parameters" });

                };

            });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Endpoint to update a activation code
router.patch('/api/accountActivation', async(req, res, next) => {
    let context = "PATCH /api/accountActivation";
    try {

        let headers = req.headers;
        let user = req.body;
        let clientName = headers["clientname"];

        if (clientName === "EVIO" || process.env.clientNameLoginMobile.includes(clientName)) {

            try {

                if (user.mobile === undefined) {
                    console.log(`[${context}] Mobile number required`);

                    return res.status(400).send({ auth: false, code: 'server_mobile_number_required', message: "Mobile number required" });
                } else {
                    let query = {
                        clientName: clientName,
                        status: process.env.USERRREGISTERED,
                        mobile: user.mobile,
                        internationalPrefix: user.internationalPrefix,
                    };

                    //TODO: remove me, only for debug purposes
                    console.log(`[${context}] Querying user query`, query);

                    let fetchedUser = await User.findOne(query);

                    if (!fetchedUser) {

                       console.log(`[${context}] User not found for given mobile, trying verify using pending mobile`);
                       query = {
                           "pendingMobile.mobile": user.mobile,
                           "pendingMobile.internationalPrefix": user.internationalPrefix,
                           clientName: clientName,
                           status: process.env.USERRREGISTERED,
                       }
                       
                       fetchedUser = await User.findOne(query);
                       if(!fetchedUser) {
                           return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given mobile" });
                       }

                    }

                    const fetchedActivation = await Activation.findOne({ userId: fetchedUser._id, used: false, code: user.code });

                    if(!fetchedActivation) {
                        return res.status(400).send({ auth: false, code: 'server_code_dont_belongs_mobile', message: "No code found to send" });
                    }

                    await UserService.setCodeUsedForActivation(fetchedUser._id, user.code);

                    if (fetchedUser.pendingMobile && fetchedUser.pendingMobile.mobile === user.mobile && fetchedUser.pendingMobile.internationalPrefix === user.internationalPrefix) {
                        await UserService.setUserAsActiveAndRemovePendingMobile(fetchedUser._id, user.mobile, user.internationalPrefix, clientName);
                    }else {
                        await UserService.setUserAsActive(fetchedUser._id);
                    }

                    return res.status(200).send({ auth: true, code: 'server_account_successfully_activated', message: "Your account was successfully activated" });

                }

            } catch (error) {
                Sentry.captureException(error);
                console.error(`[${context}] Error `, error.message);

                return res.status(400).send({ auth: false, code: "server_error_activate", message: "We were unable to place your request, please try again later." });
            }


        } else {

            if (!user.email) {

                return res.status(400).send({ auth: false, code: 'server_email_required', message: 'Email is required' });

            };

            let query = {
                username: user.email,
                email: user.email,
                clientName: clientName,
                status: process.env.USERRREGISTERED
            };

            User.findOne(query, (err, userFound) => {

                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                };

                if (userFound) {

                    let params = {
                        $and: [
                            {
                                userId: userFound._id,
                                code: user.code,
                                used: false
                            }
                        ]
                    };

                    Activation.findOne(params, (err, resultActivation) => {

                        if (err) {
                            console.error(`[${context}][Activation.findOne] Error `, err.message);
                            return res.status(500).send(err.message);
                        };

                        if (resultActivation) {

                            var newValue = { $set: { active: true, changedEmail: false, isEmailVerified: true } };

                            User.updateUser(query, newValue, (err, result) => {

                                if (err) {
                                    console.error(`[${context}][updateUser] Error `, err.message);
                                    return res.status(500).send(err.message);
                                };

                                if (result) {

                                    updateActivation(resultActivation)
                                        .then(async (value) => {
                                            if (value) {

                                                if (clientName === process.env.clientNameACP) {
                                                    let params = {
                                                        userId: userFound._id,
                                                        used: true
                                                    };
                                                    let activationsFound = await Activation.find(params);
                                                    if (activationsFound.length === 1)
                                                        sendWelcomeEmailACP(userFound);

                                                };

                                                return res.status(200).send({ auth: true, code: 'server_account_successfully_activated', message: "Your account was successfully activated" });
                                            }
                                            else
                                                return res.status(400).send({ auth: false, code: "server_error_activation_code", menssage: "We were unable to place your request, please try again later." })
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][updateActivation][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });

                                } else {

                                    return res.status(400).send({ auth: false, code: "server_error_activate", menssage: "We were unable to place your request, please try again later." })

                                };

                            });

                        } else {

                            return res.status(400).send({ auth: false, code: 'server_invalid_code', message: "Invalid code." });

                        };

                    });

                } else {

                    return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given parameters" });

                };

            });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to update a activation code by email
router.patch('/api/accountActivation/email', (req, res, next) => {
    var context = "PATCH /api/accountActivation/email";
    try {
        var user = req.body;
        var clientName = req.headers["clientname"];
        if (user.email === undefined) {
            return res.status(400).send({ auth: false, code: 'server_email_required', message: 'Email is required' });
        }
        else {

            var query = {
                email: user.email,
                clientName: clientName,
                status: process.env.USERRREGISTERED
            };

            User.findOne(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (result) {
                        var params = {
                            $and: [
                                {
                                    userId: result._id,
                                    code: user.code,
                                    used: false
                                }
                            ]
                        };
                        Activation.findOne(params, (err, resultActivation) => {
                            if (err) {
                                console.error(`[${context}][Activation.findOne] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (resultActivation) {

                                    var newValue = { $set: { active: true, changedEmail: false } };

                                    User.updateUser(query, newValue, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}][updateUser] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            if (result) {
                                                updateActivation(resultActivation)
                                                    .then((value) => {
                                                        if (value)
                                                            return res.status(200).send({ auth: true, code: 'server_account_successfully_activated', message: "Your account was successfully activated" });
                                                        else
                                                            return res.status(400).send({ auth: false, code: "server_error_activation_code", menssage: "We were unable to place your request, please try again later." })
                                                    })
                                                    .catch((error) => {
                                                        console.error(`[${context}][updateActivation][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            }
                                            else {
                                                return res.status(400).send({ auth: false, code: "server_error_activate", menssage: "We were unable to place your request, please try again later." })
                                            };
                                        };
                                    });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_invalid_code', message: "Invalid code." })
                                };
                            };
                        });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given mobile" });
                    };
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/accountActivation/resendCode', async (req, res, next) => {
    const context = "PATCH /api/accountActivation/resendCode";

    try {
        const reqBody = req.body;
        const headers = req.headers;
        const clientName = headers["clientname"];
        let query;

        const isBackOffice = headers['client'] === "BackOffice";

        if (isBackOffice) {

            if (!reqBody.email) {
                return res.status(400).send({ auth: false, code: 'server_email_or_mobile_required', message: 'Email or mobile is required' });
            }

            query = {
                email: reqBody.email,
                clientName: clientName,
                status: process.env.USERRREGISTERED
            };

        } else {

            if (!reqBody.mobile && !reqBody.internationalPrefix) {
                return res.status(400).send({ auth: false, code: 'server_mobile_required', message: 'Mobile number is required' });
            }

            if (reqBody.mobile && !reqBody.internationalPrefix) {
                return res.status(400).send({ auth: false, code: 'server_internationalPrefix_required', message: 'Internationl prefix is required' });
            }

            if (!reqBody.mobile && reqBody.internationalPrefix) {
                return res.status(400).send({ auth: false, code: 'server_mobile_required', message: 'Mobile number is required' });
            }

            query = {
                mobile: reqBody.mobile,
                internationalPrefix: reqBody.internationalPrefix
            }
        }

        let userFound = await User.findOne(query);

        if (!userFound) {
            console.log(`[${context}] User not found for given parameters`);

            if (isBackOffice) {
                const queryToGuestUser = {
                    email: reqBody.email,
                    clientName: clientName,
                }
                console.log(`[${context}] Querying guest user query`, queryToGuestUser);

                userFound = await GuestUser.findOne(queryToGuestUser);

                if (!userFound) {
                    return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given parameters" });
                }
            }

            return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given parameters" });

        } else {

            await Activation.updateMany({ userId: userFound._id }, { $set: { used: true } });
            await PasswordRecovery.updateMany({ userId: userFound._id }, { $set: { used: true } });

            const code = getRandomInt(10000, 100000);
            let activation = new Activation({
                code,
                userId: userFound._id
            });

            let passwordRecovery = new PasswordRecovery({
                code,
                userId: userFound._id
            });

            await Activation.createActivation(activation);
            await PasswordRecovery.createPasswordRecovery(passwordRecovery);

            if (isBackOffice) {
                await sendEmail(
                    {
                        _id: userFound._id,
                        email: reqBody.email,
                        userName: reqBody.email,
                        clientName: userFound.clientName,
                        type: "resendCode",
                    }, code);
            } else {
                await sendActivationSMS(userFound, code, headers.client);
            }

            return res.status(200).send({ auth: true, code: 'server_code_resend', message: "Code resend" });

        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//Function to save im activation bd
function saveActivation(user) {
    const context = "Function saveActivation";

    return new Promise((resolve, reject) => {
        try {
            //Generating code
            const code = getRandomInt(10000, 100000);
            const activation = new Activation({
                code,
                userId: user._id
            });
            Activation.createActivation(activation, (error, result) => {
                if (error) {
                    console.error(`[${context}][createActivation] Error `, error.message);
                    reject(error);
                }
                else {
                    if (result)
                        resolve(code);
                    else
                        resolve(false);
                };
            });
        } catch (error) {
            Sentry.captureException(error);
            console.error(`[${context}] Error `, error.message);

            reject(error);
        }
    });
};

//update activation bd
function updateActivation(result) {
    var context = "Function updateActivation";
    return new Promise((resolve, reject) => {
        try {
            result.used = true;
            result.modifyDate = Date.now;
            var query = {
                _id: result._id
            };
            var values = { $set: result };
            Activation.updateActivation(query, values, (err, resultUpdate) => {
                if (err) {
                    console.error(`[${context}][updateActivation] Error `, err.message);
                    reject(err);
                }
                else {
                    if (resultUpdate)
                        resolve(true);
                    else
                        resolve(false);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
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
                    console.error(`[${context}][.catch] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function sendActivationEmailWl(user, code, action, clientName) {
    var context = "Function sendActivationEmailWl";
    return new Promise((resolve, reject) => {
        try {

            if(clientName == process.env.WhiteLabelGoCharge) {
                resolve();
            }

            var host = process.env.HostNotifications + process.env.PathNotificationsSendEmail;

            var mailOptions = {
                to: user.email,
                message: {
                    username: user.name,
                    passwordCode: code
                },
                type: action
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
                        console.error(`[${context}][.catch] Error `, error.response.data);
                        reject(error);
                    }
                    else {
                        console.error(`[${context}][.catch] Error `, error.message);
                        reject(error);
                    };
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function sendWelcomeEmailACP(user) {
    let context = "Function sendWelcomeEmailACP";
    try {

        let host = process.env.HostNotifications + process.env.PathNotificationsSendEmail;

        let mailOptions = {
            to: user.email,
            message: {
                "username": user.name,
            },
            type: user.activePartner ? 'registerActivePartner' : 'registerInactivePartner'
        };

        let headers = {
            clientname: user.clientName
        }

        axios.post(host, { mailOptions }, { headers })
            .then((result) => {
                if (result)
                    console.log("email sent successfully!");
                else
                    console.log("email sent unsuccessfully!");
            })
            .catch((error) => {
                if (error.response) {
                    console.error(`[${context}][.catch] Error `, error.response.data);

                }
                else {
                    console.error(`[${context}][.catch] Error `, error.message);

                };
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);

    };
}

module.exports = router;