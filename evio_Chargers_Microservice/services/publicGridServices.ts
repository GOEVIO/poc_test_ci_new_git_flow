// Models
import publicGridModel from '../models/publicGrid';
// Utils
import { assignMeasurement } from '../utils/assignMeasurements';
// Enums
import { PUBLIC_GRID_MEASUREMENTS } from '../utils/enums/devicesMeasurementsEnums';
// Interface
import { IPutPublicGridExternalAPI, IPublicGridDocument } from '../interfaces/publicGridInterfaces';

const commonLog = '[publicGridServices ';

export async function handlePublicGridInfo(
    controller,
    device
): Promise<{
    status: boolean;
    isToSubscribe: boolean;
}> {
    const publicGrid = await publicGridModel.getByControllerIdAndDeviceId(controller._id, device.deviceId);
    if (!publicGrid) {
        const newPublicGrid = new publicGridModel({
            name: device.name,
            deviceId: device.deviceId,
            locationId: controller.locationId,
            controllerId: controller._id,
            controllerDeviceId: controller.deviceId,
            createUserId: controller.createUserId,
        });
        newPublicGrid.save();
    }
    return { status: true, isToSubscribe: true };
}

export async function handlePublicGridMeasurements(equipmentName, arrayMeasurements, time, controllerId): Promise<boolean> {
    if (arrayMeasurements.length < 1) return true;
    const measurements = createPublicGridMeasurementsObject(arrayMeasurements);
    const update = await publicGridModel.updatePublicGrid(controllerId, equipmentName, measurements);
    return update.ok === 1;
}

function createPublicGridMeasurementsObject(arrayMeasurements) {
    const context = `${commonLog} createPublicGridMeasurementsObject]`;
    let publicGrid = {};
    for (const measurement of arrayMeasurements) {
        if (!measurement.name || !measurement.valueType) continue;
        switch (measurement.name) {
            case 'POWER_ACTIVE':
            case 'LOCATION_CONSUMPTION':
                publicGrid = assignMeasurement(measurement, publicGrid, 'w', 1000, '*', PUBLIC_GRID_MEASUREMENTS, false);
                break;
            case 'CURRENT_LIMIT':
            case 'TOTAL_CURRENT':
                publicGrid = assignMeasurement(measurement, publicGrid, 'a', 1000, '/', PUBLIC_GRID_MEASUREMENTS, false);
                break;
            default:
                console.log(`[${context}] Warning - Unknown measurement ${measurement.name}`);
                continue;
        }
    }
    return publicGrid;
}

function createExternalAPIUpdateObject(meter: IPutPublicGridExternalAPI, createUserId: string): Partial<IPublicGridDocument> {
    const context = `${commonLog} createExternalAPIUpdateObject]`;
    let updateObject: Partial<IPublicGridDocument> = {
        ...meter,
        measurementDate: new Date(meter.measurementDate),
        createUserId,
        name: meter.id,
        deviceId: meter.id,
    };
    updateObject.measurementDate = new Date(meter.measurementDate);
    // if we have current per phase we will calculate the total current
    if (meter.iTot === undefined && (meter.i1 !== undefined || meter.i2 !== undefined || meter.i3 !== undefined)) {
        updateObject.totalCurrent = (meter.i1 ?? 0) + (meter.i2 ?? 0) + (meter.i3 ?? 0);
    } else {
        updateObject.totalCurrent = meter.iTot;
    }
    // if we have voltage per phase we will calculate the total voltage
    if (meter.vTot === undefined && (meter.v1 !== undefined || meter.v2 !== undefined || meter.v3 !== undefined)) {
        updateObject.v1 = meter.v1 ?? 0;
        updateObject.v2 = meter.v2 ?? 0;
        updateObject.v3 = meter.v3 ?? 0;
        // need to check if the system is 3 phase or single phase
        const numberOfPhases = (updateObject.v1 ? 1 : 0) + (updateObject.v2 ? 1 : 0) + (updateObject.v3 ? 1 : 0);
        if (numberOfPhases > 1) {
            // 3 phase system
            const averageVoltage = (updateObject.v1 + updateObject.v2 + updateObject.v3) / numberOfPhases;
            updateObject.totalVoltage = Math.round(averageVoltage * Math.sqrt(3));
        } else {
            // single phase system
            updateObject.totalVoltage = (meter.v1 ?? 0) + (meter.v2 ?? 0) + (meter.v3 ?? 0);
        }
    } else {
        updateObject.totalVoltage = meter.vTot;
    }

    if (updateObject.exportPower === undefined) updateObject.exportPower = 0;
    if (updateObject.importPower === undefined) updateObject.importPower = 0;
    updateObject.power = updateObject.importPower - updateObject.exportPower;
    return updateObject;
}

async function CreateOrUpdatePublicGrid(deviceId: string, updateObject: Partial<IPublicGridDocument>, userId: string): Promise<boolean> {
    const context = `${commonLog} CreateOrUpdatePublicGrid]`;
    return await publicGridModel.updateOrCreateExternalAPI(deviceId, updateObject, userId);
}

export default {
    handlePublicGridMeasurements,
    handlePublicGridInfo,
    createExternalAPIUpdateObject,
    CreateOrUpdatePublicGrid,
};
