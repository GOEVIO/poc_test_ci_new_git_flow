require("dotenv-safe").load();
const Utils = require('../../../utils')
const CDR = require('../../../models/cdrs')
const USER = require('../../../models/user')
var Platforms = require('../../../models/platforms');
const Sentry = require('@sentry/node');
const axios = require('axios');
const moment = require("moment");
const nodemailerS = require("../../../services/nodemailerService");
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
const Excel = require('exceljs');
const axiosS = require('../../../services/axios');
const fs = require('fs')
const xml2js = require('xml2js');
const timeZoneMoment = require('moment-timezone');
const parseLink = require('parse-link-header');
let Client = require("ssh2-sftp-client");
let sftp = new Client();
const addressS = require('../../../services/address')


module.exports = {
    get: (req, res) => getCemeReports(req, res),
    fromOcpi: (req, res) => forceJobProcess(req, res),
    sendEmail: (req, res) => sendEmailCemeReports(req, res),
    cemeReportJobStart: (req, res) => cemeReportsStartJob(req, res),
    cemeReportJobStop: (req, res) => cemeReportsStopJob(req, res),
    cemeReportJobStatus: (req, res) => cemeReportsStatusJob(req, res),
    getChargersReport: (req, res) => getChargersReport(req, res),
    chargersReportJobStart: (req, res) => chargersReportStartJob(req, res),
    chargersReportJobStop: (req, res) => ChargersReportStopJob(req, res),
    chargersReportJobStatus: (req, res) => ChargersReportStatusJob(req, res),
    sftpCdrsForceJobDay: (req, res) => sftpCdrsForceJobDay(req, res),
    sftpCdrsForceJobMonth: (req, res) => sftpCdrsForceJobMonth(req, res),
    sftpCdrsForceJobYear: (req, res) => sftpCdrsForceJobYear(req, res),
    updatePlatform: (req, res) => updatePlatform(req, res),
};

cron.schedule('30 23 7 * *', async () => {
    console.log("Running monthly routine to fetch sftp CPO cdrs from previous month")
    let date = new Date()
    date.setDate(0)
    //TODO Add function to fetch month n-2
    let query = {
        $and: [
            { platformCode: process.env.MobiePlatformCode },
        ]
    }
    getOperatorsSftpCdrs(date.toISOString(), process.env.monthDateFormat, query)
});

cron.schedule('0 4 * * *', async () => {
    console.log("Running monthly routine to fetch sftp CPO cdrs of current month")
    let date = moment.utc().format()
    //TODO Add function to fetch month n-2
    let query = {
        $and: [
            { platformCode: process.env.MobiePlatformCode },
        ]
    }
    getOperatorsSftpCdrs(date, process.env.monthDateFormat, query)
});


let cemeReportTask;
initJobCemeReportTask("0 9 8 * *").then(() => {

    console.log("CEME Report Document Job Started")

    cemeReportTask.start();
});

