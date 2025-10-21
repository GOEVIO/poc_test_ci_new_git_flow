const TariffCEME = require('../models/tariffCEME');
const SchedulesCEME = require('../models/schedulesCEME');
const TariffsTAR = require('../models/tariffTar');
const ListCEME = require('../models/listCEME');
const { cacheTariffs } = require("../caching/cache");
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};

module.exports = {
    getTariffInbfo: (req) => {
        let context = "Function getTariffInbfo";
        return new Promise((resolve, reject) => {

            let contractsFound = req.body.contractsFound;
            let paymentMethods = req.body.paymentMethods;
            Promise.all(
                contractsFound.map(contract => {
                    return new Promise(async (resolve, reject) => {

                        let netWorkIndex = contract.networks.indexOf(contract.networks.find(netWork => {
                            return netWork.network === process.env.NetworkMobiE;
                        }));

                        if (netWorkIndex >= 0) {

                            //console.log("contract.networks[netWorkIndex]", contract.networks[netWorkIndex]);
                            if (contract.networks[netWorkIndex].paymentMethod != "" && contract.networks[netWorkIndex].paymentMethod != undefined) {

                                let paymentMethodInfo = paymentMethods.find(payment => {
                                    return payment.id === contract.networks[netWorkIndex].paymentMethod;
                                });
                                if (paymentMethodInfo) {
                                    contract.networks[netWorkIndex].paymentMethodInfo = paymentMethodInfo;
                                }
                                else {
                                    contract.networks[netWorkIndex].paymentMethodInfo = {};
                                };
                            }
                            else {
                                contract.networks[netWorkIndex].paymentMethodInfo = {};
                            };

                        };

                        if (contract.tariff !== undefined) {
                            let params = {
                                _id: contract.tariff.planId
                            };

                            let tariffInfo = await getTariffCEME(params);
                            tariffInfo = JSON.parse(JSON.stringify(tariffInfo));
                            let tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);
                            contract.tariffRoamingInfo = tariffRoamingInfo;

                            if (Object.keys(tariffInfo).length != 0) {
                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                    return tariff.power === contract.tariff.power
                                });
                                contract.tariffInfo = tariffInfo;
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            };
                        }
                        else {
                            contract.tariffInfo = {};
                            resolve(true);
                        }
                    });
                })
            ).then(() => {
                contractsFound.sort((x, y) => { return x.default - y.default });
                contractsFound.reverse();
                resolve(contractsFound);
            });
        });
    },
    updateCeme: (req) => {
        let context = "Function updateCeme";
        return new Promise(async (resolve, reject) => {
            let received = req.body;

            if (!received._id) {
                reject({ auth: false, code: 'server_tariff_CEME_id_required', message: "Tariff CEME id required" });
            };

            if (received.tariff.length === 0) {
                reject({ auth: false, code: 'server_tariff_CEME_required', message: "Tariff CEME required" });
            };

            if (!received.activationFee) {
                reject({ auth: false, code: 'server_tariff_activationFee_required', message: "Tariff CEME activation fee required" });
            };

            if (!received.activationFeeAdHoc) {
                reject({ auth: false, code: 'server_tariff_activationFeeAdHoc_required', message: "Tariff CEME activation fee Ad Hoc required" });
            };

            try {

                let tariffCeme = await TariffCEME.findOne({ _id: received._id });

                let tariffCEMEUpdated = await updateTariffCeme(tariffCeme, received);

                resolve(tariffCEMEUpdated);

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }

        });
    },
    tariffCEMEUpdate,
    tariffCEMEUpdateEVIO,
    tariffCEMEUpdateACP,
    tariffCEMEUpdateGoCharge,
    tariffCEMEUpdateHyundai,
    tariffCEMEUpdateKinto
}

