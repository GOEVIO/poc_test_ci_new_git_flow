// Models
import SolarPV from '../models/solarPvs';
// Interfaces
import { ISolarPvModelDocument } from '../interfaces/solarPvInterfaces';

async function getSolarPVs(userId: string, solarPVId?: string): Promise<ISolarPvModelDocument[]> {
    return SolarPV.getPV(userId, solarPVId);
}

function formatExternalAPISolarPVs(solarPvs: ISolarPvModelDocument[]) {
    return solarPvs.map((solarPv: any) => ({
        id: solarPv._id,
        name: solarPv.name,
        description: solarPv.description,
        locationID: solarPv.locationID ?? '',
        exportEnergyActive: solarPv.exportEnergyActive,
        exportPowerActive: solarPv.exportPowerActive,
        importPowerActive: solarPv.importPowerActive ?? 0,
        powerActive: solarPv.powerProduction ?? 0,
        isOnline: solarPv.isOnline,
        updatedAt: solarPv.lastReading ? new Date(solarPv.lastReading).toISOString() : undefined,
    }));
}

export default {
    getSolarPVs,
    formatExternalAPISolarPVs,
};
