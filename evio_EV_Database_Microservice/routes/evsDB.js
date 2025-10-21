const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
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
var moment = require('moment');

const DatabaseEV = require('../models/database_EVs');

function getEVDatabase() {
    getBEVDatabase();
    getPHEVDatabase();
}



const getBEVDatabase = (() => {
    return new Promise((resolve, reject) => {
        var host = process.env.URLv31 + '/bev/' + process.env.ID + '/' + process.env.KEY;
        axios.get(host)
            .then((result) => {


                for (let i = 0; i < result.data.length; i++) {
                    let value = result.data[i];

            
                    updateOrCreateDatabaseEV(value)
                        .then(() => {
                            if (i == result.data.length - 1) {
                                resolve(true);
                            }
                        });

                }

            })

    })
});

const getPHEVDatabase = (() => {
    return new Promise((resolve, reject) => {
        var host = process.env.URLv31 + '/phev/' + process.env.ID + '/' + process.env.KEY;
        axios.get(host)
            .then((result) => {

                for (let i = 0; i < result.data.length; i++) {
                    let value = result.data[i];

                    updateOrCreateDatabaseEV(value)
                        .then(() => {
                            if (i == result.data.length - 1) {
                                resolve(true);
                            }
                        });

                }

            })

    })
});

const updateOrCreateDatabaseEV = ((data) => {
    return new Promise((resolve, reject) => {

        let Charge_Standard_Table = null;
        let Charge_Alternative_Table = null;
        let Charge_Option_Table = null;
        let Fastcharge_Table = null;

        if (data.Charge_Standard_Table != null) {
            Charge_Standard_Table = [];
            let list = Object.keys(data.Charge_Standard_Table);

            for (let charge_id of list) {

                let entry = {
                    chargeInfo: charge_id,
                    EVSE_PhaseVolt: data.Charge_Standard_Table[charge_id].EVSE_PhaseVolt,
                    EVSE_PhaseAmp: data.Charge_Standard_Table[charge_id].EVSE_PhaseAmp,
                    EVSE_Phase: data.Charge_Standard_Table[charge_id].EVSE_Phase,
                    EVSE_Power: data.Charge_Standard_Table[charge_id].EVSE_Power,
                    Charge_PhaseVolt: data.Charge_Standard_Table[charge_id].Charge_PhaseVolt,
                    Charge_PhaseAmp: data.Charge_Standard_Table[charge_id].Charge_PhaseAmp,
                    Charge_Phase: data.Charge_Standard_Table[charge_id].Charge_Phase,
                    Charge_Power: data.Charge_Standard_Table[charge_id].Charge_Power,
                    Charge_Time: data.Charge_Standard_Table[charge_id].Charge_Time,
                    Charge_Speed: data.Charge_Standard_Table[charge_id].Charge_Speed
                };

                Charge_Standard_Table.push(entry);
            }
        }

        if (data.Charge_Alternative_Table != null) {
            Charge_Alternative_Table = [];
            let list = Object.keys(data.Charge_Alternative_Table);

            for (let charge_id of list) {

                let entry = {
                    chargeInfo: charge_id,
                    EVSE_PhaseVolt: data.Charge_Alternative_Table[charge_id].EVSE_PhaseVolt,
                    EVSE_PhaseAmp: data.Charge_Alternative_Table[charge_id].EVSE_PhaseAmp,
                    EVSE_Phase: data.Charge_Alternative_Table[charge_id].EVSE_Phase,
                    EVSE_Power: data.Charge_Alternative_Table[charge_id].EVSE_Power,
                    Charge_PhaseVolt: data.Charge_Alternative_Table[charge_id].Charge_PhaseVolt,
                    Charge_PhaseAmp: data.Charge_Alternative_Table[charge_id].Charge_PhaseAmp,
                    Charge_Phase: data.Charge_Alternative_Table[charge_id].Charge_Phase,
                    Charge_Power: data.Charge_Alternative_Table[charge_id].Charge_Power,
                    Charge_Time: data.Charge_Alternative_Table[charge_id].Charge_Time,
                    Charge_Speed: data.Charge_Alternative_Table[charge_id].Charge_Speed
                };

                Charge_Alternative_Table.push(entry);
            }
        }

        if (data.Charge_Option_Table != null) {
            Charge_Option_Table = [];
            let list = Object.keys(data.Charge_Option_Table);

            for (let charge_id of list) {

                let entry = {
                    chargeInfo: charge_id,
                    EVSE_PhaseVolt: data.Charge_Option_Table[charge_id].EVSE_PhaseVolt,
                    EVSE_PhaseAmp: data.Charge_Option_Table[charge_id].EVSE_PhaseAmp,
                    EVSE_Phase: data.Charge_Option_Table[charge_id].EVSE_Phase,
                    EVSE_Power: data.Charge_Option_Table[charge_id].EVSE_Power,
                    Charge_PhaseVolt: data.Charge_Option_Table[charge_id].Charge_PhaseVolt,
                    Charge_PhaseAmp: data.Charge_Option_Table[charge_id].Charge_PhaseAmp,
                    Charge_Phase: data.Charge_Option_Table[charge_id].Charge_Phase,
                    Charge_Power: data.Charge_Option_Table[charge_id].Charge_Power,
                    Charge_Time: data.Charge_Option_Table[charge_id].Charge_Time,
                    Charge_Speed: data.Charge_Option_Table[charge_id].Charge_Speed
                };

                Charge_Option_Table.push(entry);
            }
        }


        if (data.Fastcharge_Table != null) {
            Fastcharge_Table = [];
            let list = Object.keys(data.Fastcharge_Table);

            for (let charge_id of list) {

                let entry = {
                    chargeInfo: charge_id,
                    Fastcharge_Power_Max: data.Fastcharge_Table[charge_id].Fastcharge_Power_Max,
                    Fastcharge_Power_Avg: data.Fastcharge_Table[charge_id].Fastcharge_Power_Avg,
                    Fastcharge_ChargeTime: data.Fastcharge_Table[charge_id].Fastcharge_ChargeTime,
                    Fastcharge_ChargeSpeed: data.Fastcharge_Table[charge_id].Fastcharge_ChargeSpeed,
                    Fastcharge_Limited: data.Fastcharge_Table[charge_id].Fastcharge_Limited,
                    Fastcharge_Avg_Limited: data.Fastcharge_Table[charge_id].Fastcharge_Avg_Limited
                };

                Fastcharge_Table.push(entry);
            }
        }

        let databaseEVInfo = {
            Vehicle_ID: data.Vehicle_ID,
            Vehicle_Make: data.Vehicle_Make,
            Vehicle_Model: data.Vehicle_Model,
            Vehicle_Model_Version: data.Vehicle_Model_Version,
            Availability_Status: data.Availability_Status,
            Availability_Date_From: data.Availability_Date_From,
            Availability_Date_To: data.Availability_Date_To,
            Drivetrain_Type: data.Drivetrain_Type,
            Range_WLTP: data.Range_WLTP,
            Range_WLTP_Estimate: data.Range_WLTP_Estimate,
            Range_NEDC: data.Range_NEDC,
            Range_NEDC_Estimate: data.Range_NEDC_Estimate,
            Range_Real: data.Range_Real,
            Range_Real_Mode: data.Range_Real_Mode,
            Range_Real_WHwy: data.Range_Real_WHwy,
            Range_Real_WCmb: data.Range_Real_WCmb,
            Range_Real_WCty: data.Range_Real_WCty,
            Range_Real_BHwy: data.Range_Real_BHwy,
            Range_Real_BCmb: data.Range_Real_BCmb,
            Range_Real_BCty: data.Range_Real_BCty,
            Efficiency_WLTP: data.Efficiency_WLTP,
            Efficiency_WLTP_FuelEq: data.Efficiency_WLTP_FuelEq,
            Efficiency_WLTP_V: data.Efficiency_WLTP_V,
            Efficiency_WLTP_FuelEq_V: data.Efficiency_WLTP_FuelEq_V,
            Efficiency_WLTP_CO2: data.Efficiency_WLTP_CO2,
            Efficiency_NEDC: data.Efficiency_NEDC,
            Efficiency_NEDC_FuelEq: data.Efficiency_NEDC_FuelEq,
            Efficiency_NEDC_V: data.Efficiency_NEDC_V,
            Efficiency_NEDC_FuelEq_V: data.Efficiency_NEDC_FuelEq_V,
            Efficiency_NEDC_CO2: data.Efficiency_NEDC_CO2,
            Efficiency_Real: data.Efficiency_Real,
            Efficiency_Real_FuelEq_V: data.Efficiency_Real_FuelEq_V,
            Efficiency_Real_CO2: data.Efficiency_Real_CO2,
            Efficiency_Real_WHwy: data.Efficiency_Real_WHwy,
            Efficiency_Real_WCmb: data.Efficiency_Real_WCmb,
            Efficiency_Real_WCty: data.Efficiency_Real_WCty,
            Efficiency_Real_BHwy: data.Efficiency_Real_BHwy,
            Efficiency_Real_BCmb: data.Efficiency_Real_BCmb,
            Efficiency_Real_BCty: data.Efficiency_Real_BCty,
            Charge_Plug: data.Charge_Plug,
            Charge_Plug_Estimate: data.Charge_Plug_Estimate,
            Charge_Plug_Location: data.Charge_Plug_Location,
            Charge_Standard_Power: data.Charge_Standard_Power,
            Charge_Standard_Phase: data.Charge_Standard_Phase,
            Charge_Standard_PhaseAmp: data.Charge_Standard_PhaseAmp,
            Charge_Standard_ChargeTime: data.Charge_Standard_ChargeTime,
            Charge_Standard_ChargeSpeed: data.Charge_Standard_ChargeSpeed,
            Charge_Standard_Estimate: data.Charge_Standard_Estimate,
            Charge_Standard_Table: Charge_Standard_Table,
            Charge_Alternative_Power: data.Charge_Alternative_Power,
            Charge_Alternative_Phase: data.Charge_Alternative_Phase,
            Charge_Alternative_PhaseAmp: data.Charge_Alternative_PhaseAmp,
            Charge_Alternative_ChargeTime: data.Charge_Alternative_ChargeTime,
            Charge_Alternative_ChargeSpeed: data.Charge_Alternative_ChargeSpeed,
            Charge_Alternative_Table: Charge_Alternative_Table,
            Charge_Option_Power: data.Charge_Option_Power,
            Charge_Option_Phase: data.Charge_Option_Phase,
            Charge_Option_PhaseAmp: data.Charge_Option_PhaseAmp,
            Charge_Option_ChargeTime: data.Charge_Option_ChargeTime,
            Charge_Option_ChargeSpeed: data.Charge_Option_ChargeSpeed,
            Charge_Option_Table: Charge_Option_Table,
            Fastcharge_Plug: data.Fastcharge_Plug,
            Fastcharge_Plug_Estimate: data.Fastcharge_Plug_Estimate,
            Fastcharge_Plug_Location: data.Fastcharge_Plug_Location,
            Fastcharge_Power_Max: data.Fastcharge_Power_Max,
            Fastcharge_Power_Avg: data.Fastcharge_Power_Avg,
            Fastcharge_ChargeTime: data.Fastcharge_ChargeTime,
            Fastcharge_ChargeSpeed: data.Fastcharge_ChargeSpeed,
            Fastcharge_Optional: data.Fastcharge_Optional,
            Fastcharge_Autocharge: data.Fastcharge_Autocharge,
            Fastcharge_ISO15118_PnC: data.Fastcharge_ISO15118_PnC,
            Fastcharge_ISO15118_PnC_Support_2: data.Fastcharge_ISO15118_PnC_Support_2,
            Fastcharge_ISO15118_PnC_Support_20: data.Fastcharge_ISO15118_PnC_Support_20,
            Fastcharge_Estimate: data.Fastcharge_Estimate,
            Fastcharge_Table: Fastcharge_Table,
            Battery_Capacity_Useable: data.Battery_Capacity_Useable,
            Battery_Capacity_Full: data.Battery_Capacity_Full,
            Battery_Capacity_Estimate: data.Battery_Capacity_Estimate,
            ICE_Efficiency_NEDC: data.ICE_Efficiency_NEDC,
            ICE_Efficiency_NEDC_CO2: data.ICE_Efficiency_NEDC_CO2,
            ICE_Efficiency_NEDC_BattEmpty: data.ICE_Efficiency_NEDC_BattEmpty,
            ICE_Efficiency_NEDC_BattEmpty_CO2: data.ICE_Efficiency_NEDC_BattEmpty_CO2,
            ICE_Efficiency_Real_25km: data.ICE_Efficiency_Real_25km,
            ICE_Efficiency_Real_50km: data.ICE_Efficiency_Real_50km,
            ICE_Efficiency_Real_100km: data.ICE_Efficiency_Real_100km,
            ICE_Efficiency_Real_25km_CO2: data.ICE_Efficiency_Real_25km_CO2,
            ICE_Efficiency_Real_50km_CO2: data.ICE_Efficiency_Real_50km_CO2,
            ICE_Efficiency_Real_100km_CO2: data.ICE_Efficiency_Real_100km_CO2,
            ICE_Efficiency_Real_BattEmpty: data.ICE_Efficiency_Real_BattEmpty,
            ICE_Efficiency_Real_BattEmpty_CO2: data.ICE_Efficiency_Real_BattEmpty_CO2,
            ICE_Range_NEDC: data.ICE_Range_NEDC,
            ICE_Range_NEDC_Total: data.ICE_Range_NEDC_Total,
            ICE_Range_Real: data.ICE_Range_Real,
            ICE_Range_Real_Total: data.ICE_Range_Real_Total,
            ICE_FuelTank_Capacity: data.ICE_FuelTank_Capacity,
            ICE_Displacement: data.ICE_Displacement,
            Related_Vehicle_ID_Succesor: data.Related_Vehicle_ID_Succesor,
            EVDB_Detail_URL: data.EVDB_Detail_URL,
            Images: data.Images,
            Videos: data.Videos
        }

        let query = { Vehicle_ID: data.Vehicle_ID };
        DatabaseEV.updateEV(query, { $set: databaseEVInfo }, (err, doc) => {
            if (doc != null) {
                console.log("Updated " + databaseEVInfo.Vehicle_ID);
                resolve(true);
            } else {
                const new_ev = new DatabaseEV(databaseEVInfo);
                DatabaseEV.createEV(new_ev, (ev, result) => {
                    if (result) {
                        console.log("Created " + databaseEVInfo.Vehicle_ID);
                        resolve(true);
                    } else {
                        console.log("Not created");
                    }
                })
            }
        })

    })
});

//Runs at 5:00 everyday
cron.schedule('0 5 * * *', () => {
    console.log("Updated PHEV database");
    getPHEVDatabase();
});

//Runs at 5:05 everyday
cron.schedule('5 5 * * *', () => {
    console.log("Updated BEV database");
    getBEVDatabase();
});

//getBEVDatabase()
//getEVDatabase();

module.exports = router;