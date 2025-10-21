const Ldap = require('./ldap');
const MongoDb = require('./mongo');
var User = require('../../models/user');
var Activation = require('../../models/activation');
const validTokens = require('../authenticationTokens/validTokens')
const Validator = require('email-validator');
const fs = require('fs');
const Utils = require('../../utils')
module.exports = {
    create: function (req, res) {

        var context = "POST /api/private/controlcenter/users";
        try {
            //console.log("req.body", req.body);
            const user = new User(req.body);
            user.cpoDetails = Utils.defaultCpoDetails()

            // I think the user should be active since we're the ones who are creating it
            user.active = true

            var headers = req.headers;
            if (req.body.imageContent === undefined) {
                user.imageContent = "";
            };
            validateFields(user)
                .then(() => {
                    if (user.imageContent !== "") {
                        saveImageContent(user)
                            .then((value) => {
                                addUser(value, res, headers);
                            })
                            .catch((error) => {
                                console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    } else {
                        addUser(user, res, headers);
                    };
                })
                .catch((error) => {
                    return res.status(400).send(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    },
    delete: (req,res) => deleteUser(req,res),
    update: (req,res) => updateUser(req,res),
    getOwnerIds: (req, res) => getOwnerIds(req,res),
    // getOne: (req, res) => getOneUser(req,res),

}

const addUser = (user, res, headers) => {
    var context = "Function addUser";
    const mongocontroller = MongoDb();
    mongocontroller.addmongoUser(user)
        .then((result) => {
            const controller = Ldap();
            controller.addldapUser(result)
                .then((user) => {

                    return res.status(200).send(user);
                })
                .catch(error => {

                    mongocontroller.deletemongoUser(user);
                    return res.status(400).send(error);
                });
        })
        .catch(error => {
            if (error.auth != undefined) {
                return res.status(400).send(error);
            }
            else {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            };
        });
};

function validateFields(user) {
    return new Promise((resolve, reject) => {
        let regexPasswordValidation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/
        if (!user)
            reject({ auth: false, code: 'server_user_required', message: 'User data is required' });

        else if (!user.email)
            reject({ auth: false, code: 'server_email_required', message: 'Email is required' });

        else if (!user.password)
            reject({ auth: false, code: 'server_password_required', message: 'Password is required' });

        else if (!(regexPasswordValidation.test(user.password)))
            reject({ auth: false, code: 'server_invalid_password', message: "Password is invalid" });
        
        else if (!Validator.validate(user.email))
            reject({ auth: false, code: 'server_email_not_valid', message: "Email not valid" });

        else
            resolve(true);
    });
};

//Function to save image in file
function saveImageContent(user) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {

            var dateNow = Date.now();
            var path = `/usr/src/app/img/users/${user._id}_controlcenter_${dateNow}.jpg`;
            var pathImage = '';
            var base64Image = user.imageContent.split(';base64,').pop();
            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProd}/users/${user._id}_controlcenter_${dateNow}.jpg`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProd}/users/${user._id}_controlcenter_${dateNow}.jpg`; // For Pre PROD server
            }
            else {
                //pathImage = `${process.env.HostLocal}${user._id}_controlcenter_${dateNow}.jpg`; // For local host
                pathImage = `${process.env.HostQA}/users/${user._id}_controlcenter_${dateNow}.jpg`;// For QA server
            };
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err)
                }
                else {
                    user.imageContent = pathImage;
                    resolve(user);
                };
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function getOneUser(req,res) {
    const context = "Function getOneUser"
    try {
        let fields = {
            mobile: 1,
            internationalPrefix: 1,
            imageContent: 1,
            name: 1,
            language: 1,
            country: 1,
        }

        let foundUser = await User.findOne(req.query, fields).lean()
        return res.status(200).send(foundUser);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function getAllUsers(req,res) {
    const context = "Function getAllUsers"
    try {
        let query = req.query ? req.query : {}
        let fields = {
            mobile: 1,
            internationalPrefix: 1,
            imageContent: 1,
            name: 1,
            language: 1,
            country: 1,
        }

        let foundUsers = await User.find(query, fields).lean()
        return res.status(200).send(foundUsers);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function getOwnerIds(req,res) {
    const context = "Function getOwnerIds"
    try {
        let isAdmin = req.headers['isadmin']
        if (!isAdmin) {
            return res.status(403).send({ auth: false, code: '', message: 'Not Authorized!' })
        }
        let query = {
            active : true,
            clientType : process.env.ClientTypeB2B2C,
        }

        let fields = {
            _id : 1,
            name: 1,
        }

        let foundUsers = await User.find(query, fields).lean()
        return res.status(200).send(foundUsers.map(user => {return { name : user.name , ownerId : user._id}}));

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function updateUser(req,res) {
    const context = "PATCH /api/private/controlcenter/users - Function updateUser"
    try {
        let userId = req.headers['userid'];
        let user = req.body
        if (validateFieldsEditUser(user)) return res.status(400).send(validateFieldsEditUser(user))
        let foundUser = await User.findOne({_id: userId}).lean()
        saveUserContent(foundUser , user , userId , res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function saveUserContent(foundUser , user , userId , res) {
    const context = "Function saveUserContent"
    try {
        if (user.imageContent !== null && user.imageContent !== undefined) {
            if (user.imageContent.includes('base64')) {
                if (foundUser) {
                    user._id = userId;
                    if (foundUser.imageContent == "") {
                        user = await saveImageContent(user)
                        startUpdateUser(user, res, userId , foundUser);
                    }
                    else {
                        await removeImageContent(foundUser)
                        user = await saveImageContent(user)
                        startUpdateUser(user, res, userId , foundUser);
                    };
                } else {
                    return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
                }
            }
            else if (user.imageContent == '') {
                user._id = userId;
                if (foundUser) {
                    if (foundUser.imageContent == "") {
                        startUpdateUser(user, res, userId , foundUser);
                    }
                    else {
                        await removeImageContent(foundUser)
                        startUpdateUser(user, res, userId , foundUser);
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
                }
            } else {
                console.log("user.imageContent", user.imageContent)
                startUpdateUser(user, res, userId , foundUser);
            }
        } else {
            startUpdateUser(user, res, userId , foundUser);
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function removeImageContent(user) {
    var context = "Function removeImageContent";
    return new Promise((resolve, reject) => {
        try {

            const image = user.imageContent.split('/');

            const path = `/usr/src/app/img/users/${image[image.length - 1]}`;

            fs.unlink(path, (err) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    user.imageContent = "";
                    resolve(user);
                }
                else {
                    user.imageContent = "";
                    resolve(user);
                };
            });

        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function startUpdateUser(user, res, userId , userFound) {
    var context = "Function startUpdateUser";
    try {
        let userToUpdate;
        let query = {_id: userId}

        if (user.name === userFound.name && user.email === userFound.email && user.mobile === userFound.mobile && user.internationalPrefix === userFound.internationalPrefix) {
            let values = await updateUsers(query, user)
            if (values) {
                return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
            } else {
                return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
            }
        } else if (user.name !== userFound.name && user.email === userFound.email && user.mobile === userFound.mobile && user.internationalPrefix === userFound.internationalPrefix) {
            console.log("Change only name")
            userToUpdate = {
                name: user.name,
                email: userFound.email,
            };

            let result = await changeName(userToUpdate)
            if (result) {
                updateUsers(query, user);
                let host = process.env.HostChargers + process.env.PathUpdateOperatorInfo
                Utils.patchRequest(host, { operatorId : userId , operator : user.name})
                return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
            } else {
                return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
            }

        } else if (user.name !== userFound.name && user.email !== userFound.email && user.mobile === userFound.mobile && user.internationalPrefix === userFound.internationalPrefix) {
            console.log("Change name and email")

            let existingUser = await User.findOne({ email: user.email, active: true, _id: { $ne: userId } }).lean()
            if (existingUser) {
                return res.status(400).send({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
            } else {
                userToUpdate = {
                    _id: userFound._id,
                    name: user.name,
                    email: user.email,
                };
                let oldEmail = userFound.email

                let result = await changeNameEmail(userToUpdate , oldEmail)
                if (result) {
                    user.active = false
                    user.changedEmail = true
                    updateUsers(query, user);
                    userCodeChangeEmail({...userToUpdate , language : userFound.language}, 'EVIO');
                    validTokens.disableTokens(userToUpdate._id)
                    let host = process.env.HostChargers + process.env.PathUpdateOperatorInfo
                    Utils.patchRequest(host, { operatorId : userId , operator : user.name , operatorEmail :  user.email})
                    return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                } else {
                    return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                }

            };
        } else if (user.name === userFound.name && user.email !== userFound.email && user.mobile === userFound.mobile && user.internationalPrefix === userFound.internationalPrefix) {
            console.log("Only Email")

            let existingUser = await User.findOne({ email: user.email, active: true , _id: { $ne: userId } }).lean()
            if (existingUser) {
                return res.status(400).send({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });
            } else {

                userToUpdate = {
                    _id: userFound._id,
                    name: userFound.name,
                    email: user.email,
                };
                let oldEmail = userFound.email

                let result = await changeNameEmail(userToUpdate , oldEmail)
                if (result) {
                    user.active = false
                    user.changedEmail = true
                    updateUsers(query, user);
                    userCodeChangeEmail({...userToUpdate , language : userFound.language}, 'EVIO');
                    validTokens.disableTokens(userToUpdate._id)
                    let host = process.env.HostChargers + process.env.PathUpdateOperatorInfo
                    Utils.patchRequest(host, { operatorId : userId , operatorEmail :  user.email})
                    return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                } else {
                    return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                }

            };
        } else if (user.name === userFound.name && user.email === userFound.email && (user.mobile !== userFound.mobile || user.internationalPrefix !== userFound.internationalPrefix)) {
            console.log("Only Mobile")

            let existingUser = await User.findOne({ mobile: user.mobile, internationalPrefix: user.internationalPrefix, active: true , _id: { $ne: userId } }).lean()
            if (existingUser) {
                return res.status(400).send({ auth: false, code: 'server_mobile_use', message: "Mobile is already in use!" });
            } else {

                userToUpdate = {
                    _id: userFound._id,
                    email : userFound.email,
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                };

                let result = await updateMobileLdap(userToUpdate)
                if (result) {
                    updateUsers(query, user);
                    let host = process.env.HostChargers + process.env.PathUpdateOperatorInfo
                    Utils.patchRequest(host, { operatorId : userId , operatorContact : user.mobile})
                    return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                } else {
                    return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                }
            };

        } else if (user.name !== userFound.name && user.email === userFound.email && (user.mobile !== userFound.mobile || user.internationalPrefix !== userFound.internationalPrefix)) {
            console.log("Name and Mobile")

            let existingUser = await User.findOne({ mobile: user.mobile, internationalPrefix: user.internationalPrefix, active: true , _id: { $ne: userId } }).lean()
            if (existingUser) {
                return res.status(400).send({ auth: false, code: 'server_mobile_use', message: "Mobile is already in use!" });
            } else {

                userToUpdate = {
                    _id: userFound._id,
                    email : userFound.email,
                    name: user.name,
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                };

                let result = await updateMobileNameLdap(userToUpdate)
                if (result) {
                    updateUsers(query, user);
                    let host = process.env.HostChargers + process.env.PathUpdateOperatorInfo
                    Utils.patchRequest(host, { operatorId : userId , operator : user.name , operatorContact : user.mobile})
                    return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });
                } else {
                    return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });
                }
                
            };


        } else {

            let useEmail = await User.findOne({ email: user.email, active: true , _id: { $ne: userId } }).lean()
            let useMobile = await User.findOne({ mobile: user.mobile, internationalPrefix: user.internationalPrefix, active: true , _id: { $ne: userId } }).lean()

            if (useEmail && useMobile) {

                return res.status(400).send({ auth: false, code: 'server_mobile_email_use', message: "Mobile and Email are already in use!" });

            } else if (useEmail && !useMobile) {

                return res.status(400).send({ auth: false, code: 'server_mobile_use', message: "Mobile is already in use!" });

            } else if (!useEmail && useMobile) {

                return res.status(400).send({ auth: false, code: 'server_email_taken', message: 'Email ' + user.email + ' is already registered' });

            } else {

                let oldEmail = userFound.email

                userToUpdate = {
                    _id: userFound._id,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                };

                let result = await updateMobileNameEmailLdap(userToUpdate , oldEmail)
                if (result) {
                    user.active = false
                    user.changedEmail = true
                    updateUsers(query, user);
                    userCodeChangeEmail({...userToUpdate , language : userFound.language}, 'EVIO');
                    validTokens.disableTokens(userToUpdate._id)
                    let host = process.env.HostChargers + process.env.PathUpdateOperatorInfo
                    Utils.patchRequest(host, { operatorId : userId , operator : user.name , operatorEmail :  user.email , operatorContact : user.mobile})
                    return res.status(200).send({ auth: true, code: 'server_user_updated', message: 'User updated' });

                } else
                    return res.status(400).send({ auth: false, code: 'server_user_not_updated', message: 'User not updated' });

            };

        };
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
};

function updateUsers(query, user) {
    var context = "Function updateUsers";
    return new Promise((resolve, reject) => {
        User.findOneAndUpdate(query, user, { new: true }, (err, result) => {
            if (err) {
                console.error(`[${context}][updateUser] Error `, err.message);
                reject(err);
            }
            else {
                if (result) {
                    user.mobile = result.mobile;
                    resolve(result);
                }
                else
                    resolve(false);
            };
        });
    });
};

//Function to change email and name on Ldap
function changeNameEmail(user , oldEmail) {
    var context = "Function changeNameEmail";
    return new Promise((resolve, reject) => {
        try {
            // Update users name anda mail
            const controller = Ldap();
            var changeUser = new User({
                name: user.name,
                email: user.email,
            });
            controller.updateldapNameEmail(changeUser , oldEmail)
                .then((result) => {
                    if (result) {
                        resolve(result);
                    }
                    else {
                        reject(null);
                    }
                })
                .catch((error) => {
                    console.error(`[${context}][updateldapNameEmail][.catch] Error `, error.message);
                    reject(error);
                });
        } catch (err) {
            console.error(`[${context}] Error `, err.message);
            reject(error);
        };
    });
};

//Function to change name on Ldap
function changeName(user) {
    var context = "Function changeName";
    return new Promise((resolve, reject) => {
        try {
            // Update users name anda mail
            const controller = Ldap();
            var changeUser = new User({
                name: user.name,
                email: user.email,
            });
            controller.updateldapName(changeUser)
                .then((result) => {
                    if (result) {
                        resolve(result);
                    }
                    else {
                        reject(null);
                    }
                })
                .catch((error) => {
                    console.error(`[${context}][updateldapName][.catch] Error `, error.message);
                    reject(error);
                });
        } catch (err) {
            console.error(`[${context}] Error `, err.message);
            reject(err);
        };
    });
};

function validateFieldsEditUser(userClient) {
    const context = "Function validateFieldsEditUser"
    try {
        let fieldsToUpdate = [
            "email",
            "name",
            "country",
            "language",
            "imageContent",
            "mobile",
            "internationalPrefix",
        ]
        if (!userClient) {
            return { auth: false, code: 'server_user_required', message: 'User data is required' }
        } else if (!userClient.name) {
            return { auth: false, code: 'server_name_required', message: 'Name is required' }
        } else if (!userClient.email) {
            return { auth: false, code: 'server_email_required', message: 'Email is required' }
        } else if (!userClient.mobile) {
            return { auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' }
        } else if (!userClient.internationalPrefix) {
            return { auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' }
        } else {
            let notAllowedKey = Object.keys(userClient).find(key => !fieldsToUpdate.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be updated` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

async function deleteUser(req,res) {
    const context = "DELETE /api/private/controlcenter/users - Function deleteUser"
    try {
        let userId = req.headers['userid'];
        let userFound = await User.findOne({_id: userId}).lean()
        removeUser(userFound , userId , res )
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function removeUser(userFound , userId , res ) {
    const context = "Function removeUser"
    try {
        if (userFound) {
            //Disable all user tokens
            validTokens.disableTokens(userId);

            //Remove user from Ldap
            const controller = Ldap();
            await controller.removeUser(userFound)

            //Remove user from mongoDB
            const mongocontroller = MongoDb();
            await mongocontroller.deletemongoUser(userFound)

            return res.status(200).send({ auth: true, code: 'server_user_deleted', message: 'User deleted' });
        } else {
            return res.status(400).send({ auth: false, code: 'server_users_not_found', message: "Users not found for given parameters" });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function userCodeChangeEmail(user, clientName) {
    var context = "Function userCodeChangeEmail";
    try {
        //Generating code
        var code = getRandomInt(10000, 100000);

        var activation = new Activation({
            code: code,
            userId: user._id
        });

        Activation.createActivation(activation, (error, result) => {
            if (error) {
                console.error(`[${context}] Error`, error)
            }
            if (result) {
                sendActivationEmail(user, code, "activeAccountChangeEmail", clientName)
                    .then(() => {
                        console.log("Email sent successfully!");
                    })
                    .catch(() => {
                        console.log("Email sent unsuccessfully!");
                    })
            }
            else
                console.log("Email sent unsuccessfully!");
        });

    } catch (error) {
        console.error(`[${context}] Error`, error)
    };
};

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

function sendActivationEmail(user, code, action, clientName) {
    var context = "Function sendActivationEmail";
    return new Promise((resolve, reject) => {
        var host = process.env.HostNotifications + process.env.PathSendEmail;

        console.log(user.name)

        var mailOptions = {
            to: user.email,
            message: {
                username: user.name,
                passwordCode: code
            },
            type: action,
            mailLanguage: user.language,
        };

        let headers = {
            clientname: clientName
        }

        axios.post(host, { mailOptions }, { headers })
            .then((result) => {
                if (result)
                    resolve();
                else
                    reject();
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

//Function to change mobile on Ldap
function updateMobileLdap(user) {
    var context = "Function updateMobileLdap";
    return new Promise((resolve, reject) => {
        try {
            //Update users mobile
            const controller = Ldap();

            var changeUser = new User({
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                email : user.email,
            });

            controller.updateMobielldapUser(changeUser)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    console.error(`[${context}][updateMobielldapUser] Error `, err.message);
                    reject(err);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function updateMobileNameLdap(user) {
    var context = "Function updateMobileNameLdap";
    return new Promise((resolve, reject) => {
        try {
            //Update users mobile
            const controller = Ldap();

            var changeUser = new User({
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                name: user.name,
                email: user.email,
            });

            controller.updateMobielNameLdapUser(changeUser)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    console.error(`[${context}][updateMobielNameLdapUser] Error `, err.message);
                    reject(err);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function updateMobileNameEmailLdap(user, oldEmail) {
    var context = "Function updateMobileLdap";
    return new Promise((resolve, reject) => {
        try {
            //Update users mobile
            const controller = Ldap();

            var changeUser = new User({
                mobile: user.mobile,
                internationalPrefix: user.internationalPrefix,
                name: user.name,
                email: user.email
            });

            controller.updateMobielNameEmailLdapUser(changeUser,oldEmail)
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    console.error(`[${context}][updateMobielldapUser] Error `, err.message);
                    reject(err);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

