require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const Sentry = require('@sentry/node');
const User = require('../models/user');
const BillingProfile = require('../models/billingProfile');
const Contract = require('../models/contracts');
const CEMETariff = require('../models/cemeTariff');
const NifValidationLogs = require('../models/nifValidationLogs');
const soap = require('soap')
const wsdl = 'https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl'
const wsdlTin = 'https://ec.europa.eu/taxation_customs/tin/services/checkTinService.wsdl'
const axios = require("axios");
const CemeData = require('../controllers/ceme');
const addressS = require("../services/address")
const { getCode, getName } = require('country-list');
const axiosS = require("../services/axios");
const { normalizeCountryCodeToCountryName } = require("../utils")

const billingPeriodMapping = require('../models/billingProfileBillingPeriod.json');

var host;
var auth;
switch (process.env.NODE_ENV) {
    case 'production':
        console.log("Initing production environment")
        auth = {
            username: process.env.UserNameWebserviceGoCharge,
            password: process.env.KeyWebserviceGoCharge
        };
        host = process.env.HostToken;

        break;
    case 'development':
        console.log("Initing dev environment")
        auth = {
            username: process.env.UserNameWebserviceGoChargePRE,
            password: process.env.KeyWebserviceGoChargePRE
        };
        host = process.env.HostTokenTest;

        break;
    case 'pre-production':
        console.log("Initing pre environment")
        auth = {
            username: process.env.UserNameWebserviceGoChargePRE,
            password: process.env.KeyWebserviceGoChargePRE
        };
        host = process.env.HostTokenTest;

        break;
    default:
        console.log("Unknown environment")
        auth = {
            username: process.env.UserNameWebserviceGoChargePRE,
            password: process.env.KeyWebserviceGoChargePRE
        };
        host = process.env.HostTokenTest;

        break;
};

function getViesVat(countryCode, vatNumber) {
    var context = "Function getViesVat";
    return new Promise(async (resolve, reject) => {

        try {

            const client = await soap.createClientAsync(wsdl)
            const result = await client.checkVatAsync({
                countryCode: countryCode,
                vatNumber: vatNumber
            })

            resolve(result[0].valid);

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve(false);
        };

    });
    //console.log(result)
}

//========== POST ==========
//Create User Billing Profile
/**
 * @deprecated This method it's not used anymore.
 */
