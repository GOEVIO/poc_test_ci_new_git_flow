const express = require("express");
const router = express.Router();
const Controllers = require("../models/controllers")
const Locations = require("../models/locations")

async function getControllerByDeviceId(deviceId){
    const context = "[routes controller getControllerByDeviceId]";
    try {
        if(!deviceId){
            console.error(`${context} Error - Missing deviceId data ${deviceId}`);
            throw new Error("Missing deviceId data");
        }
        return await Controllers.findOne({'deviceId':deviceId})
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
} 


//========== PATCH ==========
//PATCH to update Info from ioT devices
// req {
//    deviceId: string;
//    updateInfo: {
//          serial: string | null;
//          localIp: string | null;
//          osVersion: string | null;
//          softwareVersion: string | null;
//          hwVersion: string | null;
//          }
//}
router.patch("/api/private/controllers/info", async (req, res, next) => {
    const context = "[Patch /api/private/controllers/info]";
    try {
        const { deviceId, updateInfo } = req.body;
        if (!updateInfo || !deviceId) {
            console.error(`${context} Error - Missing Input data ${deviceId} ${updateInfo}`);
            return res.status(400).send({status:false, message: "Missing Input data"});
        }
        const controller = await Controllers.findOneAndUpdate({'deviceId':deviceId}, {$set:{'updateInfo':updateInfo}})
        if(!controller){
            console.error(`${context} Error - Fail to update ${deviceId}`);
            return res.status(500).send({status:false, message: `Controller deviceId not found ${deviceId}`});
        }
        // update the location connection Status
        if(controller.locationId){
            await Locations.findByIdAndUpdate({'_id':controller.locationId}, {$set:{'online':true, 'onlineStatusChangedDate':new Date()}})
        }
        return res.status(200).send({status:true});
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

module.exports = router;