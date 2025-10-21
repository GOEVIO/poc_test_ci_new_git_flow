const Fees = require('../models/fees');
const JsonFind = require('json-find');
const PortugalPostalCodes = require('../models/portugalPostalCode');
const PortugalDistricts = require('../models/portugalDistricts');
const feesJson = require('../models/fees.json');
const commons = require('evio-library-commons').default;
const identity = require('evio-library-identity').default;
require("dotenv-safe").load();

const Sentry = require('@sentry/node');

module.exports = {
    addFees: function (req) {
        let context = "Funciton addFees";
        return new Promise((resolve, reject) => {

            if (!req.body.countryCode) {
                reject({ code: 'countryCode_missing', message: "Country code missing" });
            }

            if (!req.body.fees) {
                reject({ code: 'fees_missing', message: "Fees missing" });
            }

            let query = {
                countryCode: req.body.countryCode
            }

            if (req.body.zone) {
                query.zone = req.body.zone
            }

            Fees.findOne(query, (error, feesFound) => {
                if (error) {
                    console.error(`[${context}][.then][findOne] Error `, error.message);
                    reject(error)
                }
                else {
                    if (feesFound) {

                        let query = {
                            _id: feesFound._id
                        }
                        var newValue = { $set: req.body };

                        Fees.updateFees(query, newValue, (err, result) => {
                            if (err) {
                                console.log(`[${context}][updateFees] Error `, err.message);
                                reject(err)
                            }
                            else {
                                if (result) {
                                    resolve({ auth: false, code: 'fees_updated', message: "Fees updated" });
                                }
                                else {
                                    reject({ auth: false, code: 'fees_not_updated', message: "Fees not updated" });
                                }
                            }
                        });

                    }
                    else {
                        let fees = new Fees(req.body);

                        Fees.createFees(fees, (err, result) => {
                            if (err) {
                                console.log(`[${context}][fees] Error `, err.message);
                                reject(err)
                            }
                            else {
                                if (result) {
                                    resolve({ auth: false, code: 'fees_created', message: "Fees created" });
                                }
                                else {
                                    reject({ auth: false, code: 'fees_not_created', message: "Fees not created" });
                                }
                            }
                        });

                    }
                }
            });

        });
    },
    getFees: async function (req) {
        let context = "Function getFees";
        try {
            if (!req?.query || !req?.query?.countryCode) {
                console.error(JSON.stringify(req?.query))
                Sentry.captureMessage(`Fees not found because was called without mandatory elements! Find`);
                throw { code: 'query_missing', message: "Query missing" };
            }

            let feesFound = await  getFeesFromAddress(req.query.countryCode, req?.query?.postalCode)

            if (!feesFound) {
                Sentry.captureMessage(`Fees not found using countryCode ${req.query.countryCode}`);
                throw { auth: false, code: 'fees_not_found', message: "Fees by district not found" };
            }
            if (req.query?.userId && req.query?.userId.toUpperCase() != "UNKNOWN") {
                const billingProfile = await identity.findBillingProfileByUserId(req.query.userId);
                if (!billingProfile) {
                    Sentry.captureMessage(`Billing profile not found using userId ${req.query.userId}`);
                    throw { auth: false, code: 'billing_profile_not_found', message: "Billing profile not found" };
                }
                let userFees = await getFeesFromAddress(billingProfile?.billingAddress?.countryCode, billingProfile?.billingAddress?.zipCode)
                if (!userFees) {
                    if(billingProfile?.billingAddress?.countryCode) {
                        Sentry.captureMessage(`Fees not found using countryCode ${billingProfile?.billingAddress?.countryCode} and ZipCode ${billingProfile?.billingAddress?.zipCode}`);
                    }
                    userFees = feesFound;
                }

                const {VAT, countryCode} = commons.getVATandContryCode(billingProfile, req.query.countryCode, feesFound.fees.IVA, userFees.fees.IVA);

                feesFound.fees.IVA = VAT
                feesFound.fees.countryCode = countryCode
            }
            return feesFound.fees;
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            if (error?.auth === false)
                Sentry.captureException(error);
            throw (error);
        }
    },
    addJsonFees: function () {
        let context = "Function addJsonFees";
        return new Promise((resolve, reject) => {
            const jsonFees = JsonFind(feesJson);
            Promise.all(
                Object.keys(jsonFees).map(zone => {
                    return new Promise((resolve, reject) => {

                        const zoneFees = jsonFees[zone]
                        let body = {
                            zone,
                            fees: {
                                IEC: zoneFees.iec,
                                IVA: zoneFees.vatRates.standard
                            },
                            countryCode: zoneFees.countryCode
                        }

                        this.addFees({ body })
                            .then(result => {
                                console.log(`${body.zone} fee added!`)
                                resolve(true)
                            })
                            .catch(error => {
                                console.log(`ERROR[${context}]: ${body.zone} fee failed!`)
                                resolve(false)
                            })
                    });

                })
            )
                .then(() => {
                    resolve({ auth: false, code: 'fees_updated', message: "Fees updated" });
                })
                .catch(() => {
                    console.log(`ERROR[${context}]: Updating fees failed!`)
                    reject({ auth: false, code: 'fees_not_updated', message: "Fees not updated" });
                })


        });
    },
    getFeesList: async function (chargers) {
        let context = "Funciton getFeesList";
        try {
            let chargerFees = []
            for (let charger of chargers) {
                chargerFees.push(await getChargerFees(charger))
            }
            return chargerFees
        } catch (error) {
            return chargers
        }
    }
}

