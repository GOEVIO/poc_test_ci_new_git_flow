var Activation = require('../../models/activation');
var User = require('../../models/user');

module.exports = {
    accountActivationEmail: (req,res) => accountActivationEmail(req,res),
}

async function accountActivationEmail(req, res) {
    let context = "PATCH /api/private/controlcenter/accountActivation/email";
    try {
        let user = req.body;
        if (!user.email) {
            return res.status(400).send({ auth: false, code: 'server_email_required', message: 'Email is required' });
        } else {

            let query = {
                email: user.email
            };

            let result = await User.findOne(query)
            if (result) {
                let params = {
                    $and: [
                        {
                            userId: result._id,
                            code: user.code,
                            used: false
                        }
                    ]
                };
                let resultActivation = await Activation.findOne(params)
                if (resultActivation) {
                    let value = await updateActivation(resultActivation)
                    if (value) {
                        let newValue = { $set: { active: true, changedEmail: false } };
                        let result = await User.updateOne(query, newValue)
                        if (result) {
                            return res.status(200).send({ auth: true, code: 'server_account_successfully_activated', message: "Your account was successfully activated" });
                        } else {
                            return res.status(400).send({ auth: false, code: "server_error_activation_code", menssage: "We were unable to place your request, please try again later." })
                        }
                    } else {
                        return res.status(400).send({ auth: false, code: "server_error_activate", menssage: "We were unable to place your request, please try again later." })
                    };
                } else {
                    return res.status(400).send({ auth: false, code: 'server_invalid_code', message: "Invalid code." })
                };
            } else {
                return res.status(400).send({ auth: false, code: 'server_user_not_found', message: "User not found for given email" });
            };
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

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