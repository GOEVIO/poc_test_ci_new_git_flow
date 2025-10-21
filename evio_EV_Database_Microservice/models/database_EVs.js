const mongoose = require('mongoose');

const { Schema } = mongoose;

const Charge_Standard_Table_Model = new Schema({
    id: { type: String, index: true },
    chargeInfo: { type: String },
    EVSE_PhaseVolt: { type: Number },
    EVSE_PhaseAmp: { type: Number },
    EVSE_Phase: { type: Number },
    EVSE_Power: { type: Number },
    Charge_PhaseVolt: { type: Number },
    Charge_PhaseAmp: { type: Number },
    Charge_Phase: { type: Number },
    Charge_Power: { type: Number },
    Charge_Time: { type: Number },
    Charge_Speed: { type: Number }
});

const Charge_Alternative_Table_Model = new Schema({
    id: { type: String, index: true },
    chargeInfo: { type: String },
    EVSE_PhaseVolt: { type: Number },
    EVSE_PhaseAmp: { type: Number },
    EVSE_Phase: { type: Number },
    EVSE_Power: { type: Number },
    Charge_PhaseVolt: { type: Number },
    Charge_PhaseAmp: { type: Number },
    Charge_Phase: { type: Number },
    Charge_Power: { type: Number },
    Charge_Time: { type: Number },
    Charge_Speed: { type: Number }
});

const Charge_Option_Table_Model = new Schema({
    id: { type: String, index: true },
    chargeInfo: { type: String },
    EVSE_PhaseVolt: { type: Number },
    EVSE_PhaseAmp: { type: Number },
    EVSE_Phase: { type: Number },
    EVSE_Power: { type: Number },
    Charge_PhaseVolt: { type: Number },
    Charge_PhaseAmp: { type: Number },
    Charge_Phase: { type: Number },
    Charge_Power: { type: Number },
    Charge_Time: { type: Number },
    Charge_Speed: { type: Number }
});

const Fastcharge_Table_Model = new Schema({
    id: { type: String, index: true },
    chargeInfo: { type: String },
    Fastcharge_Power_Max: { type: Number },
    Fastcharge_Power_Avg: { type: Number },
    Fastcharge_ChargeTime: { type: Number },
    Fastcharge_ChargeSpeed: { type: Number },
    Fastcharge_Limited: { type: Boolean },
    Fastcharge_Avg_Limited: { type: Number }
});

