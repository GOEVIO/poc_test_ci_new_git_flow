import { NextFunction, Request, Response } from 'express';
import { captureException } from '@sentry/node';
// Utils
import { BadRequest, errorResponse, ServerError } from '../utils/errorHandling';
// Interface
import { IPutPublicGridExternalAPI } from '../interfaces/publicGridInterfaces';

const commonLog = '[ publicGridMiddleware ';

function validatePutExternalAPI(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLog} validatePutExternalAPI ]`;
    try {
        if (!req.body) {
            throw BadRequest({
                status: false,
                code: 'server_missing_body',
                message: 'Missing body in the request',
            });
        }
        const externalRequest: IPutPublicGridExternalAPI[] = req.body;
        if (!Array.isArray(externalRequest)) {
            throw BadRequest({
                status: false,
                code: 'meter_invalid_request_body',
                message: 'Body should be an array of meters',
            });
        }
        for (const meterMeasurements of externalRequest) {
            if (!meterMeasurements.id) {
                throw BadRequest({
                    status: false,
                    code: 'server_body_required',
                    message: 'Missing id in request body',
                });
            }

            if (!meterMeasurements.measurementDate) {
                throw BadRequest({
                    status: false,
                    code: 'meter_missing_measurementDate',
                    message: 'Missing measurementDate in request body',
                });
            }

            if (isNaN(Date.parse(meterMeasurements.measurementDate))) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_measurementDate',
                    message: 'Invalid measurementDate in request body',
                });
            }
            // business logic - we need to assure that at least one of the current and of voltage parameters is present
            // otherwise we will not be able to calculate the power and limit the devices
            const isSetAtLeastOneCurrentParameter =
                meterMeasurements.i1 === undefined &&
                meterMeasurements.i2 === undefined &&
                meterMeasurements.i3 === undefined &&
                meterMeasurements.iTot === undefined;

            const isSetAtLeastOneVoltageParameter =
                meterMeasurements.v1 === undefined &&
                meterMeasurements.v2 === undefined &&
                meterMeasurements.v3 === undefined &&
                meterMeasurements.vTot === undefined;

            if (isSetAtLeastOneCurrentParameter) {
                throw BadRequest({
                    status: false,
                    code: 'meter_missing_current',
                    message: 'No current parameter in request body',
                });
            }
            
            if (isSetAtLeastOneVoltageParameter) {
                throw BadRequest({
                    status: false,
                    code: 'meter_missing_voltage',
                    message: 'No voltage parameter in request body',
                });
            }
            if (meterMeasurements.v1 && meterMeasurements.v1 < 0) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_v1_value',
                    message: 'v1 should be positive value',
                });
            }
            if (meterMeasurements.v2 && meterMeasurements.v2 < 0) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_v2_value',
                    message: 'v2 should be positive value',
                });
            }
            if (meterMeasurements.v3 && meterMeasurements.v3 < 0) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_v3_value',
                    message: 'v3 should be positive value',
                });
            }
            if (meterMeasurements.vTot && meterMeasurements.vTot < 0) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_vTot_value',
                    message: 'vTot should be positive value',
                });
            }
            if (meterMeasurements.exportPower && meterMeasurements.exportPower < 0) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_exportPower_value',
                    message: 'exportPower should be positive value',
                });
            }
            if (meterMeasurements.importPower && meterMeasurements.importPower < 0) {
                throw BadRequest({
                    status: false,
                    code: 'meter_invalid_importPower_value',
                    message: 'importPower should be positive value',
                });
            }
        }
        next();
    } catch (error) {
        if (!error.statusCode) {
            console.error(`${context} Error `, error);
            captureException(error.message);
        }
        errorResponse(res, error, context);
    }
}
export default { validatePutExternalAPI };
