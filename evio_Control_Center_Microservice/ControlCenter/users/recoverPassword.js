const User = require('../../models/user');
const PasswordRecovery = require('../../models/recoverPassword');
const ValidToken = require('../../models/validTokens')
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Ldap = require('./ldap');

module.exports = {
    create: (req,res) => sendRecoverPassword(req,res),
    update: (req,res) => validateRecoverPassword(req,res),
}



async function sendRecoverPassword(req,res) {
    let context = "POST /api/private/controlcenter/recoverPassword Function sendRecoverPassword";
    try {
        let email = req.body.email;

        //Fields validation
        if (validateFieldsCreate(email)) return res.status(400).send(validateFieldsCreate(email))

        //Get user ID by email
        let userFound = await getUserByEmail(email)    
        if (userFound) {
            createRecoverPassword(res , userFound)
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_user_not_found_email', message: "User not found for given email: " + email });
        };

    } catch(error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFieldsCreate(email) {
    const context = "Function validateFieldsCreate"
    try {
        if (!email) {
            return { auth: false, code: 'server_email_not_valid', message: "Email not valid" }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

function validateFieldsUpdate(email,password,recoveryCode) {
    const context = "Function validateFields"
    try {
        let regexPasswordValidation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/
        if (!email) {
            return { auth: false, code: 'server_email_required', message: "Email required" }
        } else if (!password) {
            return { auth: false, code: 'server_password_required', message: "Password required" }
        } else if (!recoveryCode) {
            return { auth: false, code: 'server_code_required', message: "Code required" }
        } else if (!(regexPasswordValidation.test(password))) {
            return { auth: false, code: 'server_invalid_password', message: "Password is invalid" }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message}
    }
};

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

async function getUserByEmail(email) {
    const context = "Function getUserByEmail"
    try {
        let query = {
            email: email,
            active: true,
            blocked : false,
        };

        let fields = {
            email : 1,
            active: 1,
            name : 1,
            mobile : 1,
            language : 1,
            _id : 1,
        };
        
        return await User.findOne(query, fields)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function getJwt(code) {
    return jwt.sign({ code }, process.env.TOKEN_RECOVERY_SECRET, { expiresIn: process.env.TOKEN_RECOVERY_LIFE });
}

async function createRecoverPassword(res , userFound) {
    const context = "Function createRecoverPassword"
    try {
        //Generating Token
        let code = getRandomInt(10000, 100000);
        const token = getJwt(code)

        //Check if has any active code of this email and update them
        PasswordRecovery.markAsUsedById(userFound._id);

        //Insert data on recovery password table
        const newPasswordRecovery = new PasswordRecovery({
            userId: userFound._id,
            code: code,
            used: false,
            token: token
        });
        let recoveryPass = await PasswordRecovery.createPasswordRecovery(newPasswordRecovery)
        // Created Successfully
        if (recoveryPass) {
            //Send email
            await sendEmail(userFound.email, code, userFound.name , userFound.language)
            // cancelFirebaseTokens(userId);
            cancelAllTokens(userFound._id);
            return res.status(200).send({ auth: true, code: 'server_email_sent_success', message: "Email sent successfully" });
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_password_not_recovery', message: "Password not recovery" });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function sendEmail(email, code, username , language) {
    var context = "Function sendEmail";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.HostNotifications + process.env.PathSendEmail;

            var mailOptions = {
                to: email,
                message: {
                    username: username,
                    passwordCode: code
                },
                type: "recoverPassword",
                mailLanguage:language,
            };

            axios.post(host, { mailOptions })
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

async function cancelAllTokens(userId) {
    var context = "Function cancelAllTokens";
    try {
        return await ValidToken.updateMany({userId}, { $set: { active: false } })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function validateRecoverPassword(req,res) {
    var context = "PUT /api/private/controlcenter/recoverPassword Function validateRecoverPassword";
    try {
        var {code , email , password } = req.body

        if (validateFieldsUpdate(email,password,code)) return res.status(400).send(validateFieldsUpdate(email,password,code))

        let userFound = await getUserByEmail(email)    
        if (userFound) {
            updateRecoverPassword(res,userFound , code , password , email)
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_user_not_found_email', message: "User not found for given email: " + email });
        };
    } catch(error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function updateRecoverPassword(res,userFound , code , password , email) {
    var context = "Function updateRecoverPassword";
    try {
        let belongs = await PasswordRecovery.checkIfCodeBelongsToUserId(code, userFound._id)
        if (belongs) {
            //Check if code was already used
            let objUsed = await PasswordRecovery.checkIfCodeWasAlreadyUsed(code)
            if (objUsed) {
                return res.status(400).send({ auth: false, code: 'server_code_already_used', message: "Provided code was already used" });
            }
            else {
                //Get Token by code
                let passwordRecovery = await PasswordRecovery.getPasswordRecoveryByCode(code)
                if (passwordRecovery) {

                    //Check token validity
                    jwt.verify(passwordRecovery.token, process.env.TOKEN_RECOVERY_SECRET, function (err, decoded) {
                        if (err) return res.status(400).send({ auth: false, code: 'server_code_expired', message: 'Code expired' });

                        // Update users password
                        const controller = Ldap();
                        var changeUser = new User({
                            userId: userFound._id,
                            email : userFound.email,
                            mobile: userFound.mobile,
                            password: password,
                            internationalPrefix: userFound.internationalPrefix
                        });

                        //get encrypted password
                        changeUser.password = User.getEncriptedPassword(changeUser.password);
                        controller.updateldapUser(changeUser)
                            .then(async (result) => {
                                // Mark code as processed
                                let resultByCode = await PasswordRecovery.getPasswordRecoveryByCode(code)
                                if (resultByCode) {
                                    return res.status(200).send({ auth: true, code: 'server_password_changed', message: 'Password changed' });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_password_changed_wrong', message: 'Password changed but something was wrong' });
                                }
                            }).catch(error => {
                                console.error(`[${context}][updateldapUser][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    });

                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_invalid_code', message: "Invalid code" });
                }
            };
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_code_dont_belongs_email', message: "Provided code don't belogns to provided email : " + email });
        }

            
    } catch (error) {

    }
}