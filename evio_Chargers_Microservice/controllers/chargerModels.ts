import { Request, Response } from 'express';
// Interfaces
import { IChargerModelsCreateRequest, IChargerModelsUpdateRequest } from '../interfaces/chargerModelsInterfaces';
// Controllers
import chargerModelsModel from '../models/chargerModels';
// Utils
import { BadRequest, ServerError, NotFound, errorResponse } from '../utils/errorHandling';

const commonLog = '[ chargerModels controller ';

async function createNewModel(req: Request, res: Response) {
    const context = `${commonLog}createNewModel ]`;
    try {
        // Get the request body
        const chargerModelRequest = req.body as IChargerModelsCreateRequest;

        const chargerModelFound = await chargerModelsModel.findModel(chargerModelRequest.manufacturer, chargerModelRequest.modelName);
        if (chargerModelFound && Object.keys(chargerModelFound).length > 0) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_already_exists',
                message: `Charger model already exists`,
            });
        }
        const newChargerModel = await chargerModelsModel.createNewModel(chargerModelRequest);
        if (!newChargerModel) {
            console.error(`${context} - Failed to create charger model `, chargerModelRequest);
            throw ServerError({
                auth: false,
                code: 'chargerModel_creation_failed',
                message: `Failed to create charger model`,
            });
        }
        return res.status(200).send(newChargerModel);
    } catch (error) {
        return errorResponse(res, error, context);
    }
}

async function getChargerModelsGroupByBrand(req: Request, res: Response) {
    const context = `${commonLog} getChargerModelsGroupByBrand ]`;
    try {
        const result = await chargerModelsModel.getModelsGroupByBrand();
        return res.status(200).send(result);
    } catch (error) {
        return errorResponse(res, error, context);
    }
}

async function updateChargerModel(req: Request, res: Response) {
    const context = `${commonLog} updateChargerModel ]`;

    try {
        const { _id } = req.params;
        let updateFields: IChargerModelsUpdateRequest = req.body;

        const existCharger =  await chargerModelsModel.findByIdModel( _id );
        if(!existCharger){
            throw NotFound({
                auth: false,
                code: 'chargerModel_id_does_not_exists',
                message: `Id of Charger model id does not exists`,
            });
        }

        // validate manufactor e modelName
        if(updateFields.manufacturer !== existCharger.manufacturer || updateFields.modelName !== existCharger.modelName){
            const existingModel = await chargerModelsModel.findOne({
                _id: { $ne: _id },
                manufacturer: updateFields.manufacturer ?? existCharger.manufacturer,
                modelName: updateFields.modelName ?? existCharger.modelName
            });
            if (existingModel) {
                throw BadRequest({
                    auth: false,
                    code: 'chargerModel_already_exists',
                    message: `manufacturer and modelName combination already exists`,
                });
            }
        }

        if (updateFields.listProtocol !== undefined && updateFields.listProtocol.length > 0) {
            //Verify if any of the protocol fields have been altered
            const protocolFieldsChanged = updateFields.listProtocol.some(newProtocol =>
                !existCharger.listProtocol.some(existingProtocol =>
                    existingProtocol.protocol === newProtocol.protocol &&
                    existingProtocol.protocolVersion === newProtocol.protocolVersion &&
                    existingProtocol.firmwareVersion === newProtocol.firmwareVersion
                )
            );

            if (protocolFieldsChanged) {
                updateFields.listProtocol.forEach(newProtocol => {
                    const existingProtocolIndex = existCharger.listProtocol.findIndex(existingProtocol =>
                        existingProtocol.protocol === newProtocol.protocol &&
                        existingProtocol.protocolVersion === newProtocol.protocolVersion &&
                        existingProtocol.firmwareVersion === newProtocol.firmwareVersion
                    );

                    if (existingProtocolIndex === -1) {
                        existCharger.listProtocol.push(newProtocol);
                    } else {
                        existCharger.listProtocol[existingProtocolIndex] = newProtocol;
                    }
                });

                updateFields = {
                    ...updateFields,
                    listProtocol: existCharger.listProtocol
                };
            }
        }

        const updatedModel = await chargerModelsModel.updateChargerModel(_id, updateFields);
        if (!updatedModel) {
            throw ServerError({
                auth: false,
                code: 'chargerModel_update_failed',
                message: `Failed to update charger model`,
            });
        }

        return res.status(200).send(updatedModel);

    } catch (error) {
        return errorResponse(res, error, context);
    }
}

export default {
    createNewModel,
    getChargerModelsGroupByBrand,
    updateChargerModel
};
