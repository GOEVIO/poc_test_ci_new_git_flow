const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const { parse } = require('json2csv');
const axios = require("axios");
const Excel = require('exceljs');
const nodemailer = require("nodemailer");
const JsonFind = require("json-find");
const Utils = require('../utils/Utils');
const Invoice = require('../models/Invoice');
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
const moment = require('moment');
const axiosS = require("../services/axios");
const nodemailerS = require("../services/nodemailer");


const monitoringMapping = require('../models/MonitoringMapping.json');
const jsonFile = JsonFind(monitoringMapping);

const monitoringMappingEVIO = require('../models/MonitoringMappingEVIO.json');
const mappingJsonEVIO = JsonFind(monitoringMappingEVIO);

var ocpiProxy = 'http://ocpi-22:3019';
const completedBillingProxy = `${ocpiProxy}/api/private/billing/completedBillings`;

var identityProxy = 'http://identity:3003';
const userInfoById = `${identityProxy}/api/private/users/byId`;

var evsProxy = 'http://evs:3006';
const evInfoById = `${evsProxy}/api/private/ev/byId`;

//===== POST =====
router.post('/api/private/billing/createCDRsDocument', (req, res, next) => {
    var context = "POST /api/private/billing/createCDRsDocument";
    try {

        if (!req.body.cdr_start_date) {
            return res.status(400).send({ code: 'cdr_start_date_missing', message: "Missing cdr start date" });
        }

        if (!req.body.cdr_end_date) {
            return res.status(400).send({ code: 'cdr_end_date_missing', message: "Missing cdr end date" });
        }

        getCompletedOCPIBillings(req.body)
            .then((result) => {

                createCSVDocument(result)
                    .then((buffer) => {

                        //sendEmail
                        Utils.sendCSVDocumentToSupport(buffer, req.body)
                            .then(() => {
                                console.log("Email sent");
                                return res.status(200).send("File created and sent with success");
                            }).catch(() => {
                                console.log("Email not sent");
                                return res.status(400).send("File created but failed to be sent");
                            });

                    })
                    .catch((error) => {
                        console.log(`[${context}] Error `, error);
                        return res.status(400).send("Could not create csv file");
                    });

            })
            .catch((error) => {
                console.log(`[${context}] Error `, error);
                return res.status(400).send("Failed to retreive cdrs information");
            });

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    };

});

let task;
initJobCreateEvioChargerOwmerDocument("0 0 9 * *").then(() => {

    console.log("Create EVIO Charger Owmer Document Job Started")

    task.start();
});


