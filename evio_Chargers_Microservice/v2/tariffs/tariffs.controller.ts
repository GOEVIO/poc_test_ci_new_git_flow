import { Request, Response } from 'express';
import { getChargerTariff, updateChargerTariff } from './tariffs.service';
import { buildAccessGroups } from "../chargers/helpers/buildAccessGroups";

export const getTariff = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['userid']?.toString() || (req.query.userId as string);
        const hwId = req.query.hwId as string;
        const plugId = req.query.plugId as string;

        const tariffs = await getChargerTariff(userId, hwId, plugId);

        return res.status(200).json(tariffs);
    } catch (error: any) {
        console.error('Error listing charger images:', error.message);
        return res.status(500).json({ auth: false, code: 'internal_server_error', message: "Internal server error" });
    }
};

export const updateTariff = async (req: Request, res: Response) => {
    try {
        const received = req.body;
        if (!received._id) {
            return res.status(400).json({ auth: false, code: "server_error_id_required", message: "Id is required" });
        }
        if (!received.plugId) {
            return res.status(400).json({ auth: false, code: "server_error_plug_id_required", message: "Plug Id is required" });
        }

        const updatedCharger = await updateChargerTariff(received._id, received.plugId, received.tariff);

        const accessGroups = await buildAccessGroups(updatedCharger, req.headers.userid as string);

        return res.status(200).json({
            isShownOnTheMap: updatedCharger.mapVisibility,
            allowRFID: updatedCharger.allowRFID,
            access: updatedCharger.accessType,
            accessGroups: accessGroups.map(group => ({
                id: group.id,
                name: group.name,
                type: group.type,
                plugs: (group.plugs || []).map(plug => ({
                    plugId: plug.plugId,
                    tariffId: plug.tariffId || '',
                    name: plug.name || 'No tariff'
                }))
            }))
        });
    } catch (error: any) {
        console.error(`[Update Tariff] Error:`, error.message);
        return res.status(500).json({ auth: false, code: 'internal_server_error', message: "Internal server error" });
    }
};
