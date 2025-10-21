import { DEVICES_TYPES } from '../utils/enums/devicesTypes';

const axios = require('axios');
const commonLog = '[ controllerHandler ';

//DB 
const controller = require('../models/controllers');

async function getControllerById(controllerId) {
    const context = `${commonLog} getControllerById ]`;
    try {
        if (!controllerId) {
            console.error(`[${context}] Missing required parameters`, { controllerId });
            throw new Error('Missing required parameters');
        }
        return await controller.findOne({ _id: controllerId }).lean();
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}

async function setPlugsSetPointsOnComms(hwId, plugId, controllerId, updateObject) {
    const context = `${commonLog} setPlugsSetPointsOnComms ]`;
    if (!hwId || !plugId || !controllerId || !updateObject) {
        console.error(`[${context}] Missing required parameters`, { hwId, plugId, controllerId, updateObject });
        throw new Error('Missing required parameters');
    }

    const controller = await getControllerById(controllerId);
    if (!controller) {
        console.error(`[${context}] Controller not found`, { controllerId });
        throw new Error('Controller not found');
    }
    let data = {
        protocol: controller.interface,
        deviceId: controller.deviceId,
        model: controller.model,
        controllerId: controller._id,
        deviceType: DEVICES_TYPES.CHARGER,
        hwId: hwId,
        updateObject
    }
    const response = await axios.post(`${process.env.HostComms}${process.env.UpdateCommsDeviceSetpoints}`, data);
    if (response.status !== 200) {
        console.error(`${context} Error `, response);
        throw new Error(response.message);
    }
    return true
}

module.exports = {
    setPlugsSetPointsOnComms
}
