const xlsx = require('xlsx');
const ChargerModels = require('../models/chargerModels');

function extractDataFromExcel(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);
    return jsonData;
}

function convertExcelDate(excelDate) {
    if (!isNaN(excelDate)) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
    } else {
        return new Date(excelDate);
    }
}

function transformData(jsonData, manufacturer, modelName) {
    const chargerModels = [];

    jsonData.forEach((row) => {
        if (row['Service’s version'] && row['Service’s version'].startsWith('Chargers:')) {
            const chargerModel = new ChargerModels({
                manufacturer: manufacturer,
                modelName: modelName,
                active: true,
                listProtocol: [{
                    protocol: 'OCPP',
                    protocolVersion: '1.6',
                    core: row['Core'] || '',
                    remoteUnlock: row['Remote unlock'] || '',
                    lockDetection: row['Connector lock and detection'] || '',
                    remoteFirmwareUpdate: row['Remote firmware upgrade'] || '',
                    autoCharge: row['Auto charge'] || '',
                    plugAndCharge: row['Plug & charge'] || '',
                    remoteEnergyManagement: row['Remote Energy Management'] || '',
                    localEnergyManagement: row['Local Energy Management'] || '',
                    confluenceLink: '',
                    firmwareVersion: row['Firmware Version'] || '',
                    testDate: convertExcelDate(row['Testing date'])
                }],
            });

            chargerModels.push(chargerModel);
        }
    });

    return chargerModels;
}

async function insertDataIntoDb(chargerModels) {
    for (const chargerModel of chargerModels) {
        const existingModel = await ChargerModels.findModel(chargerModel.manufacturer, chargerModel.modelName);
        if (existingModel) {
            console.log(`Model ${chargerModel.modelName} by ${chargerModel.manufacturer} already exists in the database.`);
        } else {
            await chargerModel.save();
            console.log(`Inserted model ${chargerModel.modelName} by ${chargerModel.manufacturer} into the database.`);
        }
    }
}

async function processExcelFiles(buffer, manufacturer, modelName) {
    try {
        const jsonData = extractDataFromExcel(buffer);
        const transformedData = transformData(jsonData, manufacturer, modelName);
        await insertDataIntoDb(transformedData);
    } catch (err) {
        console.error(`Failed to process file:`, err);
    }
}

module.exports = processExcelFiles;
