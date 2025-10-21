const TariffsTAR = require('../models/tariffTar');
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};

module.exports = {
    forceJobTariffTarUpdate: () => {
        const context = "Function forceJobTariffTarUpdate";
        return new Promise(async (resolve, reject) => {
            tariffTarUpdate()
            resolve("Tariff Tar Update Job Status was executed")
        })

    },
    tariffTarUpdate

}

var taskTariffTar = null;
initJogTariffTarUpdate('00 00 01 06 *')
    .then(() => {
        taskTariffTar.start();
        console.log("Tariff Tar Update")
    })
    .catch(error => {
        console.log("Error starting Tariff Tar Update Job: " + error.message)
    });

function initJogTariffTarUpdate(timer) {
    return new Promise((resolve, reject) => {

        taskTariffTar = cron.schedule(timer, () => {
            console.log('Running Job Tariff Tar Update: ' + new Date().toISOString());


            tariffTarUpdate();
        }, {
            scheduled: false
        });

        resolve();

    });
};

//tariffTarUpdate()

async function tariffTarUpdate() {
    const context = "Function tariffTarUpdate";
    try {

        let activeTariffs = await TariffsTAR.find({ active: true, tariffType: "server_bi_hour" }).lean()
        const newTar = buildTarTariffArrayObject(0.0253, 0.0151, 0.1170, 0.0812, 0.0136, 0.0701, 0.0130, 0.0675)
        const dateNow = new Date()

        for (tariff of activeTariffs) {
            await TariffsTAR.updateMany({ _id: tariff._id }, { $set: { active: false } })
            delete tariff._id
            delete tariff.createdAt
            delete tariff.updatedAt
            const newTariffTAR = new TariffsTAR(tariff)
            newTariffTAR.tariff = newTar
            newTariffTAR.dateToActivate = dateNow
            await newTariffTAR.save()
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function buildTarTariffArrayObject(btnEmpty, mtEmpty, btnOutEmpty, mtOutEmpty, atEmpty, atOutEmpty, matEmpty, matOutEmpty) {
    return [
        {
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'BTN',
            price: btnEmpty

        },
        {
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'BTN',
            price: btnOutEmpty
        },
        {
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'BTE',
            price: btnEmpty
        },
        {
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'BTE',
            price: btnOutEmpty
        },
        {
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'MT',
            price: mtEmpty
        },
        {
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'MT',
            price: mtOutEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'AT',
            price: atEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'AT',
            price: atOutEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_empty',
            voltageLevel: 'MAT',
            price: matEmpty
        },
        {
            power: 'all',
            uom: '€/kWh',
            tariffType: 'server_out_empty',
            voltageLevel: 'MAT',
            price: matOutEmpty
        }
    ];
}