router.post('/api/private/billingProfile', async (req, res, next) => {
    var context = "POST /api/private/billingProfile";
    try {
        const clientName = req.headers['clientname']

        if (!req.body.userId) {
            return res.status(400).send({ code: 'userId_missing', message: "UserId missing" });
        }

        if (!req.body.nif) {
            return res.status(400).send({ code: 'nif_missing', message: "NIF missing" });
        }

        if (!req.body.billingAddress) {
            return res.status(400).send({ code: 'userId_missing', message: "UserId missing" });
        }

        if (!req.body.billingName) {
            return res.status(400).send({ code: 'billingName_missing', message: "Billing name missing" });
        }

        if(req.body.publicEntity !== undefined && typeof req.body.publicEntity !== 'boolean') {
            return res.status(400).send({ code: 'publicEntity_invalid', message: 'publicEntity is not valid, must be true or false' });                
        }

        if(req.body.companyTaxIdNumber && typeof req.body.companyTaxIdNumber !== 'string') {
            return res.status(400).send({ code: 'companyTaxIdNumber_invalid', message: 'companyTaxIdNumber is not valid, must be a string' });
        }


        const countryCode = (req.body.billingAddress.countryCode ?? req.body.countryCode) ?? "PT"
        // Issue 1444 - Quick fix from validation of NIF, this should be temporary

        const featureFlagEnabledCountry = await toggle.isEnable('fleet-489-backend-normalize-country-field-from-country-code-in-billing-address');
        if (!featureFlagEnabledCountry) {
            // Normalize country code to country name
            req.body.billingAddress.country = normalizeCountryCodeToCountryName(countryCode) || req.body.billingAddress.country;
        }

        if (countryCode === "PT") {
            if (req.body.billingAddress.zipCode) {
                const zipCode = req.body.billingAddress.zipCode.trim()
                if (!isValidPtZipCode(zipCode))
                    return res.status(400).send({ code: 'zipCode_invalid', message: "zipCode is not valid" });

                req.body.billingAddress.zipCode = zipCode
            }
        }

        let tin = {}
        if (countryCode !== "PT" && req.body.nif == process.env.defaultTIN) tin = { valid: true, countryCode, nif: req.body.nif, errorResponse: undefined }
        else tin = await validTin(wsdlTin, countryCode, req.body.nif, req.body.userId, clientName)


        if (!tin.valid) {
            return res.status(400).send(tin.errorResponse);
        }

        let billingProfile = {
            userId: req.body.userId,
            billingName: req.body.billingName,
            nif: req.body.nif,
            billingAddress: req.body.billingAddress,
            publicEntity: req.body.publicEntity ?? false,
            companyTaxIdNumber: req.body.companyTaxIdNumber ?? req.body.nif ?? null
        };

        if (req.body.email) {
            billingProfile.email = req.body.email
        }

        if (req.body.billingPeriod) {
            billingProfile.billingPeriod = req.body.billingPeriod
        }

        const new_billingProfile = new BillingProfile(billingProfile);
        BillingProfile.createBillingProfile(new_billingProfile, (err, result) => {
            if (err) {
                console.error(`[${context}][createBillingProfile] Error`, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    validateViesVAT(new_billingProfile);
                    console.error(`[${context}][createBillingProfile] Success`);
                    return res.status(200).send({ code: 'billing_profile_created', message: "Billing Profile created" });
                }
            }
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/billingProfile/runFirstTime', async (req, res, next) => {
    const context = 'POST /api/private/billingProfile/runFirstTime';
    try {
        const billingProfilesToFix = await BillingProfile.find({
            $and: [
                { viesVAT: { $exists: false } },
                { nif: { $exists: true } },
                { nif: { $ne: '' } }
            ]
        });

        console.log(`Fetched ${billingProfilesToFix?.length} billing profiles to fix.`);
        for (const billingProfile of billingProfilesToFix) {
            const result = await getViesVat(billingProfile.billingAddress.countryCode, billingProfile.nif);
            billingProfile.set('viesVAT', result);
            await billingProfile.save();
        }

        return res.status(200).send([]);
    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

// ========== PATCH ==========
// Update User Billing Profile
// Moved to routes/billingProfiles.ts

//Update monthly Billing user b2c
router.patch('/api/private/billingProfile/monthlyBilling', (req, res, next) => {
    var context = "PATCH /api/private/billingProfile/monthlyBilling";
    var userId = req.headers['userid'];
    var billingProfile = req.body;

    let query = {
        userId: userId
    };

    BillingProfile.findOneAndUpdate(query, { $set: { monthlyBilling: billingProfile.monthlyBilling } }, { new: true }, (err, billingProfile) => {
        if (err) {
            console.error(`[${context}][findOneAndUpdate] Error`, err.message);
            return res.status(500).send(err.message);
        } else {
            return res.status(200).send(billingProfile);
        };
    })

});

//Update monthly Billing user b2c
router.patch('/api/private/billingProfile/invoiceWithoutPayment', (req, res, next) => {
    var context = "PATCH /api/private/billingProfile/invoiceWithoutPayment";

    try {
        var received = req.body;
        let invoiceWithoutPayment = received.invoiceWithoutPayment
        if (invoiceWithoutPayment === null || invoiceWithoutPayment === undefined) {
            return res.status(400).send({ code: 'invoiceWithoutPayment_missing', message: "invoiceWithoutPayment missing" });
        }
        let userIds = received.userIds
        if (!userIds) {
            return res.status(400).send({ code: 'userIds_missing', message: "userIds missing" });
        }
        if (!Array.isArray(userIds)) {
            return res.status(400).send({ code: 'userIds_missing', message: "userIds is an array" });
        }

        updateInvoiceWithoutPayment(userIds, invoiceWithoutPayment)
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== GET ==========
//Get User Billing Profile
router.get('/api/private/billingProfile', (req, res, next) => {
    var context = "GET /api/private/billingProfile";
    try {

        if (!req.query.userId) {
            return res.status(400).send({ code: 'userId_missing', message: "UserId missing" });
        }

        let userId = req.query.userId;

        //console.log("userId", userId)

        BillingProfile.findOne({ userId: userId }, (error, billingProfileFound) => {
            if (error) {
                console.error(`[${context}][.then][findOne] Error `, error.message);
                return res.status(500).send(error.message);
            }
            //console.log("billingProfileFound", billingProfileFound)
            if (billingProfileFound) {

                User.findOne({ _id: userId }, (error, userFound) => {
                    if (error) {
                        console.error(`[${context}][.then][findOne] Error `, error.message);
                        return res.status(500).send(error.message);
                    }

                    if (userFound) {

                        let billingEmail;
                        if (billingProfileFound.email == undefined) {
                            //billingEmail = userFound.email;
                            billingEmail = "";
                        }
                        else {
                            billingEmail = billingProfileFound.email;
                        }

                        let billingName;
                        if (billingProfileFound.billingName == undefined || billingProfileFound.billingName == "") {
                            // billingName = userFound.name;
                            billingName = "";
                        }
                        else {
                            billingName = billingProfileFound.billingName;
                        }

                        let billingProfile = {
                            _id: billingProfileFound._id,
                            userId: billingProfileFound.userId,
                            name: userFound.name,
                            billingName: billingName,
                            email: billingEmail,
                            billingAddress: billingProfileFound.billingAddress,
                            nif: billingProfileFound.nif,
                            imageContent: userFound.imageContent,
                            mobile: userFound.mobile,
                            internationalPrefix: userFound.internationalPrefix,
                            userUpdatedAt: userFound.updatedAt,
                            billingPeriod: billingProfileFound.billingPeriod,
                            //finalConsumer: billingProfileFound.finalConsumer
                            purchaseOrder: billingProfileFound.purchaseOrder,
                            clientName: userFound.clientName,
                            clientType: billingProfileFound.clientType,
                            companyTaxIdNumber: billingProfileFound.companyTaxIdNumber ?? billingProfileFound.nif ?? null,
                            publicEntity: billingProfileFound.publicEntity,
                            status: billingProfileFound.status,
                            viesVAT: billingProfileFound.viesVAT,  
                            paymentConditions: billingProfileFound?.paymentConditions                          
                        }
                        return res.status(200).send(billingProfile);

                    }
                    else {
                        return res.status(400).send({ code: 'billing_profile_fetch_failed', message: "Billing Profile fetch failed" });
                    }

                });

            }
            else {

                return res.status(400).send({ code: 'billing_profile_fetch_failed', message: "Billing Profile fetch failed" });
            }

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get Billing Profiles
router.post('/api/private/billingProfile/manyProfiles', (req, res, next) => {
    var context = "POST /api/private/billingProfile/manyProfiles";
    var userIds = req.body._id;

    BillingProfile.find({ userId: { $in: userIds } }, (err, result) => {
        if (err) {
            console.error(`[${context}][find] Error`, err.message);
            return res.status(500).send(err.message);
        } else {
            return res.status(200).send(result);
        };
    })

});

router.get('/api/private/billingProfile/validateBillingProfile', (req, res, next) => {
    var context = "GET /api/private/billingProfile/validateBillingProfile";
    try {

        var userId = req.headers['userid'];

        var query = {
            userId: userId,
            nif: { "$exists": true, "$ne": "" },
            email: { "$exists": true, "$ne": "" }
        };

        BillingProfile.findOne(query, (err, billingProfileFound) => {
            if (err) {
                console.error(`[${context}][.then][findOne] Error`, err.message);
                return res.status(500).send(err.message);
            }
            else {

                if (billingProfileFound) {
                    //if billingprofile valid
                    return res.status(200).send(billingProfileFound);
                }
                else {
                    //if not valid
                    return res.status(200).send(null);
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get monthly billing
router.get('/api/private/billingProfile/monthlyBilling/:userId', (req, res, next) => {
    var context = "GET /api/private/billingProfile/monthlyBilling/:userId";
    var userId = req.params.userId;

    BillingProfile.findOne({ userId: userId }, { monthlyBilling: 1 }, (err, billingProfileFound) => {
        if (err) {
            console.error(`[${context}][findOne] Error`, err.message);
            return res.status(500).send(err.message);
        } else {
            return res.status(200).send(billingProfileFound);
        };
    })

});

//Get monthly billing all true B2C
router.get('/api/private/billingProfile/monthlyBilling', (req, res, next) => {
    var context = "GET /api/private/billingProfile/monthlyBilling";

    BillingProfile.find({ monthlyBilling: true }, (err, billingProfilesFound) => {
        if (err) {
            console.error(`[${context}][find] Error`, err.message);
            return res.status(500).send(err.message);
        } else {
            return res.status(200).send(billingProfilesFound);
        };
    })

});

//Get available billing periods
router.get('/api/private/billingProfile/billingPeriods', (req, res, next) => {
    var context = "GET /api/private/billingProfile/billingPeriods";

    try {
        return res.status(200).send(billingPeriodMapping);
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    }

});

//Get all valid billing profiles for monthly B2C
router.get('/api/private/billingProfile/validPeriodBillingProfiles', async (req, res, next) => {
    var context = "GET /api/private/billingProfile/validPeriodBillingProfiles";
    let billingPeriods = req.body.billingPeriods
    let userId = req.body.forcedUserId
    let query = {
        $and: [
            { clientName: process.env.clientNameSC },
            { billingPeriod: { $in: billingPeriods } },
            { nif: { "$exists": true, "$ne": "" } },
            { email: { "$exists": true, "$ne": "" } },
            { billingName: { "$exists": true, "$ne": "" } },
            { billingAddress: { "$exists": true } },
            { "billingAddress.zipCode": { "$exists": true, "$ne": "" } },
            { "billingAddress.street": { "$exists": true, "$ne": "" } },
            { "billingAddress.city": { "$exists": true, "$ne": "" } },
            userId ? { userId: userId } : { userId: { $ne: process.env.EVIOB2BACOUNT } }
        ]
    };
    try {

        const billingProfilesFound = await BillingProfile.find(query).lean()

        if (!userId) {
            userId = [];

            billingProfilesFound.forEach(billingProfile => {
                userId.push(billingProfile.userId)
            });
        }

        query = {_id: userId}

        let fields = {
            mobile: 1,
            internationalPrefix: 1,
            imageContent: 1,
            name: 1,
            language: 1,
            country: 1,
            clientType: 1,
            clientName: 1,
            operatorId: 1,
            paymentPeriod: 1,
            companyTaxIdNumber:1,
            publicEntity:1
        }

        const users = await User.find(query, fields).lean()

        let finalData = []

        billingProfilesFound.forEach(billingProfile => {
            for (let i = 0; i != users.length; i++) {
                if (users[i]._id == billingProfile.userId) {
                    finalData.push({
                        "billingProfile": billingProfile,
                        "user": users[i]
                    })

                    break
                }
            }

        });

        // console.log("finalData")

        // console.log(JSON.stringify(finalData))

        return res.status(200).send(finalData);
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    }
});

// Check Tax Identification Number
router.get('/api/private/billingProfile/validateNif', async (req, res, next) => {
    const context = "GET /api/private/billingProfile/validateNif";
    try {
        const { countryCode, nif } = req.query
        const userId = req.headers['userid'];
        const clientName = req.headers['clientname'];
        if (!nif) {
            return res.status(400).send({ code: 'nif_missing', message: "NIF missing" });
        }

        if (!countryCode) {
            return res.status(400).send({ code: 'server_countryCode_required', message: "countryCode required" });
        }

        // Issue 1444 - Quick fix from validation of NIF, this should be temporary
        let tin = {}
        if (countryCode !== "PT" && nif == process.env.defaultTIN) tin = { valid: true, countryCode, nif: nif, errorResponse: undefined }
        else tin = await validTin(wsdlTin, countryCode, nif, userId, clientName)
        return res.status(!tin.valid ? 400 : 200).send(!tin.valid ? tin.errorResponse : tin);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== DELETE ==========
//Delete User Billing Profile
router.delete('/api/private/billingProfile', (req, res, next) => {
    var context = "DELETE /api/private/billingProfile";
    try {

        if (!req.query.billingProfileId) {
            return res.status(400).send({ code: 'billingProfileId_missing', message: "Id missing" });
        }

        BillingProfile.removeBillingProfile({ _id: req.query.billingProfileId }, (error, billingProfileDeleted) => {
            if (error) {
                console.error(`[${context}][.then][findOne] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {

                console.log(billingProfileDeleted);

                if (billingProfileDeleted) {
                    return res.status(200).send({ code: 'billing_profile_delete_sucess', message: "Billing Profile delete successfully" });
                }
                else {
                    return res.status(400).send({ code: 'billing_profile_delete_failed', message: "Billing Profile fetch failed" });
                }
            }
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
function addAddressToContracts(body, userId) {
    var context = "Function addAddressToContracts";

    var query = {
        userId: userId,
        address: undefined
    };

    var newValues = { $set: { address: body.billingAddress, nif: body.nif } };

    Contract.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][updateMany] Error `, err.message);
        }
        else {

            console.log(`[${context}] Address updated `);

        };
    });

};

function updateUsersBillingProfiles() {

    User.find({}, function (err, users) {
        if (err) {
            console.error(`[${context}][findOne] Error `, err.message);
        }
        else {
            if (users.length !== 0) {

                users.forEach(user => {

                    BillingProfile.findOne({ userId: user._id }, function (err, billingProfile) {
                        if (err) {
                            console.error(`[${context}][findOne] Error `, err.message);
                        }
                        else {
                            if (billingProfile) {
                                console.log("Billing Profile already exists");
                            }
                            else {

                                let billingProfile = {
                                    userId: user._id
                                }

                                let new_billingProfile = new BillingProfile(billingProfile);
                                BillingProfile.createBillingProfile(new_billingProfile, (err, result) => {
                                    if (err) {
                                        console.log(`[createBillingProfile] Error `, err.message);
                                    }
                                    else {
                                        if (result) {
                                            console.log(`[createBillingProfile] Success`);
                                        }
                                    }
                                });

                            }
                        }
                    })

                })
            }
        }
    })
}

//updateUsersBillingProfiles();
//addViesVAT();
function addViesVAT() {
    var context = "Function addViesVAT";

    BillingProfile.find({}, (err, result) => {

        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            if (result.length > 0) {
                result.map(user => validateViesVAT(user))
            }
        };

    })


}

function validateViesVAT(user) {
    var context = "Function validateViesVAT";

    if (user.nif != "" && user.nif != undefined) {

        getViesVat(user.billingAddress.countryCode, user.nif)
            .then(response => {

                BillingProfile.updateBillingProfile({ _id: user._id }, { $set: { viesVAT: response } }, (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("Vies VAT updated");
                    };
                })
            })
    }


}

//getViesVat('PT', '515681890')
//getViesVat('PT', '209899719')

//addMonthlyBilling();
function addMonthlyBilling() {
    var context = "PATCH addMonthlyBilling";
    BillingProfile.updateMany({}, { $set: { monthlyBilling: false } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            console.log("result", result);
        };
    })
}

//addBillingPeriod();
function addBillingPeriod() {
    var context = "PATCH addBillingPeriod";
    BillingProfile.updateMany({}, { $set: { billingPeriod: 'AD_HOC' } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            console.log("result", result);
        };
    })
}

//addFinalConsumer();
function addFinalConsumer() {
    var context = "PATCH addFinalConsumer";
    BillingProfile.updateMany({}, { $set: { finalConsumer: false } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            console.log("result", result);
        };
    })
}

async function updateInvoiceWithoutPayment(userIdsList, invoiceWithoutPayment) {
    var context = "PATCH updateInvoiceWithoutPayment";
    let response = { updatedBillingProfiles: [], failedBillingProfiles: [] }
    try {
        for (let userId of userIdsList) {
            let found = await BillingProfile.findOneAndUpdate({ userId }, { $set: { invoiceWithoutPayment } }, { new: true })
            if (found) {
                response.updatedBillingProfiles.push(userId)
            } else {
                response.failedBillingProfiles.push(userId)
            }
        }
        return response
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return response
    }
}

function addBillingPeriodB2B() {
    var context = "FUNCTION addBillingPeriodB2B";

    User.find({ clientType: "b2b" }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        console.log(result.length)
        if (result.length > 0) {
            result.map(user => {

                BillingProfile.updateBillingProfile({ userId: user._id }, { $set: { billingPeriod: "MONTHLY" } }, { new: true }, (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    if (result) {
                        console.log("billingProfile updated", result)
                    }

                });
            });
        };
    });
};

function updateUserType(userBilling) {
    var context = "FUNCTION updateUserType";

    var userId = userBilling.userId;
    var firstNumber;
    var userType;

    if (userBilling.nif) {
        var nif = userBilling.nif.trim();

        if (nif[0] === "-") {
            firstNumber = nif[1];
        } else {
            firstNumber = nif[0];
        };

        switch (firstNumber) {
            case "5":
                userType = process.env.UserTypeCompany;
                break;
            case "6":
                userType = process.env.UserTypeCompany;
                break;
            default:
                userType = process.env.UserTypeFinalCostumer;
                break;
        };

    } else {

        userType = process.env.UserTypeFinalCostumer;

    };

    User.findOneAndUpdate({ _id: userId }, { $set: { userType: userType } }, { new: true }, (err, userUpdated) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        } else {
            UpdatedContracts(userUpdated);
            console.log("User updated")
        };
    });

};

//addUserType()
function addUserType() {
    var context = "FUNCTION addUserType";

    var query = {
        // nif: { "$exists": true, "$ne": "" }
    };

    BillingProfile.find(query, (err, usersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };
        if (usersFound.length > 0) {

            usersFound.forEach(user => {
                updateUserType(user);
            });

        };

    });
};

function UpdatedContracts(user) {
    var context = "FUNCTION UpdatedContracts";
    try {

        if (user) {
            var query = {
                userId: user._id,
                networks: {
                    $elemMatch: {
                        network: process.env.NetworkMobiE,
                        tokens: {
                            $elemMatch: {
                                tokenType: process.env.TokensTypeApp_User,
                                status: { $ne: process.env.NetworkStatusInactive }
                            }
                        }
                    }
                }
            };

            Contract.find(query, async (err, contractsFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                };

                let CEME;

                if (contractsFound.length === 0) {

                    CEME = await CemeData.getCEMEEVIOADHOC(user.clientName);

                } else {

                    CEME = await CemeData.getCEMEEVIONormal(user.clientName, user.userType, user.activePartner);

                    /*switch (user.clientName) {
                        case process.env.WhiteLabelGoCharge:
                            if (user.userType === process.env.UserTypeCompany) {
                                CEME = await getCEMEEVIONormal("server_plan_EVIO_company_goCharge");
                            } else {
                                CEME = await getCEMEEVIONormal("server_plan_EVIO_finalCostumer_goCharge");
                            };
                            break;
                        case process.env.WhiteLabelHyundai:
                            if (user.userType === process.env.UserTypeCompany) {
                                CEME = await getCEMEEVIONormal("server_plan_EVIO_company_hyundai");
                            } else {
                                CEME = await getCEMEEVIONormal("server_plan_EVIO_finalCostumer_hyundai");
                            };
                            break;
                        default:
                            if (user.userType === process.env.UserTypeCompany) {
                                CEME = await getCEMEEVIONormal("server_plan_EVIO_company");
                            } else {
                                CEME = await getCEMEEVIONormal("server_plan_EVIO");
                            };
                            break;
                    };*/



                };
                let newValues = {
                    tariff: {
                        power: 'all',
                        planId: CEME.plan._id
                    }
                };

                Contract.updateMany({ userId: user._id }, { $set: newValues }, (err, result) => {
                    if (err) {

                        console.error(`[${context}][Contract.updateMany] Error `, err.message);

                    };

                    if (result) {
                        CEMETariff.updateMany({ userId: user._id }, { $set: newValues }, (err, result) => {

                            if (err) {
                                console.error(`[${context}][CEMETariff.updateMany] Error `, err.message);
                            }
                            if (result) {
                                console.log("Ceme tariff updated")
                            } else
                                console.log("Ceme tariff not updated")

                        });

                    } else
                        console.log("Contract not updated")

                });

            });
        };

    } catch (error) {
        console.error(`[${context}][] Error `, error.message);
    }
};

function getCEMEEVIOADHOC(clientName) {
    const context = "Function getCEMEEVIOADHOC";
    return new Promise((resolve, reject) => {

        let params;

        switch (clientName) {
            case process.env.WhiteLabelGoCharge:
                params = {
                    planName: "server_plan_EVIO_ad_hoc_goCharge"
                };
                break;
            case process.env.WhiteLabelHyundai:
                params = {
                    planName: "server_plan_EVIO_ad_hoc_hyundai"
                };
                break;
            default:
                params = {
                    planName: "server_plan_EVIO_ad_hoc"
                };
                break;
        };

        let host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function getCEMEEVIONormal(planName) {
    var context = "Function getCEMEEVIONormal";
    return new Promise((resolve, reject) => {

        var params = {
            planName: planName
        };

        var host = process.env.HostPublicTariff + process.env.PathGetTariffByCEME;

        axios.get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                reject(error);
            });
    });
};

async function processBilling(userId) {
    const context = "Function processBilling";
    let host = process.env.HostConnetionStation + process.env.PathPeriodBillingForceRun;
    let data = {
        billingPeriods: [
            "AD_HOC"
        ],
        userId: userId
    };
    try {
        let response = await axios.post(host, data);
        console.log("response", response.data);
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
    };
};

async function updateFavoriteAddress(billingProfile, userId) {
    const context = "Function updateFavoriteAddress";
    return new Promise(async (resolve, reject) => {
        try {

            let listOfAddresses = await getAddressCaetanoGo(userId);
            let response;
            console.log("listOfAddresses", listOfAddresses);
            if (listOfAddresses.length > 0) {

                let found = listOfAddresses.find(address => {
                    return address.favourite === "1";
                })

                if (found) {

                    response = await updateAddress(billingProfile, found, userId);
                    console.log("1 response", response)
                    resolve(response);

                } else {

                    response = await addAddress(billingProfile, userId);
                    console.log("2 response", response)
                    resolve(response);

                };

            } else {

                response = await addAddress(billingProfile, userId);
                console.log("3 response", response)
                resolve(response);

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getAddressCaetanoGo(userId) {
    const context = "Function getAddressCaetanoGo";
    return new Promise(async (resolve) => {
        try {

            let userFound = await User.findOne({ _id: userId }, { _id: 1, idGoData: 1 })

            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/`;

            let resultAdrress = await axios.get(hostAddresses, { auth });

            if (resultAdrress.data._status === "success") {

                resolve(resultAdrress.data.data);

            } else {

                resolve([])

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve([])
        }
    });
};

function addAddress(billingProfile, userId) {
    const context = "Function addAddress";
    return new Promise(async (resolve) => {
        try {

            let userFound = await User.findOne({ _id: userId }, { _id: 1, idGoData: 1, name: 1 })

            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/`;

            //console.log("hostAddresses", hostAddresses);

            let address = addressS.parseAddressStreetToString(billingProfile.billingAddress)

            let data = {
                "custom_name": "Home",
                "name": userFound.name,
                "vat": billingProfile.nif,
                "address": address,
                "postal_code": billingProfile?.billingAddress?.zipCode ?? billingProfile?.billingAddress?.postCode ,
                "locality": billingProfile?.billingAddress?.city,
                "district": billingProfile?.billingAddress?.state ? billingProfile?.billingAddress?.state : billingProfile?.billingAddress?.city,
                "country": billingProfile?.billingAddress?.countryCode,
                "favourite": "1"
            };

            let resultAdrress = await axios.put(hostAddresses, data, { auth });
            //console.log("resultAdrress", context, " ", resultAdrress.data)
            if (resultAdrress.data._status === "success") {
                resolve(true);
            } else {
                resolve(false);
            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(false);
        }
    });
};

function updateAddress(billingProfile, found, userId) {
    const context = "Function updateAddress";
    return new Promise(async (resolve) => {
        try {

            let userFound = await User.findOne({ _id: userId }, { _id: 1, idGoData: 1, name: 1 })

            let hostAddresses = `${host}/user/${userFound.idGoData.access_token}/addresses/${found.id}/`;

            let address = addressS.parseAddressStreetToString(billingProfile.billingAddress)

            let data = {
                "custom_name": "Home",
                "name": userFound.name,
                "vat": billingProfile.nif,
                "address": address,
                "postal_code": billingProfile?.billingAddress?.zipCode ?? billingProfile?.billingAddress?.postCode ,
                "locality": billingProfile?.billingAddress?.city,
                "district": billingProfile?.billingAddress?.state ? billingProfile?.billingAddress?.state : billingProfile?.billingAddress?.city,
                "country": billingProfile?.billingAddress?.countryCode
            };

            console.log("data", data);

            let resultAdrress = await axios.patch(hostAddresses, data, { auth });

            console.log("resultAdrress", context, " ", resultAdrress.data)
            if (resultAdrress.data._status === "success") {
                resolve(true);
            } else {
                resolve(false);
            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(false);
        }
    });
};

async function validTin(host, countryCode, tinNumber, userId, clientName) {
    const context = "Function validTin"
    try {
        const client = await soap.createClientAsync(host)
        const result = await client.checkTinAsync({ countryCode: countryCodeIsoToEU(countryCode), tinNumber })
        const valid = result[0].validStructure && result[0].validSyntax
        createNifValidationLog(result, valid, countryCode, tinNumber, userId, clientName)
        return { valid, countryCode, nif: tinNumber, errorResponse: !valid ? { code: 'billingProfile_nif_invalid', message: "Invalid Tax Number" } : undefined }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        createNifValidationLog(error.message, false, countryCode, tinNumber, userId, clientName)
        return { valid: false, countryCode, nif: tinNumber, errorResponse: { code: 'billingProfile_nif_api_error', message: "We are sorry but it is not possible to fulfill your request at this time. Please try again later" } }
    }
}

async function createNifValidationLog(result, valid, countryCode, tinNumber, userId, clientName) {
    const context = "Function createNifValidationLog"
    try {
        const found = await NifValidationLogs.findOne({ userId, clientName }).lean()
        if (found) {
            const validationLog = {
                valid,
                countryCode,
                tinNumber,
                result: JSON.parse(JSON.stringify(result)),
                date: new Date().toISOString()
            }
            await NifValidationLogs.updateOne({ _id: found._id }, { $push: { tries: validationLog } })
        } else {
            const createdLog = new NifValidationLogs({
                userId,
                clientName,
                tries: {
                    valid,
                    countryCode,
                    tinNumber,
                    result: JSON.parse(JSON.stringify(result)),
                    date: new Date().toISOString()
                }
            })
            await createdLog.save()
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message)
    }
}

function countryCodeIsoToEU(countryCode) {
    const context = "Function countryCodeIsoToEU"
    try {
        switch (countryCode) {
            case 'GR':
                return 'EL'
            default:
                return countryCode
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return countryCode
    }
}

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await BillingProfile.updateMany({ 'billingAddress.address': { '$exists': true } }, [{ $set: { 'billingAddress.street': "$billingAddress.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result billingAddress.address to billingAddress.street: ", result);
            };
        })

        await BillingProfile.updateMany({ 'billingAddress.postCode': { '$exists': true } }, [{ $set: { 'billingAddress.zipCode': "$billingAddress.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result billingAddress.postCode to billingAddress.zipCode: ", result);
            };
        })

        let billingProfiles = await BillingProfile.find({ 'billingAddress.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != billingProfiles.length; i++) {
            if (billingProfiles[i].billingAddress)
                if (billingProfiles[i].billingAddress.country)
                    if (unicCountries.indexOf(billingProfiles[i].billingAddress.country) == -1) {
                        unicCountries.push(billingProfiles[i].billingAddress.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await BillingProfile.updateMany({ 'billingAddress.country': unicCountries[i] }, [{ $set: { 'billingAddress.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

async function updateZipCode() {

    const query = {
        $and: [
            {
                'billingAddress.zipCode':
                {
                    $not:
                        //this expression catches any string that is complient with the zipCode 4 numbers "-" 3 numbers
                        { $regex: '^[0-9]{4}-[0-9]{3}$' }
                }
            },
            { 'billingAddress.zipCode': { $exists: true } },
            { 'billingAddress.countryCode': 'PT' }
        ]
    }

    const billingProfiles = await BillingProfile.find(query)

    let billingProfilesWithProblem = []

    billingProfiles.forEach(async billingProfile => {

        let zipCode = billingProfile.billingAddress.zipCode.trim()

        //this expression catches  any string that is similar with the zipCode 4 numbers any character 3 numbers
        if (/^[0-9]{4}.[0-9]{3}$/.test(zipCode)) {
            zipCode = zipCode.slice(0, 4) + "-" + zipCode.slice(5);
        }
        //this expression catches  any string that is similar with the zipCode 7 numbers 
        else if (/^[0-9]{7}$$/.test(zipCode)) {
            zipCode = zipCode.slice(0, 4) + "-" + zipCode.slice(4);
        }
        else {
            billingProfilesWithProblem.push({
                "_id": billingProfile._id,
                "userId": billingProfile.userId,
                "zipCode": zipCode
            })
        }

        await BillingProfile.updateOne({ _id: billingProfile._id }, { $set: { 'billingAddress.zipCode': zipCode } })

    });

    return billingProfilesWithProblem;
}

async function removePostCode() {

    const query = { 'billingAddress.postCode': { $exists: true } }

    const billingProfiles = await BillingProfile.find(query);

    billingProfiles.forEach(async billingProfile => {

        let billingAddressV2 = JSON.parse(JSON.stringify(billingProfile.billingAddress))

        delete billingAddressV2.postCode

        await BillingProfile.updateOne({ _id: billingProfile._id }, { $set: { 'billingAddress': billingAddressV2  } });

    });

    return
}

async function updateUserHyundai(userId) {
	const context = "Function hyundaiPutData";

	try {
		const tokenInfo = await hyundaiGetToken();
		const { _id, idHyundaiCode, internationalPrefix, mobile, name } =
			await User.findOne(
				{ _id: userId },
				{
					_id: 1,
					idHyundaiCode: 1,
					internationalPrefix: 1,
					mobile: 1,
					name: 1,
				}
			);
		if (!_id) {
			console.log("User not found!");
			return;
		}

		const { nif, billingAddress } = await BillingProfile.findOne(
			{ userId: userId },
			{ userId: 1, nif: 1, billingAddress: 1 }
		);

		if (!nif) {
			console.log("Billing profile not found!");
			return;
		}

		const {
			street = "",
			number = "",
			zipCode = "",
			city = "",
		} = billingAddress;
		const address = `${street}, ${number}, ${zipCode}, ${city}`;

		const names = name.split(" ");
		const data = {
			telephone: `${internationalPrefix}${mobile}`,
			nif: nif,
			address: address,
		};

		if (names.length >= 2) {
			data.firstName = names[0];
			data.lastName = names[names.length - 1];
		} else {
			data.firstName = name;
		}

		const headers = {
			Authorization: `Bearer ${tokenInfo.access_token}`,
			idClientCRM: idHyundaiCode,
			brand: process.env.hyundaiBrand,
		};
		const host = `${process.env.hyundaiPutData}${idHyundaiCode}`;

		console.log("host login Hyundai");
		console.log(host);

        console.log("headers login Hyundai");
        console.log(headers);

		console.log("data login Hyundai");
		console.log(data);
      
        try {
		    const response = await axiosS.axiosPutBodyAndHeader(host, data, headers);
            return response;
        }catch (error) {
            console.error(
                `[${context}] Error: ${error?.message ?? "Unknown error occurred when calling Hyundai API"}`
            );
            return null;
        }

	} catch (error) {
		console.error(
			`[${context}] Error: ${error?.message ?? "Unknown error occurred"}`
		);
		return null;
	}
}

function isValidPtZipCode(zipCode) {
    if (!zipCode) {
        return false;
    }

    //this expression catches any string that is complient with the zipCode 4 numbers "-" 3 numbers
    return /^[0-9]{4}-[0-9]{3}$/.test(zipCode);
}


async function hyundaiGetToken() {
    var context = "Function hyundaiGetToken";
    try {

        //TODO change rotes to only wotk on PROD?
        switch (process.env.NODE_ENV) {
            case 'production':
                break;
            case 'development':
                break;
            case 'pre-production':
                break;
            default:
                break;
        };

        let host = process.env.hyundaiGetToken;

        let keys = ['client_id', 'scope', 'client_secret', 'grant_type'];

        let values = [
            process.env.HYUNDAI_CLIENT_ID,
            process.env.HYUNDAI_CLIENT_SCOPE,
            process.env.HYUNDAI_CLIENT_SECRET,
            process.env.hyundaiGranType,
        ];

        let body = axiosS.getFromDataFormat(keys, values)

        return result = await axiosS.axiosPostBody(host, body);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }

}

module.exports = router;
