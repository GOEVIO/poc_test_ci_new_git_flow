const User = require('./models/user');
const GuestUsers = require('./models/guestUsers');
const UserHandler = require('./controllers/user');

const Sentry = require('@sentry/node');

require("dotenv-safe").load();

function mongocontroller() {

    const addmongoUser = function (user, res) {
        const context = "Function addmongoUser";

        return new Promise((resolve, reject) => {
            User.findOne({ email: user.email, clientName: user.clientName, $or: [{ active: true }, { status: process.env.USERRREGISTERED }] })
                .exec((err, doc) => {
                    if (err) {
                        Sentry.captureException(err);
                        console.error(`[${context}] Error during find user using email=${user?.email} and clientName=${user?.clientName}`, err);

                        return res.send(err);
                    }

                    if (doc) {
                        console.warn(`[${context}] Email ${user?.email} for clientName=${user?.clientName} is already registered`);
                        return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
                    }

                    GuestUsers.findOne({ email: user.email, clientName: user.clientName })
                        .exec((err, doc) => {
                            if (err) {
                                Sentry.captureException(err);
                                console.error(`[${context}] Error during find guest user using email=${user?.email} and clientName=${user?.clientName}`, err);

                                return res.send(err);
                            }

                            if (doc) {
                                console.warn(`[${context}] Email ${user?.email} for clientName=${user?.clientName} is already registered`);
                                return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
                            }

                            User.findOne({ username: user.username, clientName: user.clientName, $or: [{ active: true }, { status: process.env.USERRREGISTERED }] })
                                .exec((err, doc) => {
                                    if (err) {
                                        Sentry.captureException(err);
                                        console.log(`[${context}][User.findOne] Error `, err);

                                        return reject(err);
                                    }

                                    if (doc) {
                                        return reject({ auth: false, code: 'server_mobile_taken', message: 'Mobile ' + user.username + ' is already taken' });
                                    }

                                    /*
                                    var newUser = new User({
                                        name: user.name,
                                        email: user.email,
                                        username: user.username,
                                        mobile: user.mobile,
                                        active: user.active,
                                        licenseAgreement: user.licenseMarketing,
                                        country: user.country,
                                        language: user.language,
                                        internationalPrefix: user.internationalPrefix,
                                        imageContent: user.imageContent
                                    });
                                    */
                                    var newUser = new User(user);
                                    newUser.password = undefined;

                                    User.createUser(newUser, function (err, resUser) {
                                        if (err) {
                                            Sentry.captureException(err);
                                            console.log(`[${context}][createUser] Error `, err);

                                            return reject(new Error(err));
                                        }

                                        console.info(`[${context}] User was added email=${user?.email} for clientName=${user?.clientName}`);
                                        resUser.password = user.password;
                                        User.getEncriptedPassword(resUser.password, function (err, encriptedPassword) {
                                            resUser.password = encriptedPassword;
                                            resolve(resUser);
                                        });
                                    });
                                });
                        });
                });
        });

    };

    const deletemongoUser = function (user) {
        var context = "Function deletemongoUser";
        return new Promise((resolve, reject) => {
            //console.log("user.username", user.username)
            User.deleteUserByUsername(user.username, user.clientName, function (err, user) {
                if (err) {
                    console.log(`[${context}] Error `, err);
                    return reject(new Error(err));
                };
                resolve("User deleted");
            });
        });
    };

    const addmongoGuestUser = function (guestUser) {
        var context = "Function addmongoGuestUser";

        return new Promise((resolve, reject) => {
            //console.log("guestUser", guestUser);

            var newGuestUser = new GuestUsers(guestUser);
            newGuestUser.password = undefined;

            GuestUsers.createGuestUsers(newGuestUser, (err, resGuestUser) => {
                if (err) {
                    console.log(`[${context}][createGuestUsers] Error `, err);
                    return reject(new Error(err));
                };
                resGuestUser.password = guestUser.password;
                User.getEncriptedPassword(resGuestUser.password, (err, encriptedPassword) => {
                    resGuestUser.password = encriptedPassword;
                    resolve(resGuestUser);
                });
            });
        });
    };

    const addmongoGuestUserWL = function (guestUser) {
        var context = "Function addmongoGuestUserWL";

        return new Promise((resolve, reject) => {
            //console.log("guestUser", guestUser);

            var newGuestUser = new GuestUsers(guestUser);
            newGuestUser.password = undefined;

            GuestUsers.createGuestUsers(newGuestUser, (err, resGuestUser) => {
                if (err) {
                    console.log(`[${context}][createGuestUsers] Error `, err);
                    return reject(new Error(err));
                };
                resGuestUser.password = guestUser.password;
                User.getEncriptedPassword(resGuestUser.password, (err, encriptedPassword) => {
                    resGuestUser.password = encriptedPassword;
                    resolve(resGuestUser);
                });
            });
        });
    };

    const deletemongoGuestUser = async (guestUserId) => {
        const context = 'Function deletemongoGuestUser';
        try {
            await GuestUsers.removeGuestUser(guestUserId);
            return 'Guest user deleted';
        } catch (err) {
            console.log(`[${context}] Error `, err);
            throw new Error(err);
        }
    };

    const addmongoUserWl = function (user) {
        const context = "Function addmongoUserWl";

        return new Promise((resolve, reject) => {

            User.findOne({ mobile: user.mobile, internationalPrefix: user.internationalPrefix, clientName: user.clientName, $or: [{ active: true }, { status: process.env.USERRREGISTERED }] })
                .exec((err, doc) => {
                    if (err) {

                        console.log(`[${context}] Error `, err);
                        return res.send(err);

                    };

                    if (doc) {

                        return reject({ auth: false, code: 'server_mobile_taken', message: 'Mobile ' + user.mobile + ' is already taken' });

                    }

                    GuestUsers.findOne({ email: user.email, clientName: user.clientName })
                        .exec((err, doc) => {
                            if (err) {

                                console.log(`[${context}] Error `, err);
                                return res.send(err);

                            };

                            if (doc) {

                                return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });

                            };

                            User.findOne({ username: user.username, clientName: user.clientName, $or: [{ active: true }, { status: process.env.USERRREGISTERED }] })
                                .exec(async (err, doc) => {
                                    if (err) {

                                        console.log(`[${context}][User.findOne] Error `, err);
                                        return reject(err);

                                    };

                                    if (doc) {

                                        return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.username + ' is already taken' });

                                    };

                                    if (user.clientName === process.env.WhiteLabelACP) {
                                        //console.log("newUser.cardNumber", newUser.cardNumber);
                                        if (user.cardNumber) {

                                            User.findOne({ cardNumber: user.cardNumber, clientName: user.clientName, active: true }, async (err, userFound) => {
                                                if (err) {
                                                    console.log(`[${context}][createUser] Error `, err);
                                                    return reject(new Error(err));
                                                };
                                                if (userFound) {
                                                    return reject({ auth: false, code: 'server_cardNumber_taken', message: 'Card Number ' + user.cardNumber + ' already in use by another user' });
                                                } else {

                                                    console.log("1")


                                                    let validatePartnerACP = await getValidatePartnerACP(user.cardNumber, user.memberNumber, user);

                                                    console.log(`${context} - validatePartnerACP: ${JSON.stringify(validatePartnerACP)}`);

                                                    user.activePartner = validatePartnerACP.activePartner;
                                                    user.cardAndMemberNotValid = validatePartnerACP.cardAndMemberNotValid;
                                                    user.faildConnectionACP = validatePartnerACP.faildConnectionACP;
          
                                                    let newUser = new User(user);
                                                    newUser.password = undefined;
                                                    //newUser.activePartner = true;
                                                    User.createUser(newUser, function (err, resUser) {
                                                        if (err) {
                                                            console.log(`[${context}][createUser] Error `, err);
                                                            return reject(new Error(err));
                                                        };
                                                        resUser.password = user.password;
                                                        User.getEncriptedPassword(resUser.password, function (err, encriptedPassword) {
                                                            resUser.password = encriptedPassword;
                                                            resolve(resUser);
                                                        });
                                                    });
                                                }
                                            })

                                        } else {   
                                            user.activePartner = false;
                                            let newUser = new User(user);
                                            newUser.password = undefined;
                                            User.createUser(newUser, function (err, resUser) {
                                                if (err) {
                                                    console.log(`[${context}][createUser] Error `, err);
                                                    return reject(new Error(err));
                                                };
                                                resUser.password = user.password;
                                                User.getEncriptedPassword(resUser.password, function (err, encriptedPassword) {
                                                    resUser.password = encriptedPassword;
                                                    resolve(resUser);
                                                });
                                            });
                                        };

                                    } else {
                                        let newUser = new User(user);
                                        newUser.password = undefined;
                                        User.createUser(newUser, function (err, resUser) {
                                            if (err) {
                                                console.log(`[${context}][createUser] Error `, err);
                                                return reject(new Error(err));
                                            };
                                            resUser.password = user.password;
                                            User.getEncriptedPassword(resUser.password, function (err, encriptedPassword) {
                                                resUser.password = encriptedPassword;
                                                resolve(resUser);
                                            });

                                        });
                                    };

                                });
                        });
                });

        });

    };

    const addmongoUserWlIdGo = function (user) {
        var context = "Function addmongoUserWlIdGo";

        return new Promise((resolve, reject) => {

            /*User.findOne({ mobile: user.mobile, internationalPrefix: user.internationalPrefix, clientName: user.clientName })
                .exec((err, doc) => {
                    if (err) {

                        console.log(`[${context}] Error `, err);
                        return res.send(err);

                    };

                    if (doc) {

                        return reject({ auth: false, code: 'server_mobile_taken', message: 'Mobile ' + user.mobile + ' is already taken' });

                    };*/

            GuestUsers.findOne({ email: user.email, clientName: user.clientName, status: process.env.USERRREGISTERED })
                .exec((err, doc) => {
                    if (err) {

                        console.log(`[${context}] Error `, err);
                        return res.send(err);

                    };

                    if (doc) {

                        return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });

                    };

                    User.findOne({ username: user.username, clientName: user.clientName, status: process.env.USERRREGISTERED })
                        .exec((err, doc) => {
                            if (err) {

                                console.log(`[${context}][User.findOne] Error `, err);
                                return reject(err);

                            };

                            if (doc) {

                                return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.username + ' is already taken' });

                            };

                            var newUser = new User(user);
                            newUser.password = undefined;

                            User.createUser(newUser, (err, resUser) => {
                                if (err) {
                                    console.log(`[${context}][createUser] Error `, err);
                                    return reject(new Error(err));
                                };

                                resolve(resUser);

                            });
                        });
                });
            //});

        });

    };

    const addmongoHyundai = function (user) {
        var context = "Function addmongoHyundai";

        return new Promise((resolve, reject) => {

            /*User.findOne({ mobile: user.mobile, internationalPrefix: user.internationalPrefix, clientName: user.clientName })
                .exec((err, doc) => {
                    if (err) {

                        console.log(`[${context}] Error `, err);
                        return res.send(err);

                    };

                    if (doc) {

                        return reject({ auth: false, code: 'server_mobile_taken', message: 'Mobile ' + user.mobile + ' is already taken' });

                    };*/

            GuestUsers.findOne({ email: user.email, clientName: user.clientName })
                .exec((err, doc) => {
                    if (err) {

                        console.log(`[${context}] Error `, err);
                        return res.send(err);

                    };

                    if (doc) {

                        return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });

                    };

                    User.findOne({ username: user.username, clientName: user.clientName })
                        .exec((err, doc) => {
                            if (err) {

                                console.log(`[${context}][User.findOne] Error `, err);
                                return reject(err);

                            };

                            if (doc) {

                                return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.username + ' is already taken' });

                            };

                            var newUser = new User(user);
                            newUser.password = undefined;

                            User.createUser(newUser, (err, resUser) => {
                                if (err) {
                                    console.log(`[${context}][createUser] Error `, err);
                                    return reject(new Error(err));
                                };

                                resolve(resUser);

                            });
                        });
                });
            //});

        });

    };

    const deletemongoUserWl = function (user) {
        var context = "Function deletemongoUserWl";
        return new Promise((resolve, reject) => {
            GuestUsers.deleteOne({ email: user.email, clientName: user.clientName }, function (err, user) {
                if (err) {
                    console.log(`[${context}] Error `, err);
                    return reject(new Error(err));
                };
                resolve("Guest user deleted");
            });
        });
    };

    const addmongoUserWlLoginMobile = function (user) {
        var context = "Function addmongoUserWlLoginMobile";

        return new Promise((resolve, reject) => {
            User.findOne({ email: user.email, clientName: user.clientName, $or: [{ active: true }, { status: process.env.USERRREGISTERED }] })
                .exec((err, doc) => {
                    if (err) {
                        console.log(`[${context}] Error `, err);
                        return res.send(err);
                    };
                    if (doc) {
                        //return reject(new Error('Email ' + user.email + ' is already registered'));
                        return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
                    };

                    GuestUsers.findOne({ email: user.email, clientName: user.clientName })
                        .exec((err, doc) => {
                            if (err) {
                                console.log(`[${context}] Error `, err);
                                return res.send(err);
                            }
                            if (doc) {
                                //return reject(new Error('Email ' + user.email + ' is already registered'));
                                return reject({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
                            };

                            User.findOne({ username: user.username, clientName: user.clientName, $or: [{ active: true }, { status: process.env.USERRREGISTERED }] })
                                .exec((err, doc) => {
                                    if (err) {
                                        console.log(`[${context}][User.findOne] Error `, err);
                                        return reject(err);
                                    } //throw new Error(err);
                                    if (doc) {
                                        return reject({ auth: false, code: 'server_mobile_taken', message: 'Mobile ' + user.username + ' is already taken' });
                                        //return reject({ auth: false, code: 'server_username_taken', message: 'Username ' + user.username + ' is already taken' });
                                    };

                                    /*
                                    var newUser = new User({
                                        name: user.name,
                                        email: user.email,
                                        username: user.username,
                                        mobile: user.mobile,
                                        active: user.active,
                                        licenseAgreement: user.licenseMarketing,
                                        country: user.country,
                                        language: user.language,
                                        internationalPrefix: user.internationalPrefix,
                                        imageContent: user.imageContent
                                    });
                                    */
                                    var newUser = new User(user);
                                    newUser.password = undefined;

                                    User.createUser(newUser, function (err, resUser) {
                                        if (err) {
                                            console.log(`[${context}][createUser] Error `, err);
                                            return reject(new Error(err));
                                        };
                                        resUser.password = user.password;
                                        User.getEncriptedPassword(resUser.password, function (err, encriptedPassword) {
                                            resUser.password = encriptedPassword;
                                            resolve(resUser);
                                        });
                                    });
                                });
                        });
                });
        });

    };

    const deletemongoUserWlLoginMobile = function (user) {
        var context = "Function deletemongoUserWlLoginMobile";
        return new Promise((resolve, reject) => {
            //console.log("user.username", user.username)
            User.deleteUserByUsername(user.username, user.clientName, function (err, user) {
                if (err) {
                    console.log(`[${context}] Error `, err);
                    return reject(new Error(err));
                };
                resolve("User deleted");
            });
        });
    };

    return { addmongoUser, deletemongoUser, addmongoGuestUser, deletemongoGuestUser, addmongoUserWl, deletemongoUserWl, addmongoUserWlIdGo, addmongoHyundai, addmongoGuestUserWL, addmongoUserWlLoginMobile, deletemongoUserWlLoginMobile };

};

module.exports = mongocontroller;

function getValidatePartnerACP(cardNumber, memberNumber, user) {
    const context = "Function getValidatePartnerACP";
    return new Promise(async (resolve, reject) => {
        try {

            let responseFromACP = await UserHandler.ValidateSocioByCardNumber(cardNumber, memberNumber, user);
            resolve(responseFromACP);

        } catch (error) {

            resolve({ activePartner: false, cardAndMemberNotValid: false });

        };
    });
}

