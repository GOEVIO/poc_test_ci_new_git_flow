import { IPublicGridDocument } from '../interfaces/publicGridInterfaces';
const commonLog = '[Utils assignMeasurements ';

export function assignMeasurement(
    measurement: { name: string; unit: string; valueType: string; value: string },
    updateObject: Partial<IPublicGridDocument>,
    unit: string | null,
    conversionFactor: number | null,
    conversionOperator: string,
    properties: object,
    isUppercase: boolean
) : object {
    const context = `${commonLog} assignMeasurement]`;

    if (!measurement?.name || !measurement?.valueType || !updateObject || !properties) {
        console.error(`[${context}] Error - Missing input data `, measurement, updateObject, properties);
        throw new Error('Missing input data');
    }
    if (!properties[measurement.name]) return updateObject;

    switch (measurement.valueType) {
        case 'BOOLEAN':
            updateObject[properties[measurement.name]] = conversionOperator
                ? measurement.value.toLowerCase() === 'true'
                : !(measurement.value.toLowerCase() === 'true');
            break;
        case 'INTEGER':
        case 'LONG':
        case 'DOUBLE':
        case 'FLOAT':
            if (!measurement.unit) break;
            if (conversionOperator === '/' && conversionFactor !== null)
                updateObject[properties[measurement.name]] =
                    measurement.unit.toLowerCase() == unit
                        ? parseFloat(measurement.value).toFixed(2)
                        : Number(Number(measurement.value) / Number(conversionFactor)).toFixed(2);
            else if (conversionOperator === '*' && conversionFactor !== null)
                updateObject[properties[measurement.name]] =
                    measurement.unit.toLowerCase() == unit
                        ? parseFloat(measurement.value).toFixed(2)
                        : Number(Number(measurement.value) * Number(conversionFactor)).toFixed(2);
            else {
                updateObject[properties[measurement.name]] = parseFloat(measurement.value).toFixed(2);
            }
            break;
        case 'STRING':
            updateObject[properties[measurement.name]] = isUppercase ? measurement.value.toUpperCase() : measurement.value;
            break;
        default:
            console.error(`Unknown value type ${measurement.valueType}`);
            throw new Error(`Unknown value type ${measurement.valueType}`);
    }
    return updateObject;
}