function getTariffCEME(query) {
    let context = "Function getTariffCEME";
    return new Promise(async (resolve, reject) => {
        try {
            let tariffFound = await TariffCEME.findOne(query);

            if (tariffFound) {

                let querySchedules = {
                    country: tariffFound.country,
                    tariffType: tariffFound.tariffType,
                    cycleType: tariffFound.cycleType
                };

                let queryTar = {
                    country: tariffFound.country,
                    tariffType: tariffFound.tariffType
                };

                let scheduleFound = await schedulesCEMEFindOne(querySchedules);
                let tarFound = await tarFindOne(queryTar);
                let CEME = await listCEMEFindOne(query);

                let newTariff;

                if (CEME) {
                    newTariff = {
                        CEME: CEME,
                        plan: tariffFound,
                        schedule: scheduleFound,
                        tar: tarFound
                    };
                }
                else {
                    newTariff = {
                        plan: tariffFound,
                        schedule: scheduleFound,
                        tar: tarFound
                    };
                };

                resolve(newTariff);

            }
            else {
                resolve({});
            }
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    })
}

function schedulesCEMEFindOne(query) {
    var context = "Function schedulesCEMEFindOne";
    return new Promise((resolve, reject) => {
        SchedulesCEME.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][SchedulesCEME.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function tarFindOne(query) {
    var context = "Function tarFindOne";
    return new Promise((resolve, reject) => {
        TariffsTAR.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][TariffsTAR.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function listCEMEFindOne(query) {
    let context = "Function listCEMEFindOne";
    return new Promise((resolve, reject) => {
        ListCEME.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][listCEMEFindOne.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getTariffCEMERoaming(tariffRoaming) {
    let context = "Function getTariffCEMERoaming";
    return new Promise(async (resolve, reject) => {
        try {

            let plansId = [];

            await tariffRoaming.forEach(tariff => {
                plansId.push(tariff.planId);
            });

            let query = {
                _id: plansId
            };

            let tariffFound = await TariffCEME.find(query)
            let response = await getSchedules(tariffFound)
            resolve(response);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }

    });
}

function getSchedules(tariffFound) {
    var context = "Function getSchedules";
    return new Promise((resolve, reject) => {
        var answer = [];
        Promise.all(
            tariffFound.map(tariff => {
                return new Promise((resolve, reject) => {
                    var query = {
                        country: tariff.country,
                        tariffType: tariff.tariffType,
                        cycleType: tariff.cycleType
                    };
                    schedulesCEMEFindOne(query)
                        .then((result) => {
                            var newTariff;
                            if (result) {
                                newTariff = {
                                    plan: tariff,
                                    schedule: result
                                }
                            } else {
                                newTariff = {
                                    plan: tariff
                                }
                            };

                            answer.push(newTariff);
                            resolve(true);

                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });
                });
            })
        ).then(() => {
            resolve(answer);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        })
    });
};

function updateTariffCeme(tariffCeme, newTariff) {
    let context = "Function updateTariffCeme";
    return new Promise(async (resolve, reject) => {
        let lastTariffHistoryStopDate = tariffCeme.tariffsHistory[tariffCeme.tariffsHistory.length - 1]?.stopDate ?? tariffCeme.updatedAt.toISOString()
        let tariffToHistory = {
            startDate: lastTariffHistoryStopDate,
            stopDate: new Date().toISOString(),
            tariff: tariffCeme.tariff,
            activationFee: tariffCeme.activationFee,
            activationFeeAdHoc: tariffCeme.activationFeeAdHoc
        }

        tariffCeme.tariffsHistory.push(tariffToHistory);
        tariffCeme.tariff = newTariff.tariff ?? tariffCeme.tariff;
        tariffCeme.activationFee = newTariff.activationFee ?? tariffCeme.activationFee;
        tariffCeme.activationFeeAdHoc = newTariff.activationFeeAdHoc ?? tariffCeme.activationFee;

        try {
            let tariffCEMEUpdated = await TariffCEME.findOneAndUpdate({ _id: tariffCeme._id }, { $set: tariffCeme }, { new: true });
            await cacheTariffs();
            resolve(tariffCEMEUpdated);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        }
    })
}

let taskTariffCEME = null;
initJogTariffCEMEUpdate('00 00 01 10 *')
    .then(() => {
        taskTariffCEME.start();
        console.log("Tariff CEME Update JOB")
    })
    .catch(error => {
        console.log("Error starting Tariff CEME Update Job: " + error.message)
    });

function initJogTariffCEMEUpdate(timer) {
    return new Promise((resolve, reject) => {

        taskTariffCEME = cron.schedule(timer, () => {
            console.log('Running Job Tariff CEME Update: ' + new Date().toISOString());
            tariffCEMEUpdate(true);
        }, {
            scheduled: false
        });

        resolve();

    });
};

// tariffCEMEUpdate()
async function tariffCEMEUpdate(promotionalPeriod) {
    const context = "Function tariffCEMEUpdate";
    try {
        const basePrice = promotionalPeriod ? 0.112 : 0.149;
        const basePriceMini = promotionalPeriod ? 0.112 : 0.142;
        const basePriceSmall = promotionalPeriod ? 0.112 : 0.1341;
        const basePriceBig = promotionalPeriod ? 0.112 : 0.1267;
        const basePriceVeryBig = promotionalPeriod ? 0.112 : 0.1192;
        
        const basePriceACPDiscount = promotionalPeriod ? 0.099 : 0.1315;
        const basePriceBluWalk = promotionalPeriod ? 0.1269 : 0.149;
        
        const evioBaseTariff = populateActivation(buildCemeTariffArrayObject(basePrice, basePrice, basePrice, basePrice, basePrice, basePrice, basePrice, basePrice));
        const evioBaseTariffMini = populateActivation(buildCemeTariffArrayObject(basePriceMini, basePriceMini, basePriceMini, basePriceMini, basePriceMini, basePriceMini, basePriceMini, basePriceMini));
        const evioBaseTariffSmall = populateActivation(buildCemeTariffArrayObject(basePriceSmall, basePriceSmall, basePriceSmall, basePriceSmall, basePriceSmall, basePriceSmall, basePriceSmall, basePriceSmall));
        const evioBaseTariffBig = populateActivation(buildCemeTariffArrayObject(basePriceBig, basePriceBig, basePriceBig, basePriceBig, basePriceBig, basePriceBig, basePriceBig, basePriceBig));
        const evioBaseTariffVeryBig = populateActivation(buildCemeTariffArrayObject(basePriceVeryBig, basePriceVeryBig, basePriceVeryBig, basePriceVeryBig, basePriceVeryBig, basePriceVeryBig, basePriceVeryBig, basePriceVeryBig));
        
        const acpPartnerTariffDiscount = populateActivation(buildCemeTariffArrayObject(basePriceACPDiscount, basePriceACPDiscount, basePriceACPDiscount, basePriceACPDiscount, basePriceACPDiscount, basePriceACPDiscount, basePriceACPDiscount, basePriceACPDiscount));


        let tariffCemeEVIOAdHoc = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc" }).lean();
        let tariffCemeEVIOAdHocMiniFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_mini_fleet" }).lean();
        let tariffCemeEVIOSmallFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_small_fleet" }).lean();
        let tariffCemeEVIOBigFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_big_fleet" }).lean();
        let tariffCemeEVIOAdHocVeryBigFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_very_big_fleet" }).lean();
        let tariffCemeACP = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_acp" }).lean();
        let tariffCemeACPPartner = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_acp_discount" }).lean();
        let tariffCemeBluWalkAdHoc = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_bluwalk" }).lean();
        
        await updateTariffCeme(tariffCemeEVIOAdHoc, evioBaseTariff);
        await updateTariffCeme(tariffCemeACP, evioBaseTariff); // ACP uses the same tariff as EVIO
        await updateTariffCeme(tariffCemeEVIOAdHocMiniFleet, evioBaseTariffMini)
        await updateTariffCeme(tariffCemeEVIOSmallFleet, evioBaseTariffSmall);
        await updateTariffCeme(tariffCemeEVIOBigFleet, evioBaseTariffBig);
        await updateTariffCeme(tariffCemeEVIOAdHocVeryBigFleet, evioBaseTariffVeryBig);
        await updateTariffCeme(tariffCemeACPPartner, acpPartnerTariffDiscount);
        await updateTariffCeme(tariffCemeBluWalkAdHoc, basePriceBluWalk);


        console.log("Tariff CEME EVIO updated")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function populateActivation(tariff) {
    return {
        tariff,
        activationFee: {
            currency: "EUR",
            value: 0.15 
        },
        activationFeeAdHoc: {
            currency: "EUR",
            value: 0.15
        }
    };
}

async function tariffCEMEUpdateEVIO() {
    const context = "Function tariffCEMEUpdateEVIO";
    try {

        ////////////////////////////////////////////////////
        ////////////////////  EVIO  ////////////////////////
        ////////////////////////////////////////////////////

        // Base EVIO CEME price

        const evioBaseTariff = buildCemeTariffArrayObject(0.1590, 0.1590, 0.1590, 0.1590, 0.1590, 0.1590, 0.1590, 0.1590)
        let newEvioBaseTariff = {
            tariff: evioBaseTariff,
            activationFee: {
                currency: "EUR",
                value: 0.15 
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.15
            }
        }

        let tariffCemeEVIOAdHoc = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc" }).lean();
        let tariffCemeEVIOAdHocMiniFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_mini_fleet" }).lean();
        let tariffCemeEVIOSmallFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_small_fleet" }).lean();
        let tariffCemeEVIOBigFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_big_fleet" }).lean();
        let tariffCemeEVIOAdHocVeryBigFleet = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_very_big_fleet" }).lean();
        let tariffCemeACP = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_acp" }).lean();

        const tariffsCemeArray = [
            tariffCemeEVIOAdHoc,
            tariffCemeEVIOAdHocMiniFleet,
            tariffCemeEVIOSmallFleet,
            tariffCemeEVIOBigFleet,
            tariffCemeEVIOAdHocVeryBigFleet,
            tariffCemeACP
        ]
        await Promise.all(tariffsCemeArray.map(async tariffCemeEVIO => await updateTariffCeme(tariffCemeEVIO, newEvioBaseTariff)))


        const tariffCemeACPPartnerDiscount = buildCemeTariffArrayObject(0.1135, 0.1135, 0.1135, 0.1135, 0.1135, 0.1135, 0.1135, 0.1135)
        let newTariffCemeACPPartnerDiscount = {
            tariff: tariffCemeACPPartnerDiscount,
            activationFee: {
                currency: "EUR",
                value: 0.15 
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.15
            }
        };

        let tariffCemeACPPartner = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_acp_discount" }).lean();
        await updateTariffCeme(tariffCemeACPPartner, newTariffCemeACPPartnerDiscount)

        console.log("Tariff CEME updated")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function tariffCEMEUpdateACP() {
    const context = "Function tariffCEMEUpdateACP";
    try {

        ////////////////////////////////////////////////////
        ////////////////////  ACP  /////////////////////////
        ////////////////////////////////////////////////////

        // Non partners
        const acpNonPartnerCemeTariff = buildCemeTariffArrayObject(0.1590, 0.1590, 0.1590, 0.1590, 0.1590, 0.1590, 0.1590, 0.1590)
        let newAcpNonPartnerCemeTariff = {
            tariff: acpNonPartnerCemeTariff,
            activationFee: {
                currency: "EUR",
                value: 0.15
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.15
            }
        }

        let tariffCemeACPNonPartner = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_acp" }).lean();

        await updateTariffCeme(tariffCemeACPNonPartner, newAcpNonPartnerCemeTariff)


        // Partners

        const acpPartnerCemeTariff = buildCemeTariffArrayObject(0.1410, 0.1410, 0.1410, 0.1410, 0.1410, 0.1410, 0.1410, 0.1410)
        let newAcpPartnerCemeTariff = {
            tariff: acpPartnerCemeTariff,
            activationFee: {
                currency: "EUR",
                value: 0.15
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.15
            }
        }

        let tariffCemeACPPartner = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_acp_discount" }).lean();

        await updateTariffCeme(tariffCemeACPPartner, newAcpPartnerCemeTariff)

        console.log("Tariff CEME ACP updated")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function tariffCEMEUpdateGoCharge() {
    const context = "Function tariffCEMEUpdateGoCharge";
    try {

        ////////////////////////////////////////////////////
        //////////////////  GO.CHARGE  /////////////////////
        ////////////////////////////////////////////////////

        // Go.Charge CEME price


        const goChargeTariff = buildCemeTariffArrayObject(0.1675, 0.1774, 0.1620, 0.1968, 0.1774, 0.1968, 0.1774, 0.1968)
        let newGoChargeTariff = {
            tariff: goChargeTariff,
            activationFee: {
                currency: "EUR",
                value: 0.1572
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.1572
            }
        }


        let tariffCemeGoChargeAdHoc = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_goCharge" }).lean();
        //let tariffCemeGoChargeCompany = await TariffCEME.findOne({ planName: "server_plan_EVIO_company_goCharge" }).lean();
        //let tariffCemeGoChargeFinalCostumer = await TariffCEME.findOne({ planName: "server_plan_EVIO_finalCostumer_goCharge" }).lean();

        //const tariffsCemeArray = [tariffCemeGoChargeAdHoc, tariffCemeGoChargeCompany, tariffCemeGoChargeFinalCostumer]
        const tariffsCemeArray = [tariffCemeGoChargeAdHoc]
        await Promise.all(tariffsCemeArray.map(async tariff => await updateTariffCeme(tariff, newGoChargeTariff)))

        console.log("Tariff CEME Go.Charge updated")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function tariffCEMEUpdateHyundai() {
    const context = "Function tariffCEMEUpdateHyundai";
    try {

        ////////////////////////////////////////////////////
        //////////////////  Hyundai  /////////////////////
        ////////////////////////////////////////////////////

        // Hyundai CEME price

        const hyundaiPrice = 0.1490;
        const hyundaiTariff = buildCemeTariffArrayObject(hyundaiPrice, hyundaiPrice, hyundaiPrice, hyundaiPrice, hyundaiPrice, hyundaiPrice, hyundaiPrice, hyundaiPrice)
        let newHyundaiTariff = {
            tariff: hyundaiTariff,
            activationFee: {
                currency: "EUR",
                value: 0.1572
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.1572
            }
        }


        let tariffCemeHyundaiAdHoc = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_hyundai" }).lean();

        const tariffsCemeArray = [tariffCemeHyundaiAdHoc]
        await Promise.all(tariffsCemeArray.map(async tariff => await updateTariffCeme(tariff, newHyundaiTariff)))

        console.log("Tariff CEME Hyundai updated")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function tariffCEMEUpdateKinto() {
    const context = "Function tariffCEMEUpdateKinto";
    try {

        ////////////////////////////////////////////////////
        //////////////////  Kinto  /////////////////////
        ////////////////////////////////////////////////////

        // Kinto CEME price

        const kintoPrice = 0.1572;
        const kintoTariff = buildCemeTariffArrayObject(kintoPrice, kintoPrice, kintoPrice, kintoPrice, kintoPrice, kintoPrice, kintoPrice, kintoPrice)
        let newKintoTariff = {
            tariff: kintoTariff,
            activationFee: {
                currency: "EUR",
                value: 0.1572
            },
            activationFeeAdHoc: {
                currency: "EUR",
                value: 0.1572
            }
        }


        let tariffCemeKintoAdHoc = await TariffCEME.findOne({ planName: "server_plan_EVIO_ad_hoc_kinto" }).lean();

        const tariffsCemeArray = [tariffCemeKintoAdHoc]
        await Promise.all(tariffsCemeArray.map(async tariff => await updateTariffCeme(tariff, newKintoTariff)))

        console.log("Tariff CEME Kinto updated")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function buildCemeTariffArrayObject(btnEmpty, mtEmpty, btnOutEmpty, mtOutEmpty, atEmpty, atOutEmpty, matEmpty, matOutEmpty) {
    return [
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'BTN',
            price: btnEmpty

        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'BTN',
            price: btnOutEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'BTE',
            price: btnEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'BTE',
            price: btnOutEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'MT',
            price: mtEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'MT',
            price: mtOutEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'AT',
            price: atEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'AT',
            price: atOutEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'MAT',
            price: matEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'MAT',
            price: matOutEmpty
        }
    ];
}