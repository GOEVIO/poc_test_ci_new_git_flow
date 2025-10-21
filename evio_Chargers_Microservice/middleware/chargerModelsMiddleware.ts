import { NextFunction, Request, Response } from 'express';
import moment from 'moment';

// Interfaces
import { IChargerModelsCreateRequest, IChargerModelsUpdateRequest } from '../interfaces/chargerModelsInterfaces';
// Utils
import { BadRequest, errorResponse } from '../utils/errorHandling';
import { isTestStatusValid } from '../utils/enumValidations';
import { PLUG_CONTROL_TYPES } from '../constants/measurementsConstants';
//Mongo
import { Types } from 'mongoose';

const commonLog = '[ chargerModels middleware ';

function validateCreateChargerModel(req: Request, res: Response, next: NextFunction) {
    const context = `$commonLog validateChargerModel ]`;
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_body_required',
                message: `Missing body in request`,
            });
        }

        const {
            manufacturer,
            modelName,
            protocol,
            protocolVersion,
            core,
            remoteUnlock,
            lockDetection,
            remoteFirmwareUpdate,
            autoCharge,
            plugAndCharge,
            remoteEnergyManagement,
            localEnergyManagement,
            confluenceLink,
            firmwareVersion,
            testDate, // expected format: YYYY-MM-DD
            active,
        } = req.body as IChargerModelsCreateRequest;

        if (!manufacturer) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_manufacturer_required',
                message: `Missing manufacturer`,
            });
        }

        if (!modelName) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_modelName_required',
                message: `Missing modelName`,
            });
        }

        if (!protocol) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_protocol_required',
                message: `Missing protocol`,
            });
        }
        if (!protocolVersion) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_protocolVersion_required',
                message: `Missing protocolVersion`,
            });
        }
        if (!core) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_core_required',
                message: `Missing core test value`,
            });
        }

        if (!isTestStatusValid(core)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_core_bad_value',
                message: `Invalid value for core test result`,
            });
        }

        if (!remoteUnlock) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_remoteUnlock_required',
                message: `Missing remoteUnlock test value`,
            });
        }
        if (!isTestStatusValid(remoteUnlock)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_remoteUnlock_bad_value',
                message: `Invalid value for remoteUnlock test result`,
            });
        }
        if (!lockDetection) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_lockDetection_required',
                message: `Missing lockDetection test value`,
            });
        }
        if (!isTestStatusValid(lockDetection)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_lockDetection_bad_value',
                message: `Invalid value for lockDetection test result`,
            });
        }
        if (!remoteFirmwareUpdate) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_remoteFirmwareUpdate_required',
                message: `Missing remoteFirmwareUpdate test value`,
            });
        }
        if (!isTestStatusValid(remoteFirmwareUpdate)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_remoteFirmwareUpdate_bad_value',
                message: `Invalid value for remoteFirmwareUpdate test result`,
            });
        }

        if (!autoCharge) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_autoCharge_required',
                message: `Missing autoCharge test value`,
            });
        }
        if (!isTestStatusValid(autoCharge)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_autoCharge_bad_value',
                message: `Invalid value for autoCharge test result`,
            });
        }
        if (!plugAndCharge) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_plugAndCharge_required',
                message: `Missing plugAndCharge test value`,
            });
        }
        if (!isTestStatusValid(plugAndCharge)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_plugAndCharge_bad_value',
                message: `Invalid value for plugAndCharge test result`,
            });
        }
        if (!remoteEnergyManagement) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_remoteEnergyManagement_required',
                message: `Missing remoteEnergyManagement test value`,
            });
        }
        if (!isTestStatusValid(remoteEnergyManagement)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_remoteEnergyManagement_bad_value',
                message: `Invalid value for remoteEnergyManagement test result`,
            });
        }
        if (!localEnergyManagement) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_localEnergyManagement_required',
                message: `Missing localEnergyManagement test value`,
            });
        }
        if (!isTestStatusValid(localEnergyManagement)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_localEnergyManagement_bad_value',
                message: `Invalid value for localEnergyManagement test result`,
            });
        }

        if (!confluenceLink) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_confluenceLink_required',
                message: `Missing confluenceLink to test report`,
            });
        }
        if (!firmwareVersion) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_firmwareVersion_required',
                message: `Missing firmwareVersion`,
            });
        }
        if (!testDate) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_testDate_required',
                message: `Missing testDate`,
            });
        }
        const date = moment(testDate, 'YYYY-MM-DD', true);
        if (!date.isValid()) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_testDate_wrong_format',
                message: `testDate must be a valid date in format YYYY-MM-DD`,
            });
        }
        if (typeof active !== 'boolean') {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_active_required',
                message: `Missing active`,
            });
        }
        next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
}