const DatabaseEVModel = new Schema(
    {
        id: { type: String, index: true },
        Vehicle_ID: { type: Number },
        Vehicle_Make: { type: String },
        Vehicle_Model: { type: String },
        Vehicle_Model_Version: { type: String },
        Availability_Status: { type: Number },
        Availability_Date_From: { type: String },
        Availability_Date_To: { type: String },
        Drivetrain_Type: { type: String },
        Range_WLTP: { type: Number },
        Range_WLTP_Estimate: { type: Boolean },
        Range_NEDC: { type: Number },
        Range_NEDC_Estimate: { type: Boolean },
        Range_Real: { type: Number },
        Range_Real_Mode: { type: String },
        Range_Real_WHwy: { type: Number },
        Range_Real_WCmb: { type: Number },
        Range_Real_WCty: { type: Number },
        Range_Real_BHwy: { type: Number },
        Range_Real_BCmb: { type: Number },
        Range_Real_BCty: { type: Number },
        Efficiency_WLTP: { type: Number }, //float
        Efficiency_WLTP_FuelEq: { type: Number }, //float
        Efficiency_WLTP_V: { type: Number }, //float
        Efficiency_WLTP_FuelEq_V: { type: Number }, //float
        Efficiency_WLTP_CO2: { type: Number },
        Efficiency_NEDC: { type: Number }, //float
        Efficiency_NEDC_FuelEq: { type: Number }, //float
        Efficiency_NEDC_V: { type: Number }, //float,
        Efficiency_NEDC_FuelEq_V: { type: Number }, //float
        Efficiency_NEDC_CO2: { type: Number },
        Efficiency_Real: { type: Number }, //float
        Efficiency_Real_FuelEq_V: { type: Number }, //float
        Efficiency_Real_CO2: { type: Number }, //float
        Efficiency_Real_WHwy: { type: Number }, //float
        Efficiency_Real_WCmb: { type: Number }, //float
        Efficiency_Real_WCty: { type: Number }, //float
        Efficiency_Real_BHwy: { type: Number }, //float
        Efficiency_Real_BCmb: { type: Number }, //float
        Efficiency_Real_BCty: { type: Number }, //float
        Charge_Plug: { type: String },
        Charge_Plug_Estimate: { type: Boolean },
        Charge_Plug_Location: { type: String },
        Charge_Standard_Power: { type: Number }, //float
        Charge_Standard_Phase: { type: Number }, //float
        Charge_Standard_PhaseAmp: { type: Number }, //float
        Charge_Standard_ChargeTime: { type: Number }, //float
        Charge_Standard_ChargeSpeed: { type: Number }, //float
        Charge_Standard_Estimate: { type: Boolean },
        Charge_Standard_Table: [{ type: Charge_Standard_Table_Model }],
        Charge_Alternative_Power: { type: Number }, //float
        Charge_Alternative_Phase: { type: Number },
        Charge_Alternative_PhaseAmp: { type: Number }, //float
        Charge_Alternative_ChargeTime: { type: Number },
        Charge_Alternative_ChargeSpeed: { type: Number }, //float
        Charge_Alternative_Table: [{ type: Charge_Alternative_Table_Model }],
        Charge_Option_Power: { type: Number }, //float
        Charge_Option_Phase: { type: Number },
        Charge_Option_PhaseAmp: { type: Number }, //float
        Charge_Option_ChargeTime: { type: Number },
        Charge_Option_ChargeSpeed: { type: Number },
        Charge_Option_Table: [{ type: Charge_Option_Table_Model }],
        Fastcharge_Plug: { type: String },
        Fastcharge_Plug_Estimate: { type: Boolean },
        Fastcharge_Plug_Location: { type: String },
        Fastcharge_Power_Max: { type: Number },
        Fastcharge_Power_Avg: { type: Number },
        Fastcharge_ChargeTime: { type: Number },
        Fastcharge_ChargeSpeed: { type: Number },
        Fastcharge_Optional: { type: Boolean },
        Fastcharge_Autocharge: { type: Boolean },
        Fastcharge_ISO15118_PnC: { type: String },
        Fastcharge_ISO15118_PnC_Support_2: { type: String },
        Fastcharge_ISO15118_PnC_Support_20: { type: String },
        Fastcharge_Estimate: { type: Boolean },

        Fastcharge_Table: [{ type: Fastcharge_Table_Model }],
        
        Battery_Capacity_Useable: { type: Number },
        Battery_Capacity_Full: { type: Number },
        Battery_Capacity_Estimate: { type: String },
        ICE_Efficiency_NEDC: { type: Number },
        ICE_Efficiency_NEDC_CO2: { type: Number },
        ICE_Efficiency_NEDC_BattEmpty: { type: Number },
        ICE_Efficiency_NEDC_BattEmpty_CO2: { type: Number },
        ICE_Efficiency_Real_25km: { type: Number },
        ICE_Efficiency_Real_50km: { type: Number },
        ICE_Efficiency_Real_100km: { type: Number },
        ICE_Efficiency_Real_25km_CO2: { type: Number },
        ICE_Efficiency_Real_50km_CO2: { type: Number },
        ICE_Efficiency_Real_100km_CO2: { type: Number },
        ICE_Efficiency_Real_BattEmpty: { type: Number },
        ICE_Efficiency_Real_BattEmpty_CO2: { type: Number },
        ICE_Range_NEDC: { type: Number },
        ICE_Range_NEDC_Total: { type: Number },
        ICE_Range_Real: { type: Number },
        ICE_Range_Real_Total: { type: Number },
        ICE_FuelTank_Capacity: { type: Number },
        ICE_Displacement: { type: Number },
        Related_Vehicle_ID_Succesor: { type: Number },
        EVDB_Detail_URL: { type: String },
        Images: [{ type: String }],
        Videos: [{ type: String }]
    }
);

var DatabaseEVs = module.exports = mongoose.model('Database_EVs', DatabaseEVModel);

module.exports.createEV = function (newEV, callback) {
    if (newEV.Vehicle_Make && newEV.Vehicle_Make != null)
        newEV.save(callback);
};

module.exports.updateEV = function (query, values, callback) {
    DatabaseEVs.findOneAndUpdate(query, values, callback);
};

module.exports.removeEV = function (query, callback) {
    DatabaseEVs.findOneAndRemove(query, callback);
};