function cemeReportsStartJob(req, res) {
    var context = "Function cemeReportsStartJob";
    var timer = "0 9 8 * *";

    if (req.body.timer)
        timer = req.body.timer;

    try {

        initJobCemeReportTask(timer).then(() => {

            console.log("CEME Report Document Job Started")

            cemeReportTask.start();
            return res.status(200).send('CEME Report Document Job Started');
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function cemeReportsStopJob(req, res) {
    var context = "Function cemeReportsStopJob";

    try {
        cemeReportTask.stop();
        console.log("CEME Report Document Job Stopped")
        return res.status(200).send('CEME Report Document Job Stopped');
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function cemeReportsStatusJob(req, res) {
    var context = "Function cemeReportsStatusJob";

    try {
        var status = "Stopped";
        if (cemeReportTask != undefined) {
            status = cemeReportTask.status;
        }

        return res.status(200).send({ "CEME Report Document Job Status": status });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function initJobCemeReportTask(timer) {
    const context = "Function initCemeReportTaskJob";
    return new Promise((resolve, reject) => {

        cemeReportTask = cron.schedule(timer, () => {

            console.log('CEME Report Document ' + new Date().toISOString());

            let req = []
            req.body = {
                "month": moment().subtract(1, 'month').month() + 1,
                "year": moment().subtract(1, 'month').year()
            }

            console.log(req.body)

            cemeReports(req)
        }, {
            scheduled: false
        });

        resolve();

    });

};


async function cemeReports(req) {

    if (!req.body.month) {
        console.log("Month is neeed")
        return;
    }
    if (!req.body.year) {
        console.log("Year is neeed")
        return;
    }

    let debug = false;
    if (req.body.debug) {
        debug = req.body.debug;
    }

    let year = req.body.year
    let month = req.body.month

    if (month.length == 1) {
        month = "0" + month
    }

    //GET INFO
    let regex = "(" + year + "-" + month + "-)";
    let partyId = 'EVI'
    let query = {
        'end_date_time': { $regex: regex },
        'party_id': partyId
    };

    let foundCdrs = await CDR.find(query)

    let ceme = [];
    let totalNumberOfSessions = []
    let totalEnergy = []
    let totalTime = []
    let totalCost = []

    for (let i = 0; i != foundCdrs.length; i++) {
        if (foundCdrs[i].mobie_cdr_extension) {
            if (foundCdrs[i].mobie_cdr_extension.usage) {
                if (foundCdrs[i].mobie_cdr_extension.usage.idServiceProvider) {
                    if (!ceme.includes(foundCdrs[i].mobie_cdr_extension.usage.idServiceProvider)) {
                        ceme.push(foundCdrs[i].mobie_cdr_extension.usage.idServiceProvider)
                        totalNumberOfSessions.push(0)
                        totalEnergy.push(0)
                        totalTime.push(0)
                        totalCost.push(0)
                    }

                    let k = ceme.indexOf(foundCdrs[i].mobie_cdr_extension.usage.idServiceProvider)

                    totalNumberOfSessions[k] += 1
                    totalEnergy[k] += foundCdrs[i].total_energy
                    totalTime[k] += foundCdrs[i].total_time
                    totalCost[k] += foundCdrs[i].total_cost.excl_vat

                }
            }
        }
    }

    let data = []

    for (let i = 0; i != ceme.length; i++) {
        data.push({
            "ceme": ceme[i],
            "nCdrs": totalNumberOfSessions[i],
            "energy": totalEnergy[i],
            "time": totalTime[i],
            "cost": totalCost[i]
        })
    }

    console.log(data)

    //PUT INFO IN  EXCEL

    let workbook = new Excel.Workbook();

    let sheet = workbook.addWorksheet('Valores a cobrar aos CEME');

    parseExcel(data, sheet);

    let monthString = parseMonth(month);

    let buffer = await workbook.xlsx.writeBuffer();

    //SEND INFO
    let fileName = "EVIO - Valores a cobrar aos CEME - " + monthString + '.xlsx';

    let subject = " EVIO - Valores a cobrar aos CEME - " + monthString;

    let textEmail = "Bom dia,\n\nEm anexo o ficheiro dos valores a cobrar aos CEME do mês " + monthString + "\n\nMelhores cumprimentos,\n\nEVIO - Electrical Mobility";

    if (process.env.NODE_ENV === 'production') {
        if (debug)
            nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], subject, textEmail, []);
        else
            nodemailerS.sendEmailFromSupport(process.env.EMAIL_EVIOFINANCE, [buffer], [fileName], subject, textEmail, [process.env.EMAIL_TEST]);
    }
    else if (process.env.NODE_ENV === 'pre-production') {
        subject = "[PRE] " + subject;
        nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], subject, textEmail, []);
    }
    else {
        subject = "[LOCAL] " + subject;
        nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], subject, textEmail, []);
    }

}

async function sendEmailCemeReports(req, res) {
    let context = "Function sendEmailCemeReports";
    try {
        await cemeReports(req);
        return res.status(200).send()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function parseExcel(cdrsTotalInfo, sheet) {

    sheet.columns = [
        {
            header: "CEME", key: "CEME", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Numero de sessões", key: "Numero de sessões", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Energia total (kWh)", key: "Energia total (kWh)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Tempo total (min)", key: "Tempo total (min)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Custo total (€)", key: "Custo total (€)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        }
    ];

    for (let i = 0; i != 5; i++) {
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

    for (let i = 0; i != cdrsTotalInfo.length; i++) {
        sheet.addRow([
            //ceme
            cdrsTotalInfo[i].ceme,
            //n.º sessões realizadas pelos utilizadores do CEME
            cdrsTotalInfo[i].nCdrs,
            //total minutos de carregamento realizadas pelos utilizadores do CEME
            cdrsTotalInfo[i].energy,
            //total de kWh consumidos pelos utilizadores do CEME
            cdrsTotalInfo[i].time,
            //total euros consumidos pelos utilizadores do CEME
            cdrsTotalInfo[i].cost
        ]);
    }
}

function parseMonth(monthNumber) {
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
        case "1":
            return "Janeiro";
        case "2":
            return "Fevereiro";
        case "3":
            return "Março";
        case "4":
            return "Abril";
        case "5":
            return "Maio";
        case "6":
            return "Junho";
        case "7":
            return "Julho";
        case "8":
            return "Agosto";
        case "9":
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

async function getCemeReports(req, res) {
    let context = "Function getCemeReports";
    try {
        if (validateFields(req.query, req.headers['isadmin'])) return res.status(400).send(validateFields(req.query, req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        let foundUser = await Utils.findUserById(cpoUserId)
        let fileList = false;
        if (req.query.fileList) {
            fileList = req.query.fileList;
        }
        let date = ""
        if (fileList) {
            if (!req.query.date) {
                console.log("Date is needed")
                return res.status(400).send({ auth: false, code: '', message: 'Date is needed' })
            }
            else {
                date = req.query.date
            }
        }

        if (foundUser) {
            //FIXME This find on cpoDetails should be using certified and handshake... We were told to put this in production and this was the only way to show data to the client
            let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === req.query.network /*&& details.certified && details.handshake */))

            if (foundUserDetail) {
                let party_id = foundUserDetail.party_id ? foundUserDetail.party_id.toUpperCase() : ""
                let country_code = foundUserDetail.country_code ? foundUserDetail.country_code.toUpperCase() : ""
                if (fileList) {

                    let startDate = moment(date, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
                    let endDate = moment(date, ["YYYY-M-DD", "YYYY-MM-DD"]).add(1, 'month').startOf('month').format("YYYY-MM-DD");

                    let query = {
                        'party_id': party_id,
                        'country_code': country_code,
                        'source': req.query.network,
                        'end_date_time': { $gte: startDate, $lt: endDate }
                    }

                    let foundCdrs = await CDR.find(query)
                    console.log(foundCdrs)

                    let chargerID = [];

                    for (let i = 0; i != foundCdrs.length; i++) {
                        if (foundCdrs[i].mobie_cdr_extension)
                            if (foundCdrs[i].mobie_cdr_extension.usage)
                                if (foundCdrs[i].mobie_cdr_extension.usage.idChargingStation)
                                    chargerID.push(foundCdrs[i].mobie_cdr_extension.usage.idChargingStation)
                    }


                    //query dos sessions

                    let params = {
                        "networks.id": chargerID
                    }

                    let host = process.env.HostChargers + process.env.PathGetChargersAll;
                    let chargers = []
                    try {
                        chargers = await axiosS.axiosGet(host, params)
                        console.log(chargers)
                    }
                    catch (error) {
                        chargers = []
                    }

                    let finalList = []

                    let sessionUsageId = []

                    for (let i = foundCdrs.length - 1; i != -1; i--) {


                        if (!sessionUsageId.includes(foundCdrs[i].mobie_cdr_extension.usage.idUsage)) {
                            sessionUsageId.push(foundCdrs[i].mobie_cdr_extension.usage.idUsage)

                            let startTime = "";
                            let stopTime = "";
                            let foundHwid = "";
                            let totalDuration = 0;
                            let totalEnergy = 0;
                            let feeActivationOCP = 0;
                            let feeTimeOCP = 0;
                            let feeEnergyOCP = 0;
                            let feeTotalOCP = 0;
                            let tokenId = "";

                            if (foundCdrs[i].mobie_cdr_extension)
                                if (foundCdrs[i].mobie_cdr_extension.usage)
                                    if (foundCdrs[i].mobie_cdr_extension.usage.idServiceProvider == fileList) {

                                        for (let j = 0; j != chargers.length; j++) {
                                            for (let k = 0; k != chargers[j].networks.length; k++) {
                                                if (chargers[j].networks[k].id == foundCdrs[i].mobie_cdr_extension.usage.idChargingStation) {
                                                    if (chargers[j].hwId)
                                                        foundHwid = chargers[j].hwId;
                                                }
                                            }
                                        }



                                        if (foundCdrs[i].start_date_time)
                                            startTime = foundCdrs[i].start_date_time

                                        if (foundCdrs[i].end_date_time)
                                            stopTime = foundCdrs[i].end_date_time

                                        if (foundCdrs[i].mobie_cdr_extension.usage) {
                                            if (foundCdrs[i].mobie_cdr_extension.usage.totalDuration) {
                                                totalDuration = foundCdrs[i].mobie_cdr_extension.usage.totalDuration
                                                totalEnergy = foundCdrs[i].mobie_cdr_extension.usage.energia_total_transacao
                                            }

                                            if (foundCdrs[i].mobie_cdr_extension.subUsages) {
                                                for (let j = 0; j != foundCdrs[i].mobie_cdr_extension.subUsages.length; j++) {
                                                    if (foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc_ativacao)
                                                        feeActivationOCP = feeActivationOCP + foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc_ativacao



                                                    if (foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc_tempo)
                                                        feeTimeOCP = feeTimeOCP + foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc_tempo

                                                    if (foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc_energia)
                                                        feeEnergyOCP = feeEnergyOCP + foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc_energia

                                                    if (foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc)
                                                        feeTotalOCP = feeTotalOCP + foundCdrs[i].mobie_cdr_extension.subUsages[j].preco_opc

                                                }
                                            }

                                        }

                                        if (foundCdrs[i].cdr_token)
                                            if (foundCdrs[i].cdr_token.uid)
                                                tokenId = foundCdrs[i].cdr_token.uid


                                        let element = {
                                            "start_date": startTime,
                                            "end_date": stopTime,
                                            "post_id": foundHwid,
                                            "total_load_time_min": Number((totalDuration).toFixed(2)),
                                            "total_energy_consumed_kwh": Number((totalEnergy).toFixed(2)),
                                            "total_activation_fee": Number((feeActivationOCP).toFixed(2)),
                                            "total_time_fee": Number((feeTimeOCP).toFixed(2)),
                                            "total_energy_fee": Number((feeEnergyOCP).toFixed(2)),
                                            "total_ceme": Number((feeTotalOCP).toFixed(2)),
                                            "token_id": tokenId
                                        }

                                        finalList.push(element)

                                    }
                        }

                    }

                    return res.status(200).send(finalList)

                }
                else {
                    let query = [{
                        "$match": {
                            "$and": [
                                { party_id },
                                { country_code },
                                { source: req.query.network },
                                //TODO Add ownerId query
                                cpoUserId ? { ownerId: cpoUserId } : {},
                            ]
                        }
                    },
                    {
                        "$group": {
                            // "_id": "$mobie_cdr_extension.usage.idServiceProvider",
                            "_id": { month: { $month: { $dateFromString: { dateString: "$end_date_time" } } }, year: { $year: { $dateFromString: { dateString: "$end_date_time" } } } },
                            "total_excl_vat": { $sum: "$total_cost.excl_vat" },
                            "totalEnergy": { $sum: "$total_energy" },
                            "totalTime": { $sum: "$total_time" },
                            "average_excl_vat": { $avg: "$total_cost.excl_vat" },
                            "averageEnergy": { $avg: "$total_energy" },
                            "averageTime": { $avg: "$total_time" },
                            "count": { $sum: 1 },
                            "cdrs": { $push: "$$ROOT" }
                        }
                    },
                    { "$sort": { "_id.year": -1, "_id.month": -1 } },
                    {
                        "$project": {
                            "month": "$_id.month",
                            "year": "$_id.year",
                            "totalCost": { $round: ["$total_excl_vat", 2] },
                            "totalEnergy": "$totalEnergy",
                            "totalTime": "$totalTime",
                            "totalCostActivation": '$count',
                            "totalCostEnergy": '$count',
                            "totalCostTime": '$count',
                            "averageEnergyTime": { $divide: ["$totalEnergy", "$totalTime"] },
                            "averageEnergySession": "$averageEnergy",
                            "averageTime": "$averageTime",
                            "totalSessions": "$count",
                            "evioCharger": '$count',
                            "emsps": "$cdrs",
                            "_id": 0
                        }
                    },
                    ];

                    let foundCdrs = await CDR.aggregate(query)

                    console.log(foundCdrs)

                    //Ciclo dos cdrs
                    for (let i = 0; i != foundCdrs.length; i++) {

                        let evioChargers = []
                        let chargerID = []
                        let sessionUsageId = []

                        let ceme = []
                        let totalCostCEME = []
                        let totalCostActivation = []
                        let totalCostEnergy = []
                        let totalCostTime = []
                        let totalEnegyCEME = []
                        let totalTimeCEME = []
                        let totalEVIOChargerCEME = []
                        let sessionIdCEME = []
                        let chargersEVIOCEME = []


                        foundCdrs[i].totalCost = 0
                        foundCdrs[i].totalEnergy = 0
                        foundCdrs[i].totalTime = 0
                        foundCdrs[i].totalCostActivation = 0
                        foundCdrs[i].totalCostEnergy = 0
                        foundCdrs[i].totalCostTime = 0

                        for (let j = foundCdrs[i].emsps.length - 1; j != -1; j--) {
                            if (foundCdrs[i].emsps[j].mobie_cdr_extension) {
                                if (foundCdrs[i].emsps[j].mobie_cdr_extension.usage) {
                                    if (foundCdrs[i].emsps[j].mobie_cdr_extension.usage.idUsage)
                                        if (!sessionUsageId.includes(foundCdrs[i].emsps[j].mobie_cdr_extension.usage.idUsage)) {
                                            sessionUsageId.push(foundCdrs[i].emsps[j].mobie_cdr_extension.usage.idUsage)

                                            chargerID.push(foundCdrs[i].emsps[j].mobie_cdr_extension.usage.idChargingStation)

                                            let emsp = foundCdrs[i].emsps[j].mobie_cdr_extension.usage.idServiceProvider;

                                            if (!ceme.includes(emsp)) {
                                                ceme.push(emsp)
                                                totalCostCEME.push(0)
                                                totalEnegyCEME.push(0)
                                                totalTimeCEME.push(0)
                                                totalEVIOChargerCEME.push(0)
                                                sessionIdCEME.push([])
                                                chargersEVIOCEME.push([])
                                                totalCostActivation.push(0)
                                                totalCostEnergy.push(0)
                                                totalCostTime.push(0)
                                            }

                                            let index = ceme.indexOf(emsp)

                                            totalCostCEME[index] += foundCdrs[i].emsps[j].total_cost.excl_vat
                                            totalEnegyCEME[index] += foundCdrs[i].emsps[j].total_energy
                                            totalTimeCEME[index] += foundCdrs[i].emsps[j].total_time
                                            if (foundCdrs[i].emsps[j].mobie_cdr_extension.subUsages) {
                                                for (let k = 0; k != foundCdrs[i].emsps[j].mobie_cdr_extension.subUsages.length; k++) {
                                                    totalCostActivation[index] += foundCdrs[i].emsps[j].mobie_cdr_extension.subUsages[k].preco_opc_ativacao
                                                    totalCostEnergy[index] += foundCdrs[i].emsps[j].mobie_cdr_extension.subUsages[k].preco_opc_energia
                                                    totalCostTime[index] += foundCdrs[i].emsps[j].mobie_cdr_extension.subUsages[k].preco_opc_tempo
                                                }
                                            }
                                            sessionIdCEME[index].push(foundCdrs[i].emsps[j].mobie_cdr_extension.usage.idChargingStation)
                                        }
                                }
                            }
                        }

                        //query dos sessions
                        let params = {
                            "networks.id": chargerID
                        }

                        let host = process.env.HostChargers + process.env.PathGetChargersAll;
                        let chargers = []
                        try {
                            chargers = await axiosS.axiosGet(host, params)
                        }
                        catch (error) {
                            chargers = []
                        }

                        //Ver os hwid unics
                        for (let j = 0; j != chargers.length; j++) {
                            if (!evioChargers.includes(chargers[j].hwId)) {
                                evioChargers.push(chargers[j].hwId)
                            }

                            for (let k = 0; k != ceme.length; k++) {
                                for (let t = 0; t != chargers[j].networks.length; t++) {
                                    if (sessionIdCEME[k].includes(chargers[j].networks[t].id)) {
                                        if (!chargersEVIOCEME[k].includes(chargers[j].hwId))
                                            chargersEVIOCEME[k].push(chargers[j].hwId)
                                    }
                                }
                            }
                        }

                        let dataCEME = []

                        for (let j = 0; j != ceme.length; j++) {
                            let sessionsNumber = sessionIdCEME[j].length
                            dataCEME.push({
                                "ceme": ceme[j],
                                "totalCost": Number((totalCostCEME[j]).toFixed(2)),
                                "totalEnegy": Number((totalEnegyCEME[j]).toFixed(2)),
                                "totalTime": Number((totalTimeCEME[j]).toFixed(2)),
                                "totalCostActivation": Number((totalCostActivation[j]).toFixed(2)),
                                "totalCostEnergy": Number((totalCostEnergy[j]).toFixed(2)),
                                "totalCostTime": Number((totalCostTime[j]).toFixed(2)),
                                "averageEnergyTime": Number((totalEnegyCEME[j] / totalTimeCEME[j]).toFixed(2)),
                                "averageEnergySession": Number((totalEnegyCEME[j] / sessionsNumber).toFixed(2)),
                                "averageTime": Number((totalTimeCEME[j] / sessionsNumber).toFixed(2)),
                                "totalSessions": sessionsNumber,
                                "evioCharger": chargersEVIOCEME[j].length
                            })

                            foundCdrs[i].totalCost += totalCostCEME[j]
                            foundCdrs[i].totalEnergy += totalEnegyCEME[j]
                            foundCdrs[i].totalTime += totalTimeCEME[j]
                            foundCdrs[i].totalCostActivation += totalCostActivation[j]
                            foundCdrs[i].totalCostEnergy += totalCostEnergy[j]
                            foundCdrs[i].totalCostTime += totalCostTime[j]
                        }

                        //contar esse
                        foundCdrs[i].totalCost = Number(foundCdrs[i].totalCost.toFixed(2))
                        foundCdrs[i].totalEnergy = Number(foundCdrs[i].totalEnergy.toFixed(2))
                        foundCdrs[i].totalTime = Number(foundCdrs[i].totalTime.toFixed(2))
                        foundCdrs[i].totalCostActivation = Number(foundCdrs[i].totalCostActivation.toFixed(2))
                        foundCdrs[i].totalCostEnergy = Number(foundCdrs[i].totalCostEnergy.toFixed(2))
                        foundCdrs[i].totalCostTime = Number(foundCdrs[i].totalCostTime.toFixed(2))

                        foundCdrs[i].averageEnergyTime = Number((foundCdrs[i].totalEnergy / foundCdrs[i].totalTime).toFixed(2))
                        foundCdrs[i].averageEnergySession = Number((foundCdrs[i].totalEnergy / sessionUsageId.length).toFixed(2))
                        foundCdrs[i].averageTime = Number((foundCdrs[i].totalTime / sessionUsageId.length).toFixed(2))
                        foundCdrs[i].totalSessions = sessionUsageId.length
                        foundCdrs[i].evioCharger = evioChargers.length
                        foundCdrs[i].emsps = dataCEME
                    }


                    return res.status(200).send(foundCdrs)
                }
            } else {
                return res.status(200).send([])
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}


async function forceJobProcess(req, res) {
    let context = "Function forceJobProcess";
    try {
        if (validateFieldsJobProcess(req.body, req.headers['isadmin'])) return res.status(400).send(validateFieldsJobProcess(req.body, req.headers['isadmin']))
        let cpoUserId = req.headers['isadmin'] ? req.body.ownerId : req.headers['userid']
        let foundUser = await Utils.findUserById(cpoUserId)
        let network = req.body.network
        let date_from = req.body.date_from !== undefined && req.body.date_from !== null ? req.body.date_from : ""
        let date_to = req.body.date_to !== undefined && req.body.date_to !== null ? req.body.date_to : ""
        if (foundUser) {
            let foundUserDetail = foundUser.cpoDetails.find(details => (details.network === network && details.certified && details.handshake))
            if (foundUserDetail) {
                getCdrs(foundUserDetail, network, date_from, date_to, res)
            } else {
                return res.status(400).send({ auth: false, code: '', message: 'User not certified' })
            }
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'User does not exist' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function validateFields(data, isAdmin) {
    const context = "Function validateFields"
    try {
        let validFields = [
            "ownerId",
            "network",
            "fileList",
            "date"
        ]
        if (!data) {
            return { auth: false, code: 'server_data_required', message: 'data data is required' }
        } else if (!data.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (isAdmin && !data.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(data).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message }
    }
};

function validateFieldsJobProcess(data, isAdmin) {
    const context = "Function validateFieldsJobProcess"
    try {
        let validFields = [
            "ownerId",
            "network",
            "date_from",
            "date_to",
        ]
        if (!data) {
            return { auth: false, code: 'server_data_required', message: 'data data is required' }
        } else if (!data.network) {
            return { auth: false, code: 'server_network_required', message: 'network is required' }
        } else if (isAdmin && !data.ownerId) {
            return { auth: false, code: 'server_ownerId_required', message: 'ownerId is required' }
        } else {
            let notAllowedKey = Object.keys(data).find(key => !validFields.includes(key))
            if (notAllowedKey) {
                return { auth: false, code: `server_${notAllowedKey}_invalid`, message: `${notAllowedKey} can't be sent` }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: '', message: error.message }
    }
};


async function getCdrs(foundUserDetail, network, date_from, date_to, res) {
    const context = "Function getCdrs"
    try {
        let cpo = foundUserDetail.party_id.toUpperCase()
        let platform = await Utils.findOnePlatform({ cpo, platformCode: network })
        let platformDetails = platform.platformDetails.find(details => details.version === platform.cpoActiveCredentialsToken[0].version)
        let cdrsEndpoint = Utils.getPlatformSenderEndpoint(network, platformDetails, process.env.moduleCdrs, process.env.roleSender)
        let token = platform.platformActiveCredentialsToken[0].token
        let result = await callServiceCdrs(cdrsEndpoint, token, date_from, date_to, platform)
        if (result.error) {
            return res.status(400).send({ code: 'cdrs_update_error', message: "cdrs update error: " + result.message });
        } else {
            return res.status(200).send(result);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error);

    }
}

async function callServiceCdrs(originalEndpoint, token, date_from, date_to, platform) {
    try {
        console.log("Running job to get MobiE Cdrs ");
        console.log("Endpoint", originalEndpoint)
        let originalHost = originalEndpoint
        let offset = 0;
        let totalCount = 10;
        let limit = 200;
        let newHost = "";
        if (date_from != "") {
            newHost = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + limit;
        } else {
            newHost = originalHost + "?offset=" + offset + "&limit=" + limit;
        }

        let cdrsCount = 0;
        let result;
        let newCDRs = 0;

        console.log("host", newHost);
        console.log("offset", offset);
        console.log("totalCount", totalCount);

        while (offset < totalCount) {

            result = await new Promise((resolve, reject) => {
                asyncCall(newHost, offset, totalCount, date_from, date_to, originalHost, token, cdrsCount, newCDRs, platform, resolve);
            });

            offset = result.offset;
            totalCount = result.totalCount;
            cdrsCount = result.cdrsCount;
            newHost = result.host;
            newCDRs = result.newCDRs;
            console.log(JSON.stringify(result));
            //console.log("testes", result);

        }

        return result;
    } catch (error) {

    }
}

async function asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, cdrsCount, newCDRs, platform, resolve) {


    axios.get(host, { headers: { 'Authorization': `Token ${token}` } })
        .then(async (result) => {


            var x_total_count = result.headers["x-total-count"];
            console.log("x_total_count", x_total_count);
            if (x_total_count !== null && x_total_count !== undefined && x_total_count != 0) {
                totalCount = x_total_count;
            } else {
                totalCount = 0
            }
            var x_limit = result.headers["x-limit"]

            if (x_limit === null || x_limit === undefined) {
                x_limit = 0
            }

            const link = result.headers["link"]
            const parsedLink = parseLink(link)

            offset = Number(offset) + Number(x_limit);

            //console.log(result.data.data);
            if (result) {

                if (result.data) {

                    if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {

                        cdrsCount += result.data.data.length;

                        for (let i = 0; i < result.data.data.length; i++) {
                            let cdr = result.data.data[i];

                            if (cdr) {
                                let res = await Utils.processCDR(cdr, platform, false);
                                if (res) {
                                    newCDRs += 1;
                                }
                            }

                        }

                    }
                    Utils.saveLog("GET", {}, result.data, host, token, platform.platformCode, platform.platformName, Utils.getHttpStatus(result), process.env.triggerCPO, process.env.moduleCdrs, platform.cpo)

                } else {
                    Utils.saveLog("GET", {}, {}, host, token, platform.platformCode, platform.platformName, Utils.getHttpStatus(result), process.env.triggerCPO, process.env.moduleCdrs, platform.cpo)
                }
            } else {
                Utils.saveLog("GET", {}, {}, host, token, platform.platformCode, platform.platformName, Utils.getHttpStatus(result), process.env.triggerCPO, process.env.moduleCdrs, platform.cpo)
            }

            if (date_from != "") {
                host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + Number(x_limit);
            } else {
                host = originalHost + "?offset=" + offset + "&limit=" + Number(x_limit);
            }

            console.log("parsedLink" , JSON.stringify(parsedLink))
            if (parsedLink) {
                host = parsedLink?.next?.url
                offset = Number(parsedLink?.next?.offset) || cdrsCount
            }

            resolve({ offset: offset, totalCount: totalCount, cdrsCount: cdrsCount, host: host, newCDRs: newCDRs })

        }).catch((e) => {
            console.log("[Cdrs Process]", e.message);
            let responseData = {}
            if (e.response) {
                if (e.response.data) {
                    responseData = e.response.data
                }
            }
            Utils.saveLog("GET", {}, responseData, host, token, platform.platformCode, platform.platformName, Utils.getHttpStatus(e), process.env.triggerCPO, process.env.moduleCdrs, platform.cpo)
            resolve({ offset: offset, totalCount: -1, cdrsCount: cdrsCount, error: true, message: e.message, newCDRs: newCDRs })
        });
    // });
}

function groupByCeme(groupedCdrs) {
    const context = "Function groupByCeme"
    try {
        return groupedCdrs.map(obj => {
            let emsps = []
            for (let cdr of obj.emsps) {
                const emsp = cdr.mobie_cdr_extension.usage.idServiceProvider
                let foundIndex = emsps.findIndex(emspObj => emspObj.emsp == emsp)
                if (foundIndex > -1) {
                    // emsps[foundIndex].cdrs.push(cdr)
                    emsps[foundIndex].totalCost += cdr.total_cost.excl_vat
                } else {
                    emsps.push(
                        {
                            cdrs: [],
                            totalCost: cdr.total_cost.excl_vat,
                            emsp,
                        }
                    );
                }
            }
            // obj.emsps = obj.emsps.reduce((group, cdr) => {
            //     const ceme = cdr.mobie_cdr_extension.usage.idServiceProvider;
            //     group[ceme] = group[ceme] ?? {};
            //     group[ceme].cdrs = group[ceme].cdrs ?? []
            //     group[ceme].totalCost = group[ceme].totalCost ?? 0
            //     // group[ceme].cdrs.push(cdr)
            //     group[ceme].totalCost += cdr.total_cost.excl_vat
            //     return group;
            // }, {});
            obj.emsps = emsps
            return obj
        })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return groupedCdrs
    }
}

async function getChargersReport(req, res) {
    const context = "Function getChargersReport"
    try {

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        if (!req.query.network) {
            return res.status(400).send("Network is needed");
        }

        let detail = false

        if (req.query.detail === 'true') {
            detail = true
        }

        let ocpEVIO = false

        if (req.query.ocpEVIO === 'true') {
            ocpEVIO = true
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");
        let network = req.query.network

        console.log("startDate: " + startDate)
        console.log("endDate: " + endDate)

        let userID = req.headers['userid'];

        if (req.headers['isadmin']) {
            if (!req.query.ownerId) {
                return res.status(400).send("ownerId is needed");
            }
            userID = req.query.ownerId
        }

        let foundUser = await Utils.findUserById(userID)

        if (!foundUser) {
            return res.status(401).send("User does not exist");
        }

        let foundUserDetail = false

        for (let i = 0; i != foundUser.cpoDetails.length; i++) {
            if (foundUser.cpoDetails[i].certified && foundUser.cpoDetails[i].handshake &&
                foundUser.cpoDetails[i].network === network &&
                foundUser.cpoDetails[i].party_id === "EVI" && ocpEVIO)
                foundUserDetail = foundUser.cpoDetails[i];
            else if (foundUser.cpoDetails[i].certified && foundUser.cpoDetails[i].handshake &&
                foundUser.cpoDetails[i].network === network &&
                !ocpEVIO && foundUser.cpoDetails[i].party_id !== "EVI")
                foundUserDetail = foundUser.cpoDetails[i];
        }

        console.log(foundUserDetail)

        if (!foundUserDetail) {
            return res.status(200).send([]);
        }

        let finalData = []

        if (!detail && !ocpEVIO) {

            let party_id = foundUserDetail.party_id.toUpperCase()
            let country_code = foundUserDetail.country_code.toUpperCase()

            let query = [{
                "$match": {
                    "$and": [
                        { party_id },
                        { country_code },
                        { source: req.query.network },
                        { ownerId: userID },
                        { end_date_time: { $gte: startDate, $lt: endDate } }
                    ]
                }
            },
            {
                "$group": {
                    "_id": { month: { $month: { $dateFromString: { dateString: "$end_date_time" } } }, year: { $year: { $dateFromString: { dateString: "$end_date_time" } } } },
                    "total_excl_vat": { $sum: "$total_cost.excl_vat" },
                    "totalEnergy": { $sum: "$total_energy" },
                    "totalTime": { $sum: "$total_time" },
                    "average_excl_vat": { $avg: "$total_cost.excl_vat" },
                    "averageTime": { $avg: "$total_time" },
                    "count": { $sum: 1 }
                }
            },
            { "$sort": { "_id.year": -1, "_id.month": -1 } },
            {
                "$project": {
                    "month": "$_id.month",
                    "year": "$_id.year",
                    "totalCost": { $round: ["$total_excl_vat", 2] },
                    "totalEnergy": "$totalEnergy",
                    "totalTime": "$totalTime",
                    "meanTime": "$averageTime",
                    "meanCost": "$average_excl_vat",
                    "totalSessions": "$count",
                    "_id": 0
                }
            },
            ];

            finalData = await CDR.aggregate(query)

            return res.status(200).send(finalData)
        }
        else
            finalData = await chargerdReport(startDate, endDate, foundUserDetail, userID)

        if (detail)
            return res.status(200).send(finalData)

        let totalEVIO = []

        let month = -1;
        let evioIndex = -1;

        for (let i = 0; i != finalData.length; i++) {
            if (month != finalData[i].month) {
                evioIndex++;
                month = finalData[i].month
                totalEVIO.push({
                    "year": finalData[i].year,
                    "month": finalData[i].month,
                    "totalCost": 0,
                    "totalSessions": 0,
                    "totalEnergy": 0,
                    "totalTime": 0,
                    "meanTime": 0,
                    "meanCost": 0,
                    "EVIOComission": 0,
                    "Comission": 0
                })
            }
            totalEVIO[evioIndex].totalSessions += 1;
            totalEVIO[evioIndex].totalCost += finalData[i].totalCost;
            totalEVIO[evioIndex].totalEnergy += finalData[i].totalEnergy;
            totalEVIO[evioIndex].totalTime += finalData[i].totalTime;
            totalEVIO[evioIndex].meanTime += finalData[i].meanTime;
            totalEVIO[evioIndex].meanCost += finalData[i].meanCost;
            totalEVIO[evioIndex].EVIOComission += finalData[i].EVIOComission;
            totalEVIO[evioIndex].Comission += finalData[i].Comission;
        }

        return res.status(200).send(totalEVIO)

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

async function chargerdReport(startDate, endDate, foundUserDetail, userID) {
    let ocp = foundUserDetail.party_id.toUpperCase()
    let countryCode = foundUserDetail.country_code.toUpperCase()



    let finalData = [];
    //Sacar os meses
    let startMonth = moment(startDate).month();
    let startYear = moment(startDate).year();
    let endMonth = moment(endDate).month();
    let endYear = moment(endDate).year();

    let months = (endYear - startYear) * 12 + endMonth - startMonth;

    console.log("startMonth: " + startMonth)
    console.log("startYear: " + startYear)
    console.log("endMonth: " + endMonth)
    console.log("endYear: " + endYear)

    console.log("months: " + months)

    //Repetir para cada mes
    for (let i = months; i != -1; i--) {

        let month = moment(startDate).add(i, 'month').month() + 1;
        let year = moment(startDate).add(i, 'month').year();

        let dateStart = moment(startDate).add(i, 'month').startOf('month').format("YYYY-MM-DD");
        let dateEnd = moment(startDate).add(i, 'month').endOf('month').format("YYYY-MM-DD");

        if (moment(endDate).isBefore(dateEnd))
            dateEnd = endDate;

        //console.log(dateStart)
        //console.log(dateEnd)

        let query = {
            'end_date_time': { $gte: dateStart, $lt: dateEnd },
            'country_code': countryCode,
            'party_id': ocp,
            'ownerId': userID
        }

        let foundCdrs = await CDR.find(query)

        let chargers = []
        let city = []
        let totalCost = []
        let totalSessions = []
        let totalEnergy = []
        let totalTime = []
        let totalClientComission = []
        let evioComission = []

        let evioPercentage = 0.1
        let evioFixed = 0.3
        let evioSpecialUsers = []

        let comissionsClient = []

        if (ocp === "EVIO") {

            let params = {
                'userId': userID
            }

            let hostComissionEVIO = process.env.HostChargers + process.env.PathGetComissionEVIO;

            let comissionEVIO = await axiosS.axiosGet(hostComissionEVIO, params)

            let hostComissionClient = process.env.HostChargers + process.env.PathGetComissionClient;

            comissionsClient = await axiosS.axiosGet(hostComissionClient, params)

            if (comissionEVIO.length > 0) {
                evioFixed = comissionEVIO[0].minAmount
                evioPercentage = comissionEVIO[0].percentage
                evioSpecialUsers = comissionEVIO[0].specialClients
            }

        }

        for (let j = 0; j != foundCdrs.length; j++) {

            let charger = foundCdrs[j].mobie_cdr_extension.usage.idChargingStation;
            if (!chargers.includes(charger)) {
                chargers.push(charger)
                city.push(foundCdrs[j].cdr_location.city);
                totalCost.push(0)
                totalSessions.push(0)
                totalEnergy.push(0)
                totalTime.push(0)
                evioComission.push(0)
                totalClientComission.push(0)
            }

            let index = chargers.indexOf(charger)

            totalCost[index] += foundCdrs[j].total_cost.excl_vat
            totalSessions[index] += 1
            totalEnergy[index] += foundCdrs[j].total_energy
            totalTime[index] += foundCdrs[j].total_time

            if (ocp == "EVI") {


                for (let k = 0; k != evioSpecialUsers.length; k++) {
                    if (evioSpecialUsers[k].userId == userID) {
                        evioFixed = evioSpecialUsers[k].minAmount
                        evioPercentage = evioSpecialUsers[k].percentage
                    }
                }


                let comission = evioFixed;
                if (foundCdrs[j].total_cost.excl_vat * evioPercentage > comission)
                    comission = foundCdrs[j].total_cost.excl_vat * evioPercentage

                evioComission[index] += comission

                let comissionClient = 0

                for (let k = 0; k != comissionsClient.length; k++) {
                    if (comissionsClient[k].charger == charger) {
                        comissionClient = comissionsClient[k].percentage
                    }
                }

                totalClientComission[index] += foundCdrs[j].total_cost.excl_vat * comissionClient;

            }
        }

        for (let j = 0; j != chargers.length; j++) {
            if (ocp === "EVI")
                finalData.push({
                    "charger": chargers[j],
                    "year": year,
                    "month": month,
                    "city": city[j],
                    "totalCost": totalCost[j],
                    "totalSessions": totalSessions[j],
                    "totalEnergy": totalEnergy[j],
                    "totalTime": totalTime[j],
                    "meanTime": totalTime[j] / totalSessions[j],
                    "meanCost": totalCost[j] / totalSessions[j],
                    "EVIOPercentage": evioPercentage,
                    "EVIOFixFee": evioFixed,
                    "EVIOComission": evioComission[j],
                    "Comission": totalClientComission[j]
                })
            else
                finalData.push({
                    "charger": chargers[j],
                    "year": year,
                    "month": month,
                    "city": city[j],
                    "totalCost": totalCost[j],
                    "totalSessions": totalSessions[j],
                    "totalEnergy": totalEnergy[j],
                    "totalTime": totalTime[j],
                    "meanTime": totalTime[j] / totalSessions[j],
                    "meanCost": totalCost[j] / totalSessions[j]
                })

        }

    }

    return finalData;
}

async function sendEamilsChargerReport(date) {
    //recebe data
    let startDate = moment(date).subtract(1, 'month').startOf('month').format("YYYY-MM-DD");
    let endDate = moment(date).subtract(1, 'month').endOf('month').format("YYYY-MM-DD");

    //vai ser os utilizadores que tem evio como ocp
    let validUsers = await USER.find({ cpoDetails: { $elemMatch: { party_id: "EVI", certified: true, handshake: true } } })

    validUsers.forEach(async (user) => {

        let foundUserDetail = user.cpoDetails.find(details => (details.party_id === "EVI" && details.certified && details.handshake));

        let chargerDetails = await chargerdReport(startDate, endDate, foundUserDetail, user._id.toString());

        //PUT INFO IN  EXCEL
        let workbook = new Excel.Workbook();

        let sheet = workbook.addWorksheet('Chargers');

        console.log(chargerDetails)

        parseExcelChargers(chargerDetails, sheet);

        let monthString = parseMonth((moment(startDate).month() + 1).toString());

        let buffer = await workbook.xlsx.writeBuffer();

        //SEND INFO
        let fileName = "Receita de postos na MOBIE detidos por Terceiros - OPC EVIO -" + monthString + '.xlsx';

        let subject = " Receita de postos na MOBIE detidos por Terceiros - OPC EVIO - " + monthString;

        let textEmail = "Bom dia,\n\nEm anexo o ficheiro de " + monthString + " com a receita dos postos Mobie detidos por terceiros em que o OCP é a EVIO.\n\nMelhores cumprimentos,\nEVIO - Electrical Mobility";

        let cc = [];

        if (process.env.NODE_ENV === 'production') {
            cc.push(process.env.EMAIL_EVIOFINANCE)
            //TODO Uncomment after tested in prod env
            //cc.push(user.email)
        }

        nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], subject, textEmail, cc);

    });

}

let chargersReportTask;
initJobChargersReportTask("0 9 8 * *").then(() => {

    console.log("Chargers Report Document Job Started")

    chargersReportTask.start();
});

function chargersReportStartJob(req, res) {
    var context = "Function chargersReportStartJob";
    var timer = "0 9 8 * *";

    if (req.body.timer)
        timer = req.body.timer;

    try {

        initJobChargersReportTask(timer).then(() => {

            console.log("Chargers Report Document Job Started")

            chargersReportTask.start();
            return res.status(200).send('Chargers Report Document Job Started');
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function ChargersReportStopJob(req, res) {
    var context = "Function ChargersReportStopJob";

    try {
        chargersReportTask.stop();
        console.log("Chargers Report Document Job Stopped")
        return res.status(200).send('Chargers Report Document Job Stopped');
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function ChargersReportStatusJob(req, res) {
    var context = "Function ChargersReportStatusJob";

    try {
        var status = "Stopped";
        if (chargersReportTask != undefined) {
            status = chargersReportTask.status;
        }

        return res.status(200).send({ "Chargers Report Document Job Status": status });
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function initJobChargersReportTask(timer) {
    var context = "Function initJobChargersReportTask";
    return new Promise((resolve, reject) => {

        chargersReportTask = cron.schedule(timer, () => {

            console.log('Chargers Report Document ' + new Date().toISOString());

            sendEamilsChargerReport(moment())

        }, {
            scheduled: false
        });

        resolve();

    });

};

function parseExcelChargers(chargersInfo, sheet) {

    sheet.columns = [
        {
            header: "Charger", key: "CEME", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Cidade", key: "Numero de sessões", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Receita total (€)", key: "Energia total (kWh)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Comissão EVIO (%)", key: "Tempo total (min)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Comissão Fixa EVIO (€)", key: "Tempo total (min)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Comissão Devida EVIO (€)", key: "Tempo total (min)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        },
        {
            header: "Receita Devida Posto (€)", key: "Tempo total (min)", width: 30, style: {
                alignment: { vertical: 'middle', horizontal: 'center', wrapText: false }
            }
        }
    ];

    for (let i = 0; i != 7; i++) {
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

    for (let i = 0; i != chargersInfo.length; i++) {
        sheet.addRow([

            chargersInfo[i].charger,

            chargersInfo[i].city,

            chargersInfo[i].totalCost,

            chargersInfo[i].EVIOPercentage,

            chargersInfo[i].EVIOFixFee,

            chargersInfo[i].EVIOComission,

            chargersInfo[i].Comission,
        ]);
    }
}

async function sftpCdrsForceJobYear(req, res) {
    const context = "Function sftpCdrsForceJobYear"
    try {
        let date = req.body.date ? req.body.date : new Date().toISOString()
        let query = {
            $and: [
                { platformCode: process.env.MobiePlatformCode },
                req.body.cpo ? { cpo: req.body.cpo } : {}
            ]
        }
        let result = await getOperatorsSftpCdrs(date, process.env.yearDateFormat, query)

        return res.status(200).send(result);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ cdrsProcessed: 0, newCdrs: 0 });
    }
}

async function sftpCdrsForceJobMonth(req, res) {
    const context = "Function sftpCdrsForceJobMonth"
    try {
        let date = req.body.date ? req.body.date : new Date().toISOString()
        let query = {
            $and: [
                { platformCode: process.env.MobiePlatformCode },
                req.body.cpo ? { cpo: req.body.cpo } : {}
            ]
        }
        let result = await getOperatorsSftpCdrs(date, process.env.monthDateFormat, query)

        return res.status(200).send(result);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ cdrsProcessed: 0, newCdrs: 0 });

    }
}

async function sftpCdrsForceJobDay(req, res) {
    const context = "Function sftpCdrsForceJobDay"
    try {
        let date = req.body.date ? req.body.date : new Date().toISOString()
        let query = {
            $and: [
                { platformCode: process.env.MobiePlatformCode },
                req.body.cpo ? { cpo: req.body.cpo } : {}
            ]
        }
        let result = await getOperatorsSftpCdrs(date, process.env.dayDateFormat, query)

        return res.status(200).send(result);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ cdrsProcessed: 0, newCdrs: 0 });

    }
}

async function getStfpCdrs(fetchDate, dateFormat, platform) {
    const context = "Function getStfpCdrs"
    try {
        console.log("sftpConnectionConfigs", platform.sftpConnectionConfigs)
        // console.log("mobieSftpRemotePath", platform.mobieSftpRemotePath)
        // Create a connection to sftp server with provided connection configs
        await sftp.connect(platform.sftpConnectionConfigs)


        // Get list of all files in the clients remote path
        let allCdrsList = await sftp.list(platform.mobieSftpRemotePath);

        // We can process the cdrs of a specific month or specific day, so we filter all cdrs with those parameters
        let filteredCdrs = allCdrsList.filter((file) => filterDate(file.name, fetchDate, dateFormat));

        // console.log("filteredCdrs" , filteredCdrs)

        let result = await parseAndProcessCdrs(filteredCdrs, platform)

        sftp.end()
        console.log("=== STFP RESULT ===")
        console.log(JSON.stringify(result, null, 2))
        return result

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { cdrsProcessed: 0, newCdrs: 0 }
    }
}

function filterDate(name, filterIsoDate, dateFormat) {
    var fileDate = moment(filterIsoDate).format(dateFormat);
    return (
        name.slice(0, fileDate.length) === fileDate &&
        name.slice(
            Number(process.env.fullDateLength),
            Number(process.env.fullDateLength) + process.env.evioFinalEnum.length
        ) === process.env.evioFinalEnum
    );
}

async function parseAndProcessCdrs(filteredCdrs, platform) {
    const context = "Function parseAndProcessCdrs"
    let res = { cdrsProcessed: 0, newCdrs: 0 }
    try {
        for (let cdrFile of filteredCdrs) {
            let remotePath = platform.mobieSftpRemotePath + cdrFile.name
            let localPath = `./${cdrFile.name}`
            await sftp.fastGet(remotePath, localPath)
            const xmlFileString = fs.readFileSync(localPath);
            let result = await parseXmlString(xmlFileString, platform)
            res.cdrsProcessed += result.cdrsProcessed
            // res.newSessions += result.newSessions
            res.newCdrs += result.newCdrs
            fs.unlinkSync(localPath)
        }
        return res

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { cdrsProcessed: res.cdrsProcessed, newCdrs: res.newCdrs }
    }
}

function parseXmlString(xmlFileString, platform) {
    const context = "Function parseXmlString"
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlFileString, { mergeAttrs: true }, async (err, jsonCdrs) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve({ cdrsProcessed: 0, newCdrs: 0 })
            }
            let result = await processJsonCdrs(jsonCdrs.Usages.Usage, platform)
            resolve(result)
        });
    })
}

async function processJsonCdrs(jsonCdrs, platform) {
    const context = "Function processJsonCdrs"

    let result = { cdrsProcessed: 0, newCdrs: 0 }
    try {

        //TODO: fixCdrArrayKeys necessário analisar
        for (let cdrJson of jsonCdrs) {
            result.cdrsProcessed += 1
            const cdrFormated = fixCdrArrayKeys(cdrJson)
            const cdr = await transformCdrJsonModel(cdrFormated, platform)
            if(!cdr) continue
            let isNewCdr = await Utils.processCDR(cdr, platform, true)
            if (isNewCdr) result.newCdrs += 1
        }
        return result

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { cdrsProcessed: result.cdrsProcessed, newCdrs: result.newCdrs }

    }
}

function fixCdrArrayKeys(cdrJson) {
    const context = "Function fixCdrArrayKeys"
    try {
        let cdr = removeArraysOfKeysFromObj(cdrJson);
        if (cdr?.SubUsage) {
            cdr.SubUsage = removeArraysOfKeysFromObj(cdr.SubUsage);
        }
        return cdr;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return undefined;
    }
}

function removeArraysOfKeysFromObj(cdr) {
    const context = "Function removeArraysOfKeysFromObj"
    try {
        let regExp = /[a-zA-Z]/g;

        // Helper function to determine if a value should be converted to a number
        const convertIfNumeric = (value, key) => {
            if (typeof value === 'string' && !isNaN(value) && !regExp.test(value) && key !== 'idDay' && key !== 'idInternalNumber') {
                return Number(value);
            }
            return value;
        };

        if (!Array.isArray(cdr)) {
            if (Object.prototype.toString.call(cdr) === "[object Object]") {
                Object.keys(cdr).forEach(key => {
                    if (Array.isArray(cdr[key]) && cdr[key].length > 0) {
                        // Process only if first element can be converted to a number
                        cdr[key] = convertIfNumeric(cdr[key][0], key);
                    }
                });
                return cdr;
            } else {
                return undefined;
            }
        } else {
            return cdr.map(subUsageI => {
                Object.keys(subUsageI).forEach(key => {
                    if (Array.isArray(subUsageI[key]) && subUsageI[key].length > 0) {
                        subUsageI[key] = convertIfNumeric(subUsageI[key][0], key);
                    }
                });
                return subUsageI;
            });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return undefined;
    }
}

async function transformCdrJsonModel(cdrJson, platform) {
    const context = "Function transformCdrJsonModel"
    try {
        // let tokenUid = await Utils.getUserId(cdrJson.idInternalNumber)
        // let chargerResult = await Utils.getChargerWithEVSE(cdrJson.idChargingStation, cdrJson.idEVSE)
        const cpoCountryCode = platform.cpoRoles.find(roleObj => roleObj.role === process.env.cpoRole)?.country_code || 'PRT';

        const query = {
            network: platform.platformCode,
            party_id: platform.cpo,
            country_code: cpoCountryCode,
            locationId: cdrJson.idChargingStation,
            date_from: "",
            date_to: "",
        };

        const chargerResult = await Utils.getSpecificCharger(query);
        let cdr_location = { id: cdrJson.idChargingStation, evse_id: cdrJson.idEVSE };

        if(!chargerResult || Object.keys(chargerResult).length === 0){
            console.info(`Info - charger ${cdrJson.idChargingStation} was not found for CPO CDR in chargersDB`);
            console.info(`${context} Info - query: `, query);
            console.info(`${context} Info - cdrJson: `, cdrJson);
        } else {
            const address = addressS.parseAddressStreetToString(chargerResult.address);
            cdr_location = {
                id: chargerResult.hwId,
                address,
                city: chargerResult.address.city,
                country: chargerResult.country || "PRT",
                coordinates: {
                    latitude: chargerResult.geometry.coordinates[1],
                    longitude: chargerResult.geometry.coordinates[0],
                },
                postal_code: chargerResult.address.zipCode,
                evse_id: cdrJson.idEVSE,
            };
        }

        // console.log(JSON.stringify)
        // let splitedId = cdrJson.SubUsage.idSubUsage.split("-")
        // let idSubUsage = splitedId.length > Number(process.env.idSessionElementsLength) ? splitedId.slice(0,splitedId.length - 1).join("-") : cdrJson.SubUsage.idSubUsage

        const totalCostExclVat = Array.isArray(cdrJson.SubUsage) ? cdrJson.SubUsage.reduce((sum, obj) => sum + obj.preco_opc, 0) : cdrJson.SubUsage.preco_opc;
        const totalTimeCostExclVat = Array.isArray(cdrJson.SubUsage) ? cdrJson.SubUsage.reduce((sum, obj) => sum + obj.preco_opc_tempo, 0) : cdrJson.SubUsage.preco_opc_tempo;

        const startDateTime = parseDateMobiE(cdrJson.startTimestamp.toString(), chargerResult);
        const endDateTime = parseDateMobiE(cdrJson.stopTimestamp.toString(), chargerResult);

        return {
            country_code: cpoCountryCode,
            id: `ftp-${Utils.generateToken(8)}-${Utils.generateToken(8)}`,
            // party_id: cdrJson.idNetworkOperator,
            party_id: platform.cpo,
            last_updated: new Date().toISOString(),
            start_date_time: startDateTime,
            end_date_time: endDateTime,
            session_id: cdrJson.idUsage, //Turns out the session id key was cdrJson.idUsage and NOT cdrJson.SubUsage.idSubUsage
            cdr_token: {
                uid: cdrJson.idInternalNumber,
                type: "UNKNOWN",
                contract_id: cdrJson.idExternalNumber
            },
            auth_method: "WHITELIST",
            cdr_location,
            currency: "EUR",
            total_cost: {
                excl_vat: totalCostExclVat,
            },
            total_energy: cdrJson.energia_total_transacao,
            total_time: cdrJson.totalDuration / 60,
            total_time_cost: {
                excl_vat: totalTimeCostExclVat,
            },
            mobie_cdr_extension: {
                usage: {
                    idUsage: cdrJson.idUsage,
                    // idContract: cdrJson.idContract,
                    idServiceProvider: cdrJson.idServiceProvider,
                    idExternalNumber: cdrJson.idExternalNumber,
                    idInternalNumber: cdrJson.idInternalNumber,
                    type: "UNKNOWN",
                    idNetworkOperator: cdrJson.idNetworkOperator,
                    idChargingStation: cdrJson.idChargingStation,
                    idEVSE: cdrJson.idEVSE,
                    startTimestamp: cdrJson.startTimestamp,
                    stopTimestamp: cdrJson.stopTimestamp,
                    totalDuration: cdrJson.totalDuration,
                    energia_total_transacao: cdrJson.energia_total_transacao,
                    // opcao_horaria_ciclo: cdrJson.opcao_horaria_ciclo,
                    // apoio_mobilidade_eletrica_ceme: (cdrJson.apoio_mobilidade_eletrica_ceme !== null && cdrJson.apoio_mobilidade_eletrica_ceme !== undefined) ? cdrJson.apoio_mobilidade_eletrica_ceme : 0,
                    evse_max_power: cdrJson.evse_max_power || 0,
                    renewables_100: cdrJson.renewables_100
                },
                subUsages: Array.isArray(cdrJson.SubUsage) ? cdrJson.SubUsage : [cdrJson.SubUsage],
            }

        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        console.error(`[${context}] Error - cdrJson: `, cdrJson);
        Sentry.captureException(error);
        return null;
    }

}

function parseDateMobiE(dateString, chargerResult) {
    /*
        The date provided in the string is not in UTC as all dates are in cdrs.
        It's actually just a string with appended numbers of date...
        We need to transform it into UTC.
    */

    // Extract date and time components
    const [year, month, day, hour, minute, second] = [
        dateString.slice(0, 4),
        dateString.slice(4, 6),
        dateString.slice(6, 8),
        dateString.slice(8, 10),
        dateString.slice(10, 12),
        dateString.slice(12, 14)
    ];

    // Determine timezone based on chargerResult
    const latitude = chargerResult?.geometry?.coordinates[1] ?? null;
    const longitude = chargerResult?.geometry?.coordinates[0] ?? null;
    const timeZone = (latitude && longitude) ? Utils.getTimezone(latitude, longitude) : "Europe/Lisbon";

    // Calculate the offset from the timezone
    const offset = timeZoneMoment.tz(timeZone).utcOffset();

    // Construct and return the UTC date-time string
    return moment.utc(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).subtract(offset, 'minutes').format();
}

async function getOperatorsSftpCdrs(fetchDate, dateFormat, query) {
    const context = "Function getOperatorsSftpCdrs"
    let allUpdates = []
    try {
        let operatorsPlatforms = await Platforms.find(query).lean()
        for (let platform of operatorsPlatforms) {
            let result = await getStfpCdrs(fetchDate, dateFormat, platform)
            allUpdates.push({ ...result, cpo: platform.cpo, platformCode: platform.platformCode })
        }
        return allUpdates
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return allUpdates
    }
}

async function updatePlatform(req, res) {
    const context = "Function updatePlatform"
    try {
        let updatePlatform = req.body
        let platformId = req.query.platformId
        let udpated = await Platforms.findOneAndUpdate({ _id: platformId }, { $set: updatePlatform }, { new: true }).lean()
        return res.status(200).send(udpated ? "OK" : "KO");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}