async function validateUpdateChargerModel(req: Request, res: Response, next: NextFunction) {
    const context = '[ chargerModels middleware validateUpdateChargerModel ]';
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_body_required',
                message: `Missing body in request`,
            });
        }

        if (!Types.ObjectId.isValid(req.params._id)) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_id_invalid',
                message: `The _id is not valid!`,
            });
        }

        const updateFields = req.body as IChargerModelsUpdateRequest;

        // Check if at least one field for update is provided
        if (Object.keys(updateFields).length === 0) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_update_fields_required',
                message: `At least one field to update must be provided`,
            });
        }

        // Validate each field for update
        for (const field in updateFields) {
            switch (field) {
                case 'listProtocol':
                    if (updateFields.listProtocol && updateFields.listProtocol.length > 0) {
                        // Validate listProtocol fields
                        updateFields.listProtocol.forEach((protocol) => {
                            if (!protocol.protocol || typeof protocol.protocol !== 'string') {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_protocol_required',
                                    message: `Missing or invalid 'protocol' field in protocol object`,
                                });
                            }
                            if (!protocol.protocolVersion) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_protocolVersion_required',
                                    message: `Missing protocolVersion`,
                                });
                            }
                            if (!protocol.core) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_core_required',
                                    message: `Missing core test value`,
                                });
                            }
                    
                            if (!isTestStatusValid(protocol.core)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_core_bad_value',
                                    message: `Invalid value for core test result`,
                                });
                            }
                    
                            if (!protocol.remoteUnlock) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_remoteUnlock_required',
                                    message: `Missing remoteUnlock test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.remoteUnlock)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_remoteUnlock_bad_value',
                                    message: `Invalid value for remoteUnlock test result`,
                                });
                            }
                            if (!protocol.lockDetection) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_lockDetection_required',
                                    message: `Missing lockDetection test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.lockDetection)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_lockDetection_bad_value',
                                    message: `Invalid value for lockDetection test result`,
                                });
                            }
                            if (!protocol.remoteFirmwareUpdate) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_remoteFirmwareUpdate_required',
                                    message: `Missing remoteFirmwareUpdate test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.remoteFirmwareUpdate)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_remoteFirmwareUpdate_bad_value',
                                    message: `Invalid value for remoteFirmwareUpdate test result`,
                                });
                            }
                    
                            if (!protocol.autoCharge) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_autoCharge_required',
                                    message: `Missing autoCharge test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.autoCharge)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_autoCharge_bad_value',
                                    message: `Invalid value for autoCharge test result`,
                                });
                            }
                            if (!protocol.plugAndCharge) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_plugAndCharge_required',
                                    message: `Missing plugAndCharge test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.plugAndCharge)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_plugAndCharge_bad_value',
                                    message: `Invalid value for plugAndCharge test result`,
                                });
                            }
                            if (!protocol.remoteEnergyManagement) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_remoteEnergyManagement_required',
                                    message: `Missing remoteEnergyManagement test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.remoteEnergyManagement)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_remoteEnergyManagement_bad_value',
                                    message: `Invalid value for remoteEnergyManagement test result`,
                                });
                            }
                            if (!protocol.localEnergyManagement) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_localEnergyManagement_required',
                                    message: `Missing localEnergyManagement test value`,
                                });
                            }
                            if (!isTestStatusValid(protocol.localEnergyManagement)) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_localEnergyManagement_bad_value',
                                    message: `Invalid value for localEnergyManagement test result`,
                                });
                            }
                    
                            if (!protocol.confluenceLink) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_confluenceLink_required',
                                    message: `Missing confluenceLink to test report`,
                                });
                            }
                            if (!protocol.firmwareVersion) {
                                throw BadRequest({
                                    auth: false,
                                    code: 'chargerModel_firmwareVersion_required',
                                    message: `Missing firmwareVersion`,
                                });
                            }
                        });
                    }
                    break;
                case 'active':
                    if (updateFields.active !== undefined && typeof updateFields.active !== 'boolean') {
                        throw BadRequest({
                            auth: false,
                            code: 'chargerModel_active_invalid',
                            message: `Active must be a boolean if provided`,
                        });
                    }
                    break;
                case 'manufacturer':
                    if (updateFields.manufacturer && typeof updateFields.manufacturer !== 'string') {
                        throw BadRequest({
                            auth: false,
                            code: 'chargerModel_manufacturer_invalid',
                            message: `Manufacturer must be a string if provided`,
                        });
                    }
                    break;
                case 'modelName':
                    if (updateFields.modelName && typeof updateFields.modelName !== 'string') {
                        throw BadRequest({
                            auth: false,
                            code: 'chargerModel_modelName_invalid',
                            message: `Charge model must be a string if provided`,
                        });
                    }
                    break;
                default:
                    break;
            }
        }

        next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
}

function ValidatePlugsSetPointsRequest(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLog} ValidatePlugsSetPointsRequest ]`;
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw BadRequest({
                auth: false,
                code: 'missing_body',
                message: `Missing body in request`,
            });
        }
        const { hwId, plugId, userId, controlType, minActivePower, setCurrentLimit } = req.body;
        if (!hwId) {
            throw BadRequest({
                auth: false,
                code: 'missing_hwId',
                message: `Missing hwId`,
            });
        }
        if (!plugId) {
            throw BadRequest({
                auth: false,
                code: 'missing_plugId',
                message: `Missing plugId`,
            });
        }
        if (!controlType || !PLUG_CONTROL_TYPES.includes(controlType)) {
            throw BadRequest({
                auth: false,
                code: 'missing_controlType',
                message: `Missing or invalid controlType`,
            });
        }
        if (!userId) {
            throw BadRequest({
                auth: false,
                code: 'missing_userId',
                message: `Missing userId`,
            });
        }
        if (minActivePower && typeof minActivePower !== 'number') {
            throw BadRequest({
                auth: false,
                code: 'invalid_minActivePower',
                message: `Invalid minActivePower`,
            });
        }
        if (setCurrentLimit && typeof setCurrentLimit !== 'number') {
            throw BadRequest({
                auth: false,
                code: 'invalid_setCurrentLimit',
                message: `Invalid setCurrentLimit`,
            });
        }
        next();
    } catch (error) {
        if (error.message) console.error(`${context}Error -`, error.message);
        return errorResponse(res, error, context);
    }
}

export default {
    validateCreateChargerModel,
    validateUpdateChargerModel,
    ValidatePlugsSetPointsRequest,
};
