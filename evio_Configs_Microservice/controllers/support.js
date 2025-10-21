require("dotenv-safe").load();
const Support = require('../models/support');

module.exports = {
    addSupport: function (req) {
        const context = "Function addSupport";
        return new Promise((resolve, reject) => {

            if (!req.body.supportEmail) {
                reject({ code: 'supportEmail_missing', message: "Support email missing" });
            }

            let clientName = req.headers['clientname'];

            let support = new Support(req.body);
            support.clientName = clientName;

            Support.createSupport(support, (err, result) => {
                if (err) {
                    console.log(`[${context}][support] Error `, err.message);
                    reject(err)
                }
                else {
                    if (result) {
                        resolve({ auth: false, code: 'support_created', message: "Support created" });
                    }
                    else {
                        reject({ auth: false, code: 'support_not_created', message: "Support not created" });
                    }
                }
            });

        });
    },
    getSupport: function (req) {
        const context = "Function getSupport";
        return new Promise((resolve, reject) => {

            console.log("req.query.clientName", req.query.clientName)
            Support.findOne({ clientName: req.query.clientName }, (err, supportFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {

                    if (supportFound) {
                        resolve(supportFound);
                    }
                    else {
                        reject({ auth: false, code: 'support_configuration_not_found', message: "Support configurations not found" });
                    }
                }
            });

        });
    },
    runFirstTime: function (req) {
        const context = "Function runFirstTime";
        return new Promise((resolve, reject) => {

            addClientName()
            resolve("ok");


        });
    },
}

function addClientName() {
    const context = "Function addClientName";
    Support.updateMany({}, { $set: { clientName: "EVIO" } }, (err, supportFound) => {
        if (err) {
            console.log(`[${context}][find] Error `, err.message);
            reject(err);
        };
        console.log("supportFound", supportFound)

    });
}