import { NextFunction, Request, Response } from 'express';
import { ObjectId as ObjectID } from 'mongodb';
// Utils
import { BadRequest, errorResponse } from '../utils/errorHandling';
// Enums
import { SHARING_MODES, CHARGING_MODES } from '../utils/enums/switchboardsEnums';

const commonLog = '[ switchboardsMiddleware ';

function validateConfigSwitchboard(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLog} validateConfigSwitchboard]`;
    try {
        if (!req.params.id) {
            throw BadRequest({
                status: false,
                code: 'server_switchboard_id_required',
                message: 'SwitchBoard id is required',
            });
        }

        if (!ObjectID.isValid(req.params.id)) {
            throw BadRequest({
                status: false,
                code: 'invalid_id',
                message: 'Invalid id format',
            });
        }

        next();
    } catch (error) {
        if (!error.statusCode) console.error(`${context} Error `, error);
        return errorResponse(res, error, context);
    }
}

function validatePatchSwitchboard(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLog} validatePatchSwitchboard]`;
    try {
        if (!req.params.id) {
            throw BadRequest({
                status: false,
                code: 'server_switchboard_id_required',
                message: 'SwitchBoard id is required',
            });
        }

        if (!ObjectID.isValid(req.params.id)) {
            throw BadRequest({
                status: false,
                code: 'invalid_id',
                message: 'Invalid id format',
            });
        }
        if (!req.body) {
            throw BadRequest({
                status: false,
                code: 'switchboard_body_required',
                message: 'SwitchBoard body is required',
            });
        }
        const {
            name,
            cpe,
            chargingMode,
            minSolarCurrent,
            sharingMode,
            currentLimit,
        }: { name: string; cpe: string; chargingMode: CHARGING_MODES; minSolarCurrent?: number; sharingMode: SHARING_MODES; currentLimit: number } =
            req.body;
        if (!name) {
            throw BadRequest({
                status: false,
                code: 'switchboard_name_required',
                message: 'SwitchBoard name is required',
            });
        }
        if (name.length > 30) {
            throw BadRequest({
                status: false,
                code: 'switchboard_name_length',
                message: 'SwitchBoard name must be at most 30 characters length',
            });
        }
        if (!chargingMode) {
            throw BadRequest({
                status: false,
                code: 'switchboard_charging_mode_required',
                message: 'SwitchBoard charging mode is required',
            });
        }
        if (!Object.values(CHARGING_MODES).includes(chargingMode)) {
            throw BadRequest({
                status: false,
                code: 'switchboard_charging_mode_invalid',
                message: 'Invalid charging mode',
            });
        }

        if (sharingMode && !Object.values(SHARING_MODES).includes(sharingMode)) {
            throw BadRequest({
                status: false,
                code: 'switchboard_sharing_mode_invalid',
                message: 'Sharing mode is invalid',
            });
        }

        if (minSolarCurrent && minSolarCurrent < 0) {
            throw BadRequest({
                status: false,
                code: 'switchboard_minSolarCurrent_invalid',
                message: 'SwitchBoard minSolarCurrent must be positive number',
            });
        }

        if (currentLimit && currentLimit < 0) {
            throw BadRequest({
                status: false,
                code: 'switchboard_current_limit_invalid',
                message: 'SwitchBoard current limit must be positive number',
            });
        }
        next();
    } catch (error) {
        if (!error.statusCode) console.error(`${context} Error `, error);
        return errorResponse(res, error, context);
    }
}

export default {
    validateConfigSwitchboard,
    validatePatchSwitchboard,
};
