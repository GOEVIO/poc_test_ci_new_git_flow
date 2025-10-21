const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");

const EVDatabase = require('../models/database_EVs');

//Get EVs makers
router.get('/api/private/evsdb/brands', (req, res, next) => {
    var context = "GET /api/private/evsdb/brands";
    try {

        EVDatabase.distinct('Vehicle_Make', (error, makersFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                return res.status(200).send(makersFound);
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});


//Get EVs models by maker
router.get('/api/private/evsdb/models', (req, res, next) => {
    var context = "GET /api/private/evsdb/models";
    try {

        let brand = req.query.brand;

        EVDatabase.find({ Vehicle_Make: brand }).distinct('Vehicle_Model', (error, modelsFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                return res.status(200).send(modelsFound);
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

/*
router.get('/api/private/evs/byMaker', (req, res, next) => {
    var context = "GET /api/private/evs/byMaker";
    try {

        let maker = req.query.maker;

        EVDatabase.aggregate([
            { "$match": { "Vehicle_Make": maker } },
            {
                "$group": {
                    "_id": {
                        Vehicle_Model: "$Vehicle_Model", Availability_Date_From: "$Availability_Date_From",
                        Drivetrain_Type: "$Drivetrain_Type", Vehicle_Model_Version: "$Vehicle_Model_Version"
                    }
                }
            },
            { "$sort": { Vehicle_Model: 1 } }
        ], (error, modelsFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                return res.status(200).send(modelsFound);
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});*/

//Get EVs model version by model
router.get('/api/private/evsdb/versions', (req, res, next) => {
    var context = "GET /api/private/evsdb/versions";
    try {

        let query = {
            Vehicle_Make: req.query.brand,
            Vehicle_Model: req.query.model
        }

        var fields = {
            Vehicle_Make: 1,
            Vehicle_Model: 1,
            Vehicle_Model_Version: 1,
            Availability_Date_From: 1,
            Availability_Date_To: 1,
            Drivetrain_Type: 1,
            Charge_Plug: 1,
            Charge_Standard_Power: 1,
            Fastcharge_Plug: 1,
            Fastcharge_Power_Max: 1,
            Images: 1,
            Charge_Option_Power: 1,
            Vehicle_ID: 1
        };

        EVDatabase.find(query, fields, (error, modelVersionsFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {

                let versionsFound = [];

                for (let model of modelVersionsFound) {

                    let plugs = [];
                    if (model.Charge_Plug !== null) {

                        let plugPower = [];

                        if (model.Charge_Option_Power !== null) {
                            plugPower.push({
                                plugPower: model.Charge_Option_Power
                            });
                        }

                        plugPower.push({
                            plugPower: model.Charge_Standard_Power
                        });

                        plugs.push({
                            plugType: model.Charge_Plug,
                            plugPower: model.Charge_Standard_Power,
                            plugPowerAux: plugPower
                        });
                    }

                    if (model.Fastcharge_Plug !== null) {
                        plugs.push({
                            plugType: model.Fastcharge_Plug,
                            plugPower: model.Fastcharge_Power_Max
                        });
                    }

                    let versionFound = {
                        brand: model.Vehicle_Make,
                        model: model.Vehicle_Model,
                        version: model.Vehicle_Model_Version,
                        evType: model.Drivetrain_Type,
                        dateFrom: model.Availability_Date_From,
                        dateTo: model.Availability_Date_To,
                        plugs: plugs,
                        vehicleId: model.Vehicle_ID
                    };

                    if (model.Images.length > 1) {
                        let array = model.Images.splice(1, Number.MAX_VALUE);
                        versionFound.imageContent = array[0];
                    }
                    else {
                        versionFound.imageContent = model.Images[0];
                    }

                    versionsFound.push(versionFound);

                }

                return res.status(200).send(versionsFound);
            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

//Brand - Vehicle_Make
//Model - Vehicle_Model + Vehicle_Model_Version
//Range - Range_Real
//Country -  vem do telemovel 
//Matricula - Vem do telemovel
//BatteryCapacity -  Battery_Capacity_Useable  or  Battery_Capacity_Full
//Eletric motor power -   (Nao disponivel)
//Internal charger power (Charge Power) - Charge_Standard_Power
//Fast charging power (Fastcharge Power) -  Fastcharge_Power_Max  or  Fastcharge_Power_Avg 

//Plugs
//Charge_Plug - Charge_Standard_Power
//Fastcharge_Plug - Fastcharge_Power_Max  or  Fastcharge_Power_Avg 

//Get EV info by version
router.get('/api/private/evsdb/getEVInfo', (req, res, next) => {
    var context = "GET /api/private/evsdb/getEVInfo";
    try {

        let query = {};


        if (req.query.databaseId !== undefined) {
            query.Vehicle_ID = Number(req.query.databaseId);
        }
        else {

            if (req.query.vehicleId) {
                query.Vehicle_ID = Number(req.query.vehicleId)
            }
            if (req.query.version === 'null' || req.query.version === '') {
                query.Vehicle_Make = req.query.brand;
                query.Vehicle_Model = req.query.model;
                query.Vehicle_Model_Version = null;

            }
            else {
                query.Vehicle_Make = req.query.brand;
                query.Vehicle_Model = req.query.model;
                query.Vehicle_Model_Version = req.query.version;

            }

            if (req.query.dateTo === 'null' || req.query.dateTo === '') {
                query.Availability_Date_From = req.query.dateFrom;
                query.Availability_Date_To = null;

            }
            else {
                query.Availability_Date_From = req.query.dateFrom;
                query.Availability_Date_To = req.query.dateTo;

            }
        }

        var fields = {
            Vehicle_ID: 1,
            Vehicle_Make: 1,
            Vehicle_Model: 1,
            Vehicle_Model_Version: 1,
            Range_Real: 1,
            Battery_Capacity_Useable: 1,
            Battery_Capacity_Full: 1,
            Charge_Plug: 1,
            Charge_Standard_Power: 1,
            Charge_Standard_ChargeTime: 1,
            Charge_Standard_ChargeSpeed: 1,
            Fastcharge_Plug: 1,
            Fastcharge_Power_Max: 1,
            Fastcharge_ChargeTime: 1,
            Fastcharge_ChargeSpeed: 1,
            Availability_Date_From: 1,
            Availability_Date_To: 1,
            Fastcharge_Power_Avg: 1,
            Drivetrain_Type: 1,
            Efficiency_Real: 1,
            Efficiency_Real_WCty: 1,
            Efficiency_Real_BCty: 1,
            Efficiency_Real_WHwy: 1,
            Efficiency_Real_BHwy: 1,
            Charge_Standard_Table: 1,
            Fastcharge_Table: 1,
            Images: 1,
            Charge_Option_Power: 1,
            Charge_Option_ChargeTime: 1,
            Charge_Option_ChargeSpeed: 1,
            Charge_Option_Table: 1
        };
        console.log("query", query)

        EVDatabase.findOne(query, fields, async (error, evInfo) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {

                console.log("evInfo", evInfo)
                if (evInfo != null && evInfo != undefined) {

                    if (evInfo.length > 1) {
                        console.log("evInfo", evInfo)
                        return res.status(400).send({ auth: false, code: 'server_multiple_EVs', message: "Multiple EVs found" })
                        //return res.status(400).send("Multiple EVs found");
                    }
                    else {

                        /*if (evInfo.Availability_Date_From !== null) {
                            let date = evInfo.Availability_Date_From.split("-");
                            evInfo.Availability_Date_From = date[1];
                        }

                        if (evInfo.Availability_Date_To !== null) {
                            let date = evInfo.Availability_Date_To.split("-");
                            evInfo.Availability_Date_To = date[1];
                        }*/

                        if (evInfo.Availability_Date_To == null) {
                            evInfo.Availability_Date_To = 'Present';
                        }

                        let image;
                        if (evInfo.Images.length > 1) {
                            let array = evInfo.Images.splice(1, Number.MAX_VALUE);
                            image = array[0];
                        }
                        else {
                            image = evInfo.Images[0];
                        }

                        let internalChargerPower;
                        let internalChargerChargeTime;
                        let internalChargerChargeSpeed;

                        //check selected plug power by user
                        if (req.query.plugPower !== undefined && req.query.plugPower !== null) {
                            if (evInfo.Charge_Standard_Power && req.query.plugPower === evInfo.Charge_Standard_Power.toString()) {
                                internalChargerPower = evInfo.Charge_Standard_Power;
                                internalChargerChargeTime = evInfo.Charge_Standard_ChargeTime;
                                internalChargerChargeSpeed = evInfo.Charge_Standard_ChargeSpeed;
                            }
                            else {
                                if (evInfo.Charge_Option_Power && req.query.plugPower === evInfo.Charge_Option_Power.toString()) {
                                    internalChargerPower = evInfo.Charge_Option_Power;
                                    internalChargerChargeTime = evInfo.Charge_Option_ChargeTime;
                                    internalChargerChargeSpeed = evInfo.Charge_Option_ChargeSpeed;
                                }
                                else {
                                    internalChargerPower = evInfo.Charge_Standard_Power;
                                    internalChargerChargeTime = evInfo.Charge_Standard_ChargeTime;
                                    internalChargerChargeSpeed = evInfo.Charge_Standard_ChargeSpeed;
                                }
                            }
                        }
                        else {
                            internalChargerPower = evInfo.Charge_Standard_Power;
                            internalChargerChargeTime = evInfo.Charge_Standard_ChargeTime;
                            internalChargerChargeSpeed = evInfo.Charge_Standard_ChargeSpeed;
                        }

                        let plugs = [];
                        if (evInfo.Charge_Plug !== null) {
                            plugs.push({
                                plugType: evInfo.Charge_Plug,
                                plugPower: internalChargerPower
                            });
                        }

                        if (evInfo.Fastcharge_Plug !== null) {
                            plugs.push({
                                plugType: evInfo.Fastcharge_Plug,
                                plugPower: evInfo.Fastcharge_Power_Max
                            });
                        }

                        let consumptionCity = null;
                        if (evInfo.Efficiency_Real_BCty == null) {
                            consumptionCity = await findCityConsumptionsByModel(evInfo.Vehicle_Make, evInfo.Vehicle_Model);
                        }
                        else {
                            if (evInfo.Efficiency_Real_BCty !== null) {
                                consumptionCity = evInfo.Efficiency_Real_BCty;
                            }
                        }

                        let consumptionHighway = null;
                        if (evInfo.Efficiency_Real_BHwy == null) {
                            consumptionHighway = await findHighwayConsumptionsByModel(evInfo.Vehicle_Make, evInfo.Vehicle_Model);
                        }
                        else {
                            if (evInfo.Efficiency_Real_BHwy !== null) {
                                consumptionHighway = evInfo.Efficiency_Real_BHwy;
                            }
                        }

                        let plugsChargingTable = null;
                        if (req.query.plugPower !== undefined && req.query.plugPower !== null) {
                            if (evInfo.Charge_Standard_Power && req.query.plugPower === evInfo.Charge_Standard_Power.toString()) {
                                if (evInfo.Charge_Standard_Table !== null) {
                                    plugsChargingTable = calculatePlugChargingTable(evInfo.Charge_Standard_Table, evInfo.Charge_Plug);
                                }
                            }
                            else {
                                if (evInfo.Charge_Option_Power && req.query.plugPower === evInfo.Charge_Option_Power.toString()) {
                                    if (evInfo.Charge_Option_Table !== null) {
                                        plugsChargingTable = calculatePlugChargingTable(evInfo.Charge_Option_Table, evInfo.Charge_Plug);
                                    }
                                }
                            }
                        }
                        else {
                            if (evInfo.Charge_Standard_Table !== null) {
                                plugsChargingTable = calculatePlugChargingTable(evInfo.Charge_Standard_Table, evInfo.Charge_Plug);
                            }
                        }

                        let plugsFastChargingTable = null;
                        if (evInfo.Fastcharge_Table !== null) {
                            plugsFastChargingTable = calculatePlugFastChargingTable(evInfo.Fastcharge_Table, evInfo.Fastcharge_Plug);
                        }

                        let EV = {
                            databaseVehicleId: evInfo.Vehicle_ID,
                            yearFrom: evInfo.Availability_Date_From,
                            yearTo: evInfo.Availability_Date_To,
                            range: evInfo.Range_Real,
                            useableBatteryCapacity: evInfo.Battery_Capacity_Useable,
                            maxBatteryCapacity: evInfo.Battery_Capacity_Full,
                            eletricMotorPower: null,

                            internalChargerPower: internalChargerPower,
                            internalChargerChargeTime: internalChargerChargeTime,
                            internalChargerChargeSpeed: internalChargerChargeSpeed,

                            maxFastChargingPower: evInfo.Fastcharge_Power_Max,
                            avgFastChargingPower: evInfo.Fastcharge_Power_Avg,
                            fastchargeChargeTime: evInfo.Fastcharge_ChargeTime,
                            fastchargeChargeSpeed: evInfo.Fastcharge_ChargeSpeed,
                            evType: evInfo.Drivetrain_Type,
                            evEfficiency: evInfo.Efficiency_Real * 10,
                            consumptionCity: consumptionCity,
                            consumptionHighway: consumptionHighway,
                            plugsChargingTable: plugsChargingTable,
                            plugsFastChargingTable: plugsFastChargingTable,
                            evImage: image,
                            plugs: plugs
                        };

                        return res.status(200).send(EV);

                    }
                }
                else {

                    return res.status(400).send({ auth: false, code: 'server_ev_info_not_found', message: "EV info not found for givem params" })
                    //return res.status(400).send({});
                }

            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

async function findCityConsumptionsByModel(make, model) {
    return new Promise(async (resolve, reject) => {


        let query = {
            Vehicle_Make: make,
            Vehicle_Model: model
        }

        var fields = {
            Efficiency_Real_BCty: 1
        };

        EVDatabase.find(query, fields, (error, modelVersionsFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {

                if (modelVersionsFound.length == 0) {
                    resolve(0);
                }
                else {

                    let consumptionCity = 0;
                    let model_count = 0;

                    for (let i = 0; i < modelVersionsFound.length; i++) {

                        let model = modelVersionsFound[i];

                        if (model.Efficiency_Real_BCty !== null) {
                            consumptionCity += model.Efficiency_Real_BCty;
                            model_count++;
                        }
                    }

                    if (model_count != 0) {
                        resolve(consumptionCity / model_count);
                    }
                    else {
                        resolve(0);
                    }

                }

            }
        });

    });
}

async function findHighwayConsumptionsByModel(make, model) {
    return new Promise(async (resolve, reject) => {

        let query = {
            Vehicle_Make: make,
            Vehicle_Model: model
        }

        var fields = {
            Efficiency_Real_BHwy: 1
        };

        EVDatabase.find(query, fields, (error, modelVersionsFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {

                if (modelVersionsFound.length == 0) {
                    resolve(0);
                } else {

                    let consumptionHighway = 0;
                    let model_count = 0;

                    for (let i = 0; i < modelVersionsFound.length; i++) {

                        let model = modelVersionsFound[i];

                        if (model.Efficiency_Real_BHwy !== null) {
                            consumptionHighway += model.Efficiency_Real_BHwy;
                            model_count++;
                        }

                    }

                    if (model_count != 0) {
                        resolve(consumptionHighway / model_count);
                    }
                    else {
                        resolve(0);
                    }

                }

            }
        });

    });
}

function calculatePlugChargingTable(table, charge_plug) {

    let chargingTable = [];

    for (let i = 0; i < table.length; i++) {
        let element = JSON.parse(JSON.stringify(table[i]));

        let index = chargingTable.findIndex(x => x.chargePhaseVolt === element.Charge_PhaseVolt && x.chargePhaseAmp === element.Charge_PhaseAmp
            && x.chargePhase === element.Charge_Phase && x.chargePower === element.Charge_Power);

        if (index === -1) {
            let mapping = {
                plugType: charge_plug,
                chargePhaseVolt: element.Charge_PhaseVolt,
                chargePhaseAmp: element.Charge_PhaseAmp,
                chargePhase: element.Charge_Phase,
                chargePower: element.Charge_Power,
                chargeTime: element.Charge_Time
            }
            chargingTable.push(mapping);
        }

    }

    return chargingTable;
}

function calculatePlugFastChargingTable(fastTable, fastCharge_plug) {

    let chargingTable = [];

    for (let i = 0; i < fastTable.length; i++) {
        let element = JSON.parse(JSON.stringify(fastTable[i]));

        let index = chargingTable.findIndex(x => x.fastChargePower === element.Fastcharge_Power_Max && x.fastChargeTime === element.Fastcharge_ChargeTime);

        if (index === -1) {

            var currentTypeArray = element.chargeInfo.split("-");

            let currentType;
            if (currentTypeArray[2] != undefined) {
                currentType = currentTypeArray[2];
            }

            let mapping = {
                plugType: fastCharge_plug,
                fastChargePower: element.Fastcharge_Power_Max,
                fastChargeTime: element.Fastcharge_ChargeTime,
                currentType: currentType
            }
            chargingTable.push(mapping);
        }
    }

    return chargingTable;
}

/*
function calculateCurveRate(table, max_baterry_capacity, charge_plug,
    fastCharge_plug, fastCharge_power, fastCharge_time, fastCharge_speed) {

    let result = [];

    for (let i = 0; i < table.length; i++) {

        let curveTable = [];
        let element = JSON.parse(JSON.stringify(table[i]));
        let perc = 0.2;

        while (perc <= 1) {
            let current_perc = perc * max_baterry_capacity;
            let time = (current_perc * element.Charge_Time) / max_baterry_capacity;

            curveTable.push({
                plugType: charge_plug,
                capacity: Math.round((current_perc + Number.EPSILON) * 100) / 100,
                time: Math.round((time + Number.EPSILON) * 100) / 100
            });

            perc += 0.2;
        }

        Object.assign(element, { chargingCurveTable: curveTable });
        result.push(element);
    }

    if (fastCharge_plug !== null) {

        let curveTable = [];
        let perc = 0.2;

        let charger = {
            Charge_Power: fastCharge_power,
            Charge_Time: fastCharge_time,
            Charge_Speed: fastCharge_speed
        };

        while (perc <= 1) {
            let current_perc = perc * max_baterry_capacity;
            let time = (current_perc * charger.Charge_Time) / max_baterry_capacity;

            curveTable.push({
                plugType: fastCharge_plug,
                capacity: Math.round((current_perc + Number.EPSILON) * 100) / 100,
                time: Math.round((time + Number.EPSILON) * 100) / 100
            });

            perc += 0.2;
        }

        Object.assign(charger, { chargingCurveTable: curveTable });
        result.push(charger);

        console.log(charger);

    }

    return result;

}*/

module.exports = router;