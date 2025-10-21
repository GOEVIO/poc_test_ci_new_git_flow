import { Request, Response } from 'express';
import chargerModelsModel from '../models/chargerModels';
import { BadRequest, errorResponse } from '../utils/errorHandling';
import processExcelFiles from '../scripts/importFromExcel';

const commonLog = '[ chargerModels service ]';

async function importExcel(req: Request, res: Response): Promise<Response> {
    const context = `${commonLog} import excel to database ]`;

    try {
        const { manufacturer, modelName } = req.body;
        console.log(`Received manufacturer: ${manufacturer}, modelName: ${modelName}`);

        const existingModel = await chargerModelsModel.findOne({ manufacturer, modelName });
        if (existingModel) {
            throw BadRequest({
                auth: false,
                code: 'chargerModel_already_exists',
                message: 'Manufacturer and ModelName combination already exists',
            });
        }

        // Process each file
        if (req.files) {
                for (const file of req.files as any) {
                    await processExcelFiles(file.buffer, manufacturer, modelName);
                }
            }

        return res.status(200).send({ message: 'Excel files imported successfully.' });

    } catch (error) {
        return errorResponse(res, error, context);
    }
}

export default { importExcel };
