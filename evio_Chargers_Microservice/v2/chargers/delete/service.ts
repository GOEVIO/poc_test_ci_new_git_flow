import * as repository from './repository';
import ChargingSession from '../../../models/chargingSession';
import axios from "axios";

export const deleteCharger = async (userId: string, chargerId: string): Promise<{ status: number, data: any }> => {
    const charger = await repository.findByIdAndUser(chargerId, userId);
    if (!charger) {
        return {
            status: 400,
            data: {
                auth: false,
                code: 'server_error_charger_not_found',
                message: 'Charger not found for given parameters'
            }
        };
    }

    const inUsePlugs = charger.plugs.filter((plug: any) => plug.status === process.env.PlugsStatusInUse);
    if (inUsePlugs.length > 0) {
        return {
            status: 400,
            data: {
                auth: false,
                code: 'server_error_charger_plugs_in_use',
                message: 'Charger cannot be deleted as it has plugs currently in use'
            }
        };
    }

    const hasSessions = await ChargingSession.exists({ hwId: charger.hwId });
    if (hasSessions) {
        await repository.deactivateCharger(charger._id.toString());
        return {
            status: 200,
            data: {
                message: 'Charger disabled due to existing sessions',
                chargerId: charger._id
            }
        };
    }

    if (charger.chargerType === '002') {
        await axios.post(`${process.env.HostSonOff}${process.env.PathRemoveSonOff}`, { hwId: charger.hwId });
    } else if (charger.chargerType === '007') {
        await axios.post(`${process.env.HostEVIOBox}${process.env.PathRemoveEVIOBOx}`, { hwId: charger.hwId });
    }

    const result = await repository.deleteChargerById(charger._id.toString());
    if (result.deletedCount === 0) {
        return {
            status: 400,
            data: {
                auth: false,
                code: 'server_error_charger_deletion_failed',
                message: 'Charger could not be deleted'
            }
        };
    }

    return {
        status: 200,
        data: {
            message: 'Charger successfully deleted',
            chargerId: charger._id
        }
    };
};