router.post('/api/private/billing/createEvioChargerOwmerDocument/startJob', (req, res) => {
    var context = "POST /api/private/billing/createEvioChargerOwmerDocument/startJob";
    var timer = "0 0 9 * *";

    if (req.body.timer)
        timer = req.body.timer;

    try {

        initJobCreateEvioChargerOwmerDocument(timer).then(() => {

            console.log("Create EVIO Charger Owmer Document Job Started")

            task.start();
            return res.status(200).send('Create EVIO Charger Owmer Document Job Started');
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/billing/createEvioChargerOwmerDocument/stopJob', (req, res) => {
    var context = "POST /api/private/billing/createEvioChargerOwmerDocument/stopJob";

    try {
        task.stop();
        console.log("Create EVIO Charger Owmer Document Job Stopped")
        return res.status(200).send('Create EVIO Charger Owmer Document Job Stopped');
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/billing/createEvioChargerOwmerDocument/statusJob', (req, res) => {
    var context = "POST /api/private/billing/createEvioChargerOwmerDocument/statusJob";

    try {
        var status = "Stopped";
        if (task != undefined) {
            status = task.status;
        }

        return res.status(200).send({ "Create EVIO Charger Owmer Document Job Status": status });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    };
});

router.post('/api/private/billing/createEvioChargerOwmerDocument', async (req, res, next) => {
    var context = "POST /api/private/billing/createEvioChargerOwmerDocument";
    try {

        await createEvioChargerOwmerDocument(req)

        return res.status(200).send();
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send();
    }
});

async function createEvioChargerOwmerDocument(req) {
    var context = "Function createEvioChargerOwmerDocument";
    try {

        if (!req.body.start_date) {
            console.log("start_date is needed")
            return;
        }

        if (!req.body.end_date) {
            console.log("end_date is needed")
            return;
        }

        let sendEmailToUsers = false;
        if (req.body.sendEmailToUsers) {
            sendEmailToUsers = req.body.sendEmailToUsers
        }

        let debug = false;
        if (req.body.debug) {
            debug = req.body.debug
        }

        console.log("Start Data 2: " + req.body.start_date)

        console.log("End Data 2: " + req.body.end_date)

        //console.log(req.body)

        let completedSessions = await getCompletedSessionsEVIO(req.body)

        console.log("completedSessions.length: " + completedSessions.length)

        let uniqueChargerOwners = [];
        let uniqueChargerOwnersEmails = [];

        for (let i = 0; i != completedSessions.length; i++) {
            if (!uniqueChargerOwners.includes(completedSessions[i].charger_owner)) {
                uniqueChargerOwners.push(completedSessions[i].charger_owner)
                uniqueChargerOwnersEmails.push(completedSessions[i].chargerOwnerEmail)
            }
        }

        console.log("UNIQUE: " + uniqueChargerOwners)

        let organizedSessions = [];

        for (let i = 0; i != uniqueChargerOwners.length; i++) {
            let tempSessions = [];
            for (let j = 0; j != completedSessions.length; j++) {
                if (uniqueChargerOwners[i] == completedSessions[j].charger_owner)
                    tempSessions.push(completedSessions[j]);
            }
            organizedSessions.push(tempSessions);
        }

        let buffers = []
        let filesNames = []

        for (let i = 0; i != organizedSessions.length; i++) {

            let completedSessions = [];
            let unCompletedSessions = [];
            let alreadyCommissionedSessions = [];
            let sessionsIdToBeFlaged = []

            //Parse sessions from their status
            await parseSessionsStatus(organizedSessions[i], completedSessions, unCompletedSessions, alreadyCommissionedSessions, sessionsIdToBeFlaged)



            //Write excel
            let workbook = new Excel.Workbook();

            let completedSessionsSheet = workbook.addWorksheet('Sessões faturadas');
            let unCompletedSessionsSheet = workbook.addWorksheet('Incobráveis');


            parseExcelClient(completedSessionsSheet, completedSessions);
            parseExcelClient(unCompletedSessionsSheet, unCompletedSessions);

            let buffer = await workbook.xlsx.writeBuffer();

            let alreadyCommissionedSessionsSheet = workbook.addWorksheet('Sessões já faturadas');

            parseExcelClient(alreadyCommissionedSessionsSheet, alreadyCommissionedSessions);

            if (!debug)
                await patchSetSessionsCommissioned(sessionsIdToBeFlaged)

            let bufferToSupport = await workbook.xlsx.writeBuffer();

            buffers.push(bufferToSupport)
            filesNames.push('Resumo de sessões - ' + req.body.start_date + ' - ' + req.body.end_date + ' - ' + uniqueChargerOwners[i] + '.xlsx')

            let month = parseMonth(req.body.end_date)

            let emailText =
                `Exmos Srs,

Vimos por este meio enviar o extrato dos montantes relativos ao mês ` + month + ` relativos aos consumos dos vossos postos em regime de rentabilização.
No ficheiro é apresentado o montante a faturar à EVIO relativo ao total dos consumos, assim como o montante de comissão pela utilização da plataforma a faturar pela EVIO.

Melhores cumprimentos,
EVIO - Electrical Mobility`

            let emailSubjext = "EVIO - " + uniqueChargerOwners[i] + " - Extracto Consumos por Terceiros - " + month + " - rentabilização"

            let fileName = "Sessões - " + month + ' - ' + uniqueChargerOwners[i] + '.xlsx'

            //Send excel to owner of the charger
            console.log(sendEmailToUsers)

            let ccClientes = [];

            if (sendEmailToUsers) {
                if (process.env.NODE_ENV === 'production') {
                    console.log("Sending individual emails are commented for safety")
                    if (uniqueChargerOwnersEmails[i]) {
                        if (!debug) {
                            ccClientes.push(process.env.EMAIL_EVIO)
                            ccClientes.push(process.env.EMAIL_BARBABRA)
                            ccClientes.push(process.env.EMAIL_INES)
                        }
                        ccClientes.push(process.env.EMAIL_TEST_2)
                        console.log("It would have sent email to: " + uniqueChargerOwnersEmails[i])
                        console.log("Sending to EVIO MAIL instead")
                        //Texto para email
                        //await nodemailerS.sendEmailFromSupport(uniqueChargerOwnersEmails[i], [buffer],  [fileName], emailSubjext, emailText, cc)
                        await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], emailSubjext, emailText, ccClientes)
                    }
                }
                else if (process.env.NODE_ENV === 'pre-production') {
                    emailSubjext = "[PRE] " + emailSubjext
                    ccClientes.push(process.env.EMAIL_TEST_2)
                    await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], emailSubjext, emailText, ccClientes)
                }
                else {
                    emailSubjext = "[LOCAL] " + emailSubjext
                    await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], emailSubjext, emailText, [])
                }
            }
        }

        let completedSessionsTotal = []
        let unCompletedSessionsTotal = [];
        let alreadyCommissionedSessionsTotal = [];
        let sessionsIdToBeFlagedTotal = []

        //Parse sessions from their status
        await parseSessionsStatus(completedSessions, completedSessionsTotal, unCompletedSessionsTotal, alreadyCommissionedSessionsTotal, sessionsIdToBeFlagedTotal)



        //Write excel
        let workbook = new Excel.Workbook();

        let completedSessionsSheet = workbook.addWorksheet('Sessões faturadas');
        let unCompletedSessionsSheet = workbook.addWorksheet('Incobráveis');


        parseExcel(completedSessionsSheet, completedSessionsTotal);
        parseExcel(unCompletedSessionsSheet, unCompletedSessionsTotal);

        let buffer = await workbook.xlsx.writeBuffer();

        let alreadyCommissionedSessionsSheet = workbook.addWorksheet('Sessões já faturadas');

        parseExcel(alreadyCommissionedSessionsSheet, alreadyCommissionedSessionsTotal);

        if (!debug)
            await patchSetSessionsCommissioned(sessionsIdToBeFlagedTotal)

        let bufferToSupport = await workbook.xlsx.writeBuffer();

        buffers.push(bufferToSupport)
        filesNames.push('Resumo de sessões - ' + req.body.start_date + ' - ' + req.body.end_date + ' - All.xlsx')


        //SeAnd email to support with all files
        let cc = [];

        if (process.env.NODE_ENV === 'production') {
            if (!debug) {
                cc.push(process.env.EMAIL_EVIO)
                //cc.push(process.env.EMAIL_ARMANDO)
                cc.push(process.env.EMAIL_BARBABRA)
                cc.push(process.env.EMAIL_INES)
            }
            cc.push(process.env.EMAIL_TEST_2)
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, buffers, filesNames, '[PROD] Invoicing from: ' + req.body.start_date + ', to: ' + req.body.end_date, "", cc);
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            cc.push(process.env.EMAIL_TEST_2)
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, buffers, filesNames, '[PRE] Invoicing from: ' + req.body.start_date + ', to: ' + req.body.end_date, "", cc);
        }
        else {
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, buffers, filesNames, '[LOCAL] Invoicing from: ' + req.body.start_date + ', to: ' + req.body.end_datem, "", []);
        }
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return;
    }
}