async function getChargerFees(charger) {
    const context = "Function getChargerFees"
    try {
        let countryCode = 'PT'
        let postalCode = ''

        if (charger?.address != undefined) {
            if (charger?.address?.country) {
                if (charger?.address?.country === 'Portugal' || charger?.address?.country === '') {
                    countryCode = 'PT';
                }
                else {
                    countryCode = charger?.address?.country;
                }
            }
            else {
                countryCode = 'PT';
            }

            if (charger?.address?.zipCode !== undefined && charger?.address?.zipCode !== "") {
                let result = charger?.address?.zipCode.split("-");
                if (result.length > 1) {
                    postalCode = result[0];
                }
                else {
                    postalCode = '';
                }
            }
            else {
                postalCode = '';
            }
        }

        const postalCodeFound = await PortugalPostalCodes.find({ postalCodes: postalCode }).lean()

        if (postalCodeFound.length > 0) {
            let postalCodeObj = postalCodeFound[0];
            const districtFound = await PortugalDistricts.findOne({ code: postalCodeObj.districtCode }).lean()
            if (districtFound) {

                let query = {
                    countryCode: countryCode,
                    zone: districtFound.zone
                }
                const feesFound = await Fees.findOne(query).lean()
                if (feesFound) {
                    charger.fees = feesFound?.fees
                }
                else {
                    let query = {
                        countryCode: countryCode,
                    }

                    if (countryCode === "PT") {
                        query.zone = "Portugal"
                    }

                    const feesFound = await Fees.findOne(query).lean()
                    charger.fees = feesFound?.fees

                }

            } else {
                let query = {
                    countryCode: countryCode,
                }

                if (countryCode === "PT") {
                    query.zone = "Portugal"
                }

                const feesFound = await Fees.findOne(query).lean()
                charger.fees = feesFound?.fees
            }
        } else {
            let query = {
                countryCode: countryCode,
            }

            if (countryCode === "PT") {
                query.zone = "Portugal"
            }

            const feesFound = await Fees.findOne(query).lean()
            charger.fees = feesFound?.fees
        }
        return charger
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return charger
    }
}

async function getFeesFromAddress(countryCode, postalCode) {
    let postalCodeFound;
    let query = {
        countryCode
    }

    if(!countryCode) {
        return null;
    }

    if (postalCode && countryCode === "PT") {
        postalCode = postalCode.split('-')[0]
        postalCodeFound = await PortugalPostalCodes.findOne({ postalCodes: postalCode });
    }

    if (postalCodeFound) {

        const districtFound = await PortugalDistricts.findOne({ code: postalCodeFound.districtCode });

        if (!districtFound) {
            Sentry.captureMessage(`Invalid district to fetch fees ${countryCode} and zipCode ${postalCode}`);
            throw { auth: false, code: 'invalid_district', message: "Invalid district" };
        }

        query.zone = districtFound.zone
    }
    else if (countryCode === "PT") {
        query.zone = "Portugal"
    }

    let objectFees = await Fees.findOne(query).lean()

    if (!objectFees?.fees) {
        return null
    }
    objectFees.fees.countryCode = countryCode
    return objectFees;
}