async function parseSessionsStatus(completeSessions, completedSessions, unCompletedSessions, alreadyCinussionedSessions, sessionsIdToBeFlaged) {
    var context = "Function parseSessionsStatus";
    try {

        //get lis of sessions ids
        let sessionsIds = [];

        for (let i = 0; i != completeSessions.length; i++) {
            sessionsIds.push(completeSessions[i].sessionId)
        }

        //get sessions from sessionsIds
        let sessions = await getSessions(sessionsIds);

        completeSessions.forEach(session => {
            //console.log(session)
            for (let i = 0; i != sessions.length; i++) {
                if (session.sessionId == sessions[i].sessionId) {
                    if (session.clientName == "EVIO") {
                        if (session.invoiceStatus && session.paymentStatus == 'PAID') {
                            if (sessions[i].b2bComissioned)
                                alreadyCinussionedSessions.push(session)
                            else {
                                completedSessions.push(session)
                                sessionsIdToBeFlaged.push(session.sessionId)
                            }
                        }
                        else
                            unCompletedSessions.push(session);
                    }
                }
            }
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
    }
}

function parseExcel(sheet, sessions) {
    var context = "Function parseExcel";
    try {

        //console.log(sessions)


        sheet.columns = [
            {
                header: 'Data Início', key: 'Data Início', width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Data Fim", key: "Data Fim", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "ID Posto", key: "ID Posto", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Consumo (kWh)", key: "Consumo (kWh)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tempo (min)", key: "Tempo (min)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tipo de tarifa", key: "Tipo de tarifa", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa de ativação (€)", key: "Tarifa de ativação (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa de serviços de carregamento (€/kWh)", key: "Tarifa de serviços de carregamento (€/kWh)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa utilização durante carregamento (€/min)", key: "Tarifa utilização durante carregamento (€/min)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa utilização após carregamento (€/min)", key: "Tarifa utilização após carregamento (€/min)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total de Serviço por kWh (€)", key: "Total de Serviço por kWh (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total de Serviço por min (€)", key: "Total de Serviço por min (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Utilização durante o carregamento (€)", key: "Utilização durante o carregamento (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Utilização após carregamento (€)", key: "Utilização após carregamento (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total Sessão S/IVA (€)", key: "Total Sessão S/IVA (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "IVA (%)", key: "IVA (%)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total Sessão C/IVA (€)", key: "Total Sessão C/IVA (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Fee variavel(%)", key: "Fee variavel(%)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Fee fixo mínimo (€)", key: "Fee fixo mínimo (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Fee EVIO (€)", key: "Fee EVIO (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "User Id do Condutor", key: "User Id", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "User name do Condutor", key: "User name", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },

            {
                header: "NIF do Condutor", key: "NIF name", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "User Id do Responsavel", key: "User Id Responsavel", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "User name do Responsavel", key: "User name Responsavel", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "NIF do Responsavel", key: "NIF Responsavel", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },

        ];

        /*
        sheet.addRow([
            "Data Início", "Data Fim",
            "ID Posto", "Consumo (kWh)",
            "Tempo (min)",
            "Tarifa de ativação (€)", "Tarifa de serviços de carregamento (€/kWh)",
            "Tarifa utilização durante carregamento (€/min)", "Tarifa utilização após carregamento (€/min)",
            "Total de Serviço por kWh (€)", "Total de Serviço por min (€)",
            "Utilização durante o carregamento (€)", "Utilização após carregamento (€)",
            "Total Sessão S/IVA (€)", "IVA (%)",
            "Total Sessão C/IVA (€)",
            "Fee variavel(%)", "Fee fixo mínimo (€)",
            "Fee EVIO (€)"
        ]);
        */

        for (let i = 0; i != 26; i++) {
            let x = String.fromCharCode(65 + i);
            x = x + 1;
            sheet.getCell(x).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F0669933' },
            };
            sheet.getCell(x).font = {
                name: 'Calibri',
                color: { argb: 'FFFFFFFF' },
                bold: true
            };
        }

        sheet.getRow(1).height = 100;

        //Summations
        let totalEnergy = 0;
        let totalTime = 0;
        let totalCostDuringChargeEnergy = 0;
        let totalCostDuringChargeTime = 0;
        let totalParkingDuringCharging = 0;
        let totalParkingAfterCharging = 0;
        let totalExclVat = 0;
        let totalInclVat = 0;
        let totalEVIOFee = 0;

        for (let i = 0; i != sessions.length; i++) {
            let percentageTariff = parseFloat(process.env.PERCENTAGE_DEFAULT);
            let minimumFeeTariff = parseFloat(process.env.MIN_AMOUNT_DEFAULT);
            let especialClients = [];

            if (sessions[i].chargerOwnerEVIOTariff) {
                if (sessions[i].chargerOwnerEVIOTariff.percentage !== undefined && sessions[i].chargerOwnerEVIOTariff.percentage !== null)
                    percentageTariff = sessions[i].chargerOwnerEVIOTariff.percentage;
                if (sessions[i].chargerOwnerEVIOTariff.minAmount !== undefined && sessions[i].chargerOwnerEVIOTariff.minAmount !== null)
                    minimumFeeTariff = sessions[i].chargerOwnerEVIOTariff.minAmount;
                if (sessions[i].chargerOwnerEVIOTariff.specialClients)
                    especialClients = sessions[i].chargerOwnerEVIOTariff.specialClients;
            }

            for (let i = 0; i != especialClients.length; i++) {
                if (especialClients[i].userId == sessions[i].userIdWillPay) {
                    percentageTariff = especialClients[i].percentage
                    minimumFeeTariff = especialClients[i].minAmount
                }
            }

            let comissionEVIO = 0;

            if (sessions[i].total_incl_vat * percentageTariff > minimumFeeTariff)
                comissionEVIO = sessions[i].total_incl_vat * percentageTariff
            else
                comissionEVIO = minimumFeeTariff;


            totalEnergy += sessions[i].total_energy;
            totalTime += sessions[i].total_time;
            totalCostDuringChargeEnergy += sessions[i].cost_during_charge_energy;
            totalCostDuringChargeTime += sessions[i].cost_during_charge_time;
            totalParkingDuringCharging += sessions[i].parking_during_charging;
            totalParkingAfterCharging += sessions[i].parking_after_charging;
            totalExclVat += sessions[i].total_excl_vat;
            totalInclVat += sessions[i].total_incl_vat;
            totalEVIOFee += comissionEVIO;

            sheet.addRow([
                //"Data Início", "Data Fim",
                sessions[i].startDate, sessions[i].stopDate,
                //"ID Posto", "Consumo (kWh)",
                sessions[i].hwId, sessions[i].total_energy,
                //"Tempo (min)",
                sessions[i].total_time,
                //Tipo de tarifa
                sessions[i].tariffType,
                //"Tarifa de ativação (€)", "Tarifa de serviços de carregamento (€/kWh)", 
                sessions[i].flat_cost, sessions[i].chargingValue,
                //"Tarifa utilização durante carregamento (€/min)", "Tarifa utilização após carregamento (€/min)",
                sessions[i].parkingDuringChargingValue, sessions[i].parkingValue,
                //"Total de Serviço por kWh (€)", "Total de Serviço por min (€)",
                sessions[i].cost_during_charge_energy, sessions[i].cost_during_charge_time,
                //"Utilização durante o carregamento (€)", "Utilização após carregamento (€)",
                sessions[i].parking_during_charging, sessions[i].parking_after_charging,
                //"Total Sessão S/IVA (€)", "IVA (%)",
                sessions[i].total_excl_vat, sessions[i].vat,
                //"Total Sessão C/IVA (€)",
                sessions[i].total_incl_vat,
                //"Fee variavel(%)", "Fee fixo mínimo (€)",
                percentageTariff, minimumFeeTariff,
                //"Fee EVIO (€)"
                comissionEVIO.toFixed(2),
                //"User Id"
                sessions[i].userId,
                //"User name"
                sessions[i].userName,
                //"NIF name"
                sessions[i].userNIF,
                //"User Id Responsavel"
                sessions[i].userIdWillPay,
                //"User name Responsavel"
                sessions[i].userIdWillPayName,
                //"User Responsavel"
                sessions[i].userWillPayNIF,
            ]);
        }

        //add Summations to the sheet
        sheet.addRow([
            //"Data Início", "Data Fim",
            "", "",
            //"ID Posto", "Consumo (kWh)",
            "", totalEnergy,
            //"Tempo (min)",
            totalTime,
            //Tipo de tarifa
            "",
            //"Tarifa de ativação (€)", "Tarifa de serviços de carregamento (€/kWh)", 
            "", "",
            //"Tarifa utilização durante carregamento (€/min)", "Tarifa utilização após carregamento (€/min)",
            "", "",
            //"Total de Serviço por kWh (€)", "Total de Serviço por min (€)",
            totalCostDuringChargeEnergy, totalCostDuringChargeTime,
            //"Utilização durante o carregamento (€)", "Utilização após carregamento (€)",
            totalParkingDuringCharging, totalParkingAfterCharging,
            //"Total Sessão S/IVA (€)", "IVA (%)",
            totalExclVat, "",
            //"Total Sessão C/IVA (€)",
            totalInclVat,
            //"Fee variavel(%)", "Fee fixo mínimo (€)",
            "", "",
            //"Fee EVIO (€)"
            totalEVIOFee,
            //"User Id"
            "",
            //"User name"
            "",
            //"NIF name"
            "",
            //"User Id Responsavel"
            "",
            //"User name Responsavel"
            "",
            //"NIF Responsavel"
            "",
        ]);
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
    }
}

function parseExcelClient(sheet, sessions) {
    var context = "Function parseExcel";
    try {

        //console.log(sessions)


        sheet.columns = [
            {
                header: 'Data Início', key: 'Data Início', width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Data Fim", key: "Data Fim", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "ID Posto", key: "ID Posto", width: 40, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Consumo (kWh)", key: "Consumo (kWh)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tempo (min)", key: "Tempo (min)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tipo de tarifa", key: "Tipo de tarifa", width: 20, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa de ativação (€)", key: "Tarifa de ativação (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa de serviços de carregamento (€/kWh)", key: "Tarifa de serviços de carregamento (€/kWh)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa utilização durante carregamento (€/min)", key: "Tarifa utilização durante carregamento (€/min)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Tarifa utilização após carregamento (€/min)", key: "Tarifa utilização após carregamento (€/min)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total de Serviço por kWh (€)", key: "Total de Serviço por kWh (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total de Serviço por min (€)", key: "Total de Serviço por min (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Utilização durante o carregamento (€)", key: "Utilização durante o carregamento (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Utilização após carregamento (€)", key: "Utilização após carregamento (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total Sessão S/IVA (€)", key: "Total Sessão S/IVA (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "IVA (%)", key: "IVA (%)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Total Sessão C/IVA (€)", key: "Total Sessão C/IVA (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Fee variavel(%)", key: "Fee variavel(%)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Fee fixo mínimo (€)", key: "Fee fixo mínimo (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "Fee EVIO (€)", key: "Fee EVIO (€)", width: 10, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "NIF do Condutor", key: "NIF name", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },
            {
                header: "NIF do Responsavel", key: "NIF Responsavel", width: 30, style: {
                    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
                }
            },

        ];

        /*
        sheet.addRow([
            "Data Início", "Data Fim",
            "ID Posto", "Consumo (kWh)",
            "Tempo (min)",
            "Tarifa de ativação (€)", "Tarifa de serviços de carregamento (€/kWh)",
            "Tarifa utilização durante carregamento (€/min)", "Tarifa utilização após carregamento (€/min)",
            "Total de Serviço por kWh (€)", "Total de Serviço por min (€)",
            "Utilização durante o carregamento (€)", "Utilização após carregamento (€)",
            "Total Sessão S/IVA (€)", "IVA (%)",
            "Total Sessão C/IVA (€)",
            "Fee variavel(%)", "Fee fixo mínimo (€)",
            "Fee EVIO (€)"
        ]);
        */

        for (let i = 0; i != 22; i++) {
            let x = String.fromCharCode(65 + i);
            x = x + 1;
            sheet.getCell(x).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'F0669933' },
            };
            sheet.getCell(x).font = {
                name: 'Calibri',
                color: { argb: 'FFFFFFFF' },
                bold: true
            };
        }

        sheet.getRow(1).height = 100;

        //Summations
        let totalEnergy = 0;
        let totalTime = 0;
        let totalCostDuringChargeEnergy = 0;
        let totalCostDuringChargeTime = 0;
        let totalParkingDuringCharging = 0;
        let totalParkingAfterCharging = 0;
        let totalExclVat = 0;
        let totalInclVat = 0;
        let totalEVIOFee = 0;

        for (let i = 0; i != sessions.length; i++) {
            let percentageTariff = parseFloat(process.env.PERCENTAGE_DEFAULT);
            let minimumFeeTariff = parseFloat(process.env.MIN_AMOUNT_DEFAULT);
            let especialClients = [];

            if (sessions[i].chargerOwnerEVIOTariff) {
                if (sessions[i].chargerOwnerEVIOTariff.percentage !== undefined && sessions[i].chargerOwnerEVIOTariff.percentage !== null)
                    percentageTariff = sessions[i].chargerOwnerEVIOTariff.percentage;
                if (sessions[i].chargerOwnerEVIOTariff.minAmount !== undefined && sessions[i].chargerOwnerEVIOTariff.minAmount !== null)
                    minimumFeeTariff = sessions[i].chargerOwnerEVIOTariff.minAmount;
                if (sessions[i].chargerOwnerEVIOTariff.specialClients)
                    especialClients = sessions[i].chargerOwnerEVIOTariff.specialClients;
            }

            for (let i = 0; i != especialClients.length; i++) {
                if (especialClients[i].userId == sessions[i].userIdWillPay) {
                    percentageTariff = especialClients[i].percentage
                    minimumFeeTariff = especialClients[i].minAmount
                }
            }

            let comissionEVIO = 0;

            if (sessions[i].total_incl_vat * percentageTariff > minimumFeeTariff)
                comissionEVIO = sessions[i].total_incl_vat * percentageTariff
            else
                comissionEVIO = minimumFeeTariff;


            totalEnergy += sessions[i].total_energy;
            totalTime += sessions[i].total_time;
            totalCostDuringChargeEnergy += sessions[i].cost_during_charge_energy;
            totalCostDuringChargeTime += sessions[i].cost_during_charge_time;
            totalParkingDuringCharging += sessions[i].parking_during_charging;
            totalParkingAfterCharging += sessions[i].parking_after_charging;
            totalExclVat += sessions[i].total_excl_vat;
            totalInclVat += sessions[i].total_incl_vat;
            totalEVIOFee += comissionEVIO;

            let userNIF = ""
            if (sessions[i].userNIF.length > 3) {
                userNIF = sessions[i].userNIF[0] + "*****" + sessions[i].userNIF.slice(-3);
            }

            let userWillPayNIF = ""
            if (sessions[i].userWillPayNIF.length > 3) {
                userWillPayNIF = sessions[i].userWillPayNIF[0] + "*****" + sessions[i].userWillPayNIF.slice(-3);
            }

            sheet.addRow([
                //"Data Início", "Data Fim",
                sessions[i].startDate, sessions[i].stopDate,
                //"ID Posto", "Consumo (kWh)",
                sessions[i].hwId, sessions[i].total_energy,
                //"Tempo (min)",
                sessions[i].total_time,
                //Tipo de tarifa
                sessions[i].tariffType,
                //"Tarifa de ativação (€)", "Tarifa de serviços de carregamento (€/kWh)", 
                sessions[i].flat_cost, sessions[i].chargingValue,
                //"Tarifa utilização durante carregamento (€/min)", "Tarifa utilização após carregamento (€/min)",
                sessions[i].parkingDuringChargingValue, sessions[i].parkingValue,
                //"Total de Serviço por kWh (€)", "Total de Serviço por min (€)",
                sessions[i].cost_during_charge_energy, sessions[i].cost_during_charge_time,
                //"Utilização durante o carregamento (€)", "Utilização após carregamento (€)",
                sessions[i].parking_during_charging, sessions[i].parking_after_charging,
                //"Total Sessão S/IVA (€)", "IVA (%)",
                sessions[i].total_excl_vat, sessions[i].vat,
                //"Total Sessão C/IVA (€)",
                sessions[i].total_incl_vat,
                //"Fee variavel(%)", "Fee fixo mínimo (€)",
                percentageTariff, minimumFeeTariff,
                //"Fee EVIO (€)"
                comissionEVIO.toFixed(2),
                //"NIF name"
                userNIF,
                //"User Responsavel"
                userWillPayNIF,
            ]);
        }

        //add Summations to the sheet
        sheet.addRow([
            //"Data Início", "Data Fim",
            "", "",
            //"ID Posto", "Consumo (kWh)",
            "", totalEnergy,
            //"Tempo (min)",
            totalTime,
            //Tipo de tarifa
            "",
            //"Tarifa de ativação (€)", "Tarifa de serviços de carregamento (€/kWh)", 
            "", "",
            //"Tarifa utilização durante carregamento (€/min)", "Tarifa utilização após carregamento (€/min)",
            "", "",
            //"Total de Serviço por kWh (€)", "Total de Serviço por min (€)",
            totalCostDuringChargeEnergy, totalCostDuringChargeTime,
            //"Utilização durante o carregamento (€)", "Utilização após carregamento (€)",
            totalParkingDuringCharging, totalParkingAfterCharging,
            //"Total Sessão S/IVA (€)", "IVA (%)",
            totalExclVat, "",
            //"Total Sessão C/IVA (€)",
            totalInclVat,
            //"Fee variavel(%)", "Fee fixo mínimo (€)",
            "", "",
            //"Fee EVIO (€)"
            totalEVIOFee,
            //"NIF name"
            "",
            //"NIF Responsavel"
            "",
        ]);
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
    }
}


async function patchSetSessionsCommissioned(sessionsIds) {
    var context = "FUNCTION patchSetSessionsCommissioned";
    try {
        let params = { sessionId: sessionsIds }

        let host = process.env.HostCharger + process.env.PathPatchSetSessionsCommissioned

        return await axiosS.axiosPatch(host, params);
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
    }
}

function initJobCreateEvioChargerOwmerDocument(timer) {
    return new Promise((resolve, reject) => {

        task = cron.schedule(timer, () => {

            console.log('Running Job reate EVIO Charger Owmer Document ' + new Date().toISOString());

            let req = []
            req.body = {
                "end_date": moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
                "start_date": moment().subtract(2, 'month').startOf('month').format('YYYY-MM-DD')
            }

            console.log("Start date: " + req.body.start_date)
            console.log("End date: " + req.body.end_date)

            console.log(req.body)

            createEvioChargerOwmerDocument(req)
        }, {
            scheduled: false
        });

        resolve();

    });

};

function parseMonth(date) {
    let monthNumber = date[5] + date[6];

    switch (monthNumber) {
        case "01":
            return "Janeiro";
        case "02":
            return "Fevereiro";
        case "03":
            return "Março";
        case "04":
            return "Abril";
        case "05":
            return "Maio";
        case "06":
            return "Junho";
        case "07":
            return "Julho";
        case "08":
            return "Agosto";
        case "09":
            return "Setembro";
        case "10":
            return "Outubro";
        case "11":
            return "Novembro";
        case "12":
            return "Dezembro";
        default:
            return monthNumber;
    }
}

router.post('/api/private/billing/createEvioSessionsDocument', async (req, res, next) => {
    var context = "POST /api/private/billing/createEvioSessionsDocument";
    try {

        if (!req.body.start_date) {
            return res.status(400).send({ code: 'start_date_missing', message: "Missing start date" });
        }

        if (!req.body.end_date) {
            return res.status(400).send({ code: 'end_date_missing', message: "Missing end date" });
        }



        let completedSessions = await getCompletedSessionsEVIO(req.body)
        if (completedSessions.length > 0) {
            // return res.status(200).send(completedSessions);

            createCSVDocumentEVIO(completedSessions)
                .then((buffer) => {

                    Utils.sendEVIOCSVDocumentToSupport(buffer, req.body)
                        .then(() => {
                            console.log("Email sent");
                            return res.status(200).send("File created and sent with success");
                        }).catch(() => {
                            console.log("Email not sent");
                            return res.status(400).send("File created but failed to be sent");
                        });

                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error);
                    return res.status(400).send("Could not create csv file");
                });
        } else {
            return res.status(400).send({ code: 'no_completed_sessions', message: "There are no completed sessions or chargers service failed" });
        }


    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    };

});

async function getSessions(sessionsIds) {
    var context = "FUNCTION getSessions";
    return new Promise((resolve, reject) => {

        let params = {
            sessionId: sessionsIds
        }

        let host = process.env.HostCharger + process.env.PathGetChargerQuery

        axios.get(host, { params: params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error`, error);
                reject();
            });
    });
}

async function getCompletedSessionsEVIO(body) {
    var context = "Function getCompletedSessionsEVIO";
    try {
        let host = process.env.HostCharger + process.env.PathGetChargingSession
        let resp = await axios.get(host, { data: body })
        if (resp.data) {
            let retreivedData = await retrieveInformationEVIO(resp.data)
            return retreivedData
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return []
    }
}

//===== FUNCTION =====
function createCSVDocument(data) {
    return new Promise((resolve, reject) => {

        if (data.length !== 0) {

            const csv = parse(data);

            let entries = csv.split("\n");
            let legend = entries.shift();

            CSVMapping(legend, entries)
                .then((csv) => {
                    resolve(csv);
                })
                .catch(() => {
                    reject();
                });

        }
        else {
            reject();
        }

    });
}

function createCSVDocumentEVIO(data) {
    return new Promise((resolve, reject) => {

        if (data.length !== 0) {

            const csv = parse(data);

            let entries = csv.split("\n");
            let legend = entries.shift();
            CSVMappingEVIO(legend, entries)
                .then((csv) => {
                    resolve(csv);
                })
                .catch(() => {
                    reject();
                });

        }
        else {
            reject();
        }

    });
}

function CSVMapping(legend, entries) {
    var context = "FUNCTION CSVMapping";
    return new Promise((resolve, reject) => {

        let mapping = "";
        let keys = legend.split(",");

        for (let index = 0; index < keys.length; index++) {
            const element = keys[index];

            let key = element.split('"');

            if (keys.length - 1 === index) {
                mapping += '"' + jsonFile[key[1]] + '"';
            }
            else {
                mapping += '"' + jsonFile[key[1]] + '",';
            }
        }

        let data = mapping + '\n';

        for (let index = 0; index < entries.length; index++) {
            const element = entries[index];

            if (entries.length - 1 === index) {
                data += element;
            }
            else {
                data += element + '\n';
            }
        }

        resolve(data);
    });
}

function CSVMappingEVIO(legend, entries) {
    var context = "FUNCTION CSVMapping";
    return new Promise((resolve, reject) => {

        let mapping = "";
        let keys = legend.split(",");

        for (let index = 0; index < keys.length; index++) {
            const element = keys[index];

            let key = element.split('"');

            if (keys.length - 1 === index) {
                mapping += '"' + mappingJsonEVIO[key[1]] + '"';
            }
            else {
                mapping += '"' + mappingJsonEVIO[key[1]] + '",';
            }
        }

        let data = mapping + '\n';

        for (let index = 0; index < entries.length; index++) {
            const element = entries[index];

            if (entries.length - 1 === index) {
                data += element;
            }
            else {
                data += element + '\n';
            }
        }

        resolve(data);
    });
}

function getCompletedOCPIBillings(body) {
    var context = "FUNCTION getCompletedOCPIBillings";
    return new Promise((resolve, reject) => {

        let params = {
            cdr_start_date: body.cdr_start_date + "T00:00",
            cdr_end_date: body.cdr_end_date + "T23:59"
        }

        axios.get(completedBillingProxy, { params: params })
            .then((result) => {

                retrieveInformation(result.data)
                    .then((result) => {
                        resolve(result);
                    })
                    .catch((error) => {
                        reject(error);
                    });

            })
            .catch((error) => {
                console.error(`[${context}][.then][find] Error`, error);
                reject();
            });

    });
}

function retrieveInformation(dataset) {
    var context = "FUNCTION retrieveInformation";
    return new Promise(async (resolve, reject) => {

        let userInfo = [];
        let evInfo = [];

        for (let index = 0; index < dataset.length; index++) {
            const data = dataset[index];

            //Check user name
            let user = userInfo.find(info => info.userId === data.user);
            if (user) {
                data["user"] = user.name;
            }
            else {
                let userName = await getUserInfo(data.user);
                if (userName === undefined) {
                    data["user"] = "";
                }
                else {
                    userInfo.push({ "userId": data.user, "name": userName });
                    data["user"] = userName;
                }
            }

            //Check userWillPay name
            let userWillPay = userInfo.find(info => info.userId === data.userWillPay);
            if (userWillPay) {
                data["userWillPay"] = userWillPay.name;
            }
            else {
                let userWillPayName = await getUserInfo(data.userWillPay);
                if (userWillPayName === undefined) {
                    data["userWillPay"] = "";
                }
                else {
                    userInfo.push({ "userId": data.userWillPay, "name": userWillPayName });
                    data["userWillPay"] = userWillPayName;
                }
            }

            //Check EV licensePlate
            if (data.evId !== '-1') {
                let evId = evInfo.find(info => info.evId === data.evId);
                if (evId) {
                    data["evId"] = evId.licensePlate;
                }
                else {
                    let evLicensePlate = await getEVInfo(data.evId);
                    if (evLicensePlate === undefined) {
                        data["evId"] = "";
                    }
                    else {
                        evInfo.push({ "evId": data.evId, "licensePlate": evLicensePlate });
                        data["evId"] = evLicensePlate;
                    }
                }
            }
            else {
                data["evId"] = "Anónimo";
            }

            //Check evOwner name
            if (data.evOwner !== '-1' && data.evOwner !== "") {
                let evOwner = userInfo.find(info => info.userId === data.evOwner);
                if (evOwner) {
                    data["evOwner"] = evOwner.name;
                }
                else {
                    let evOwnerName = await getUserInfo(data.evOwner);

                    if (evOwnerName === undefined) {
                        data["evOwner"] = "";
                    }
                    else {
                        userInfo.push({ "userId": data.user, "name": evOwnerName });
                        data["evOwner"] = evOwnerName;
                    }
                }
            }
            else {
                data["evOwner"] = "Anónimo";
            }

            //Check resume_evId
            if (data.resume_evId !== '-1') {
                let evId = evInfo.find(info => info.evId === data.resume_evId);
                if (evId) {
                    data["resume_evId"] = evId.licensePlate;
                }
                else {
                    let evLicensePlate = await getEVInfo(data.resume_evId);
                    if (evLicensePlate === undefined) {
                        data["resume_evId"] = "";
                    }
                    else {
                        evInfo.push({ "evId": data.evId, "licensePlate": evLicensePlate });
                        data["resume_evId"] = evLicensePlate;
                    }
                }
            }
            else {
                data["resume_evId"] = "Anónimo";
            }

            //Check resume_evOwner name
            if (data.resume_evOwner !== '-1' && data.resume_evOwner !== "") {
                let evOwner = userInfo.find(info => info.userId === data.resume_evOwner);
                if (evOwner) {
                    data["resume_evOwner"] = evOwner.name;
                }
                else {
                    let evOwnerName = await getUserInfo(data.resume_evOwner);
                    if (evOwnerName === undefined) {
                        data["resume_evOwner"] = "";
                    }
                    else {
                        userInfo.push({ "userId": data.user, "name": evOwnerName });
                        data["resume_evOwner"] = evOwnerName;
                    }
                }
            }
            else {
                data["resume_evOwner"] = "Anónimo";
            }

        }

        resolve(dataset);

    });

}

function retrieveInformationEVIO(dataset) {
    var context = "FUNCTION retrieveInformation";
    return new Promise(async (resolve, reject) => {
        try {
            let userInfoArray = [];
            let evInfo = [];
            let userBillingInfoArray = [];

            console.log(dataset.length)

            for (let index = 0; index < dataset.length; index++) {
                let data = dataset[index];

                //Check user name
                let userBillingInfo = userBillingInfoArray.find(info => info.userId === data.userId);
                let userNIF = ""

                if (userBillingInfo) {
                    userNIF = userBillingInfo.nif;
                }
                else {
                    userBillingInfo = await getBillingUserInfoEVIO(data.userId);
                    if (userBillingInfo === null || userBillingInfo === undefined) {
                        userNIF = "";
                    }
                    else {
                        userBillingInfoArray.push({ "userId": data.userId, "nif": userBillingInfo.nif });
                        userNIF = userBillingInfo.nif !== undefined && userBillingInfo.nif !== null ? userBillingInfo.nif : "";
                    }
                }

                let userName = ""

                let userNameInfo = userInfoArray.find(info => info.userId === data.userId);
                if (userNameInfo) {
                    userName = userNameInfo.name;
                }
                else {
                    let userInfo = await getUserInfoEVIO(data.userId);
                    if (userInfo === null || userInfo === undefined) {
                        userName = "";
                    }
                    else {
                        userInfoArray.push({ "userId": data.userId, "name": userInfo.name });
                        userName = userInfo.name !== undefined && userInfo.name !== null ? userInfo.name : "Anónimo";
                    }
                }

                let chargerOwner = ""
                let chargerOwnerEmail = ""
                let chargerOwnerEVIOTariff = ""

                //Check charger owner name
                let chargerOwnerInfo = userInfoArray.find(info => info.userId === data.chargerOwner);
                if (chargerOwnerInfo) {
                    chargerOwner = chargerOwnerInfo.name;
                }
                else {
                    let userInfo = await getUserInfoEVIO(data.chargerOwner);
                    if (userInfo === null || userInfo === undefined) {
                        chargerOwner = "";
                    }
                    else {
                        userInfoArray.push({ "userId": data.userId, "name": userInfo.name });
                        chargerOwner = userInfo.name;
                        let userInfoPro = await getUserInfoProEVIO(data.userId);
                        chargerOwnerEmail = userInfoPro[0].email;

                        let host = process.env.HostCharger + process.env.PathGetEvioComission
                        let params = { userId: data.chargerOwner }

                        let tariffsEvio = await axiosS.axiosGet(host, params);

                        if (tariffsEvio.length > 0) {
                            chargerOwnerEVIOTariff = tariffsEvio[0]
                            console.log("chargerOwnerEVIOTariff")
                            console.log(chargerOwnerEVIOTariff)
                        }
                    }
                }

                let userWillPayBillingInfo = userBillingInfoArray.find(info => info.userId === data.userId);
                let userWillPayNIFVariable = ""

                if (userWillPayBillingInfo) {
                    userWillPayNIFVariable = userWillPayBillingInfo.nif;
                }
                else {
                    userWillPayBillingInfo = await getBillingUserInfoEVIO(data.userIdToBilling);
                    if (userWillPayBillingInfo === null || userWillPayBillingInfo === undefined) {
                        userWillPayNIFVariable = "";
                    }
                    else {
                        userBillingInfoArray.push({ "userId": data.userId, "nif": userWillPayBillingInfo.nif });
                        userWillPayNIFVariable = userWillPayBillingInfo.nif !== undefined && userWillPayBillingInfo.nif !== null ? userWillPayBillingInfo.nif : "";
                    }
                }

                // //Check userWillPay name
                let userWillPayNameVariable = ""

                let userWillPay = userInfoArray.find(info => info.userId === data.userIdToBilling);
                if (userWillPay) {
                    userWillPayNameVariable = userWillPay.name;
                }
                else {
                    if (data.userIdToBilling !== undefined && data.userIdToBilling !== null) {
                        let userWillPayName = await getUserInfoEVIO(data.userIdToBilling);
                        if (userWillPayName === undefined || userWillPayName === null) {
                            userWillPayNameVariable = "";
                        }
                        else {
                            userInfoArray.push({ "userId": data.userIdToBilling, "name": userWillPayName.name });
                            userWillPayNameVariable = userWillPayName.name;
                        }
                    }
                }


                let licensePlate = "Anónimo"
                //Check EV licensePlate
                if (data.evId !== '-1') {
                    let evId = evInfo.find(info => info.evId === data.evId);
                    if (evId) {
                        licensePlate = evId.licensePlate;
                    }
                    else {
                        let evLicensePlate = await getEVInfo(data.evId);
                        if (evLicensePlate === undefined) {
                            licensePlate = "";
                        }
                        else {
                            evInfo.push({ "evId": data.evId, "licensePlate": evLicensePlate });
                            licensePlate = evLicensePlate;
                        }
                    }
                }

                let use_energy = 0;
                let use_time = 0;

                let chargingUOM = ""
                let chargingValue = 0
                let parkingDuringChargingUOM = ""
                let parkingDuringChargingValue = 0
                let parkingUOM = ""
                let parkingValue = 0

                if (data.tariffId != '-1') {
                    if (data.tariff.tariffType === process.env.TariffByPower) {
                        evioEnergyCost = data?.tariff?.tariff?.chargingAmount?.value ?? 0;
                        use_energy = data.costDetails.costDuringCharge;
                    } else {
                        evioTimeCost = data?.tariff?.tariff?.chargingAmount?.value ?? 0;
                        use_time = data.costDetails.costDuringCharge;
                    }

                    chargingUOM = data?.tariff?.tariff?.chargingAmount?.uom ?? ""
                    chargingValue = data?.tariff?.tariff?.chargingAmount?.value ?? 0
                    parkingDuringChargingUOM = data?.tariff?.tariff?.parkingDuringChargingAmount?.uom ?? ''
                    parkingDuringChargingValue = data?.tariff?.tariff?.parkingDuringChargingAmount?.value ?? 0
                    parkingUOM = data?.tariff?.tariff?.parkingAmount?.uom ?? ''
                    parkingValue = data?.tariff?.tariff?.parkingAmount?.value ?? 0
                }
                let documentNumber = ""
                if (data.invoiceId && data.invoiceId !== "MANUAL") {
                    let query = {
                        _id: data.invoiceId,
                    }
                    let invoiceDocument = await Invoice.findOne(query)
                    if (invoiceDocument)
                        documentNumber = invoiceDocument.documentNumber
                }
                dataset[index] = {
                    "startDate": data.startDate,
                    "stopDate": data.stopDate,
                    "hwId": data.hwId,
                    "total_energy": data.costDetails.totalPower / 1000,
                    "total_time": data.costDetails.totalTime / 60,
                    "flat_cost": data.costDetails.activationFee,
                    "chargingValue": chargingValue,
                    "chargingUOM": chargingUOM,
                    "parkingDuringChargingValue": parkingDuringChargingValue,
                    "parkingDuringChargingUOM": parkingDuringChargingUOM,
                    "parkingValue": parkingValue,
                    "parkingUOM": parkingUOM,
                    "cost_during_charge_energy": use_energy,
                    "cost_during_charge_time": use_time,
                    "parking_during_charging": data.costDetails.parkingDuringCharging,
                    "parking_after_charging": data.costDetails.parkingAmount,
                    "total_excl_vat": data.totalPrice.excl_vat,
                    "vat": data.fees.IVA * 100,
                    "total_incl_vat": data.totalPrice.incl_vat,
                    "userIdWillPayName": userWillPayNameVariable,
                    "userWillPayNIF": userWillPayNIFVariable,
                    "userName": userName,
                    "licensePlate": licensePlate,
                    "charger_owner": chargerOwner,
                    "charger_owner_id": data.chargerOwner,
                    "userId": data.userId,
                    "evId": data.evId,
                    "paymentMethod": data.paymentMethod,
                    "userIdWillPay": data.userIdToBilling,
                    "sessionId": data.sessionId,
                    "invoiceId": data.invoiceId,
                    "documentNumber": documentNumber,
                    "invoiceStatus": data.invoiceStatus,
                    "paymentStatus": data.paymentStatus,
                    "clientName": data.clientName,
                    "userNIF": userNIF,
                    "chargerOwnerEmail": chargerOwnerEmail,
                    "chargerOwnerEVIOTariff": chargerOwnerEVIOTariff,
                    "tariffType": data.tariff.tariffType
                    // "charging_time" : data.costDetails.timeCharged/60,
                    // "city" : data.address ? data.address.city : "Unknown",
                }
            }

            resolve(dataset);
        } catch (error) {
            console.log(error)
            resolve([])
        }

    });

}
function getUserInfo(user) {
    var context = "FUNCTION getUserInfo";
    return new Promise((resolve, reject) => {

        try {
            //console.log("user", user);
            if (user === "" || user.toUpperCase() === "UNKNOWN") {
                resolve("Anónimo");
            } else {
                let params = {
                    _id: user
                }

                axios.get(userInfoById, { params: params })
                    .then((result) => {
                        resolve(result.data.name);
                    })
                    .catch((error) => {
                        console.error(`[${context}][.then][find] Error`, error);
                        resolve(undefined);
                    });
            };
        } catch (error) {
            console.error(`[${context}] Error`, error);
            resolve(undefined);
        }
    });
}

function getUserInfoProEVIO(userId) {
    var context = "FUNCTION getUserInfoProEVIO";
    return new Promise((resolve, reject) => {

        try {
            let params = {
                _id: userId
            }

            let host = process.env.IdentityHost + process.env.PathListUsers;

            axios.get(host, { params: params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][.then][find] Error`, error);
                    resolve(undefined);
                });

        } catch (error) {
            console.error(`[${context}] Error`, error);
            resolve(undefined);
        }
    });
}

function getUserInfoEVIO(user) {
    var context = "FUNCTION getUserInfo";
    return new Promise((resolve, reject) => {

        try {
            // console.log("user", user);
            if (user === "" || user.toUpperCase() === "UNKNOWN") {
                resolve(null);
            } else {
                let params = {
                    _id: user
                }

                axios.get(userInfoById, { params: params })
                    .then((result) => {
                        resolve(result.data);
                    })
                    .catch((error) => {
                        console.error(`[${context}][.then][find] Error`, error);
                        resolve(undefined);
                    });
            };
        } catch (error) {
            console.error(`[${context}] Error`, error);
            resolve(undefined);
        }
    });
}

function getBillingUserInfoEVIO(user) {
    var context = "FUNCTION getUserInfo";
    return new Promise((resolve, reject) => {

        try {
            // console.log("user", user);
            if (user === "" || user.toUpperCase() === "UNKNOWN") {
                resolve(null);
            } else {
                let params = {
                    userId: user
                }

                let host = process.env.IdentityHost + process.env.PathGetBillingProfile

                axios.get(host, { params: params })
                    .then((result) => {
                        resolve(result.data);
                    })
                    .catch((error) => {
                        console.error(`[${context}][.then][find] Error`, error);
                        resolve(undefined);
                    });
            };
        } catch (error) {
            console.error(`[${context}] Error`, error);
            resolve(undefined);
        }
    });
}

function getEVInfo(ev) {
    var context = "FUNCTION getEVInfo";
    return new Promise((resolve, reject) => {
        try {
            let params = {
                _id: ev
            }

            axios.get(evInfoById, { params: params })
                .then((result) => {
                    resolve(result.data.licensePlate);
                })
                .catch((error) => {
                    console.error(`[${context}][.then][find] Error`, error);
                    resolve(undefined);
                });
        } catch (error) {
            console.error(`[${context}] Error`, error);
            resolve(undefined);
        }
    });
}

module.exports = router;
