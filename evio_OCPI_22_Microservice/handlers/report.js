require("dotenv-safe").load();
const ErrorHandler = require("../handlers/errorHandler");
var moment = require('moment');
const Sessions = require('../models/sessions');
const Cdrs = require('../models/cdrs')
const axios = require("axios");
const Excel = require('exceljs');
const nodemailer = require("nodemailer");
const utils = require("../utils");
const nodemailerS = require("../services/nodemailerService");
const axiosS = require("../services/axios")
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



let reportTask;
initJobCreateERSEDocument("37 3 2 1,4,7,10 *").then(() => {

    console.log("ERSE Document Job Started")

    reportTask.start();
});

module.exports = {
    getReports: async function (req, res) {
        reports(req, res)
    },
    getResportTotalCdrs: async function (req, res) {

        if (!req.query.startDate) {
            return {};
        }

        if (!req.query.endDate) {
            return {};
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).format("YYYY-MM-DD");

        console.log("startDate: " + startDate)
        console.log("endDate: " + endDate)

        let queryValidSessions = {
            paymentStatus: { "$ne": 'CANCELED' },
            chargerType: '004'
        };

        let sessionsSize = await sessionsFind(queryValidSessions)

        /*
        let queryCDRs = [{
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
        */
        return sessionsSize;
    },
    startJob: function (req, res) {
        var context = "Function startJob";
        var timer = "0 0 2 1,4,7,10 *";

        if (req.body.timer)
            timer = req.body.timer;

        try {

            initJobCreateERSEDocument(timer).then(() => {

                console.log("ERSE Document Job Started")

                reportTask.start();
                return res.status(200).send('ERSE Document Job Started');
            });
        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            return res.status(500).send(error.message);
        };
    },
    stopJob: function (req, res) {
        var context = "Function stopJob";

        try {
            reportTask.stop();
            console.log("ERSE Document Job Stopped")
            return res.status(200).send('CERSE Document Job Stopped');
        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            return res.status(500).send(error.message);
        };
    },
    statusJob: function (req, res) {
        var context = "Function statusJob";

        try {
            var status = "Stopped";
            if (reportTask != undefined) {
                status = reportTask.status;
            }

            return res.status(200).send({ "ERSE Document Job Status": status });
        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            return res.status(500).send(error.message);
        };
    },

};

async function reports(req, res) {
    var context = "Function getReports";
    try {
        let regexs = [];
        let realDates = [];
        let year = [];
        let quarter = [];
        await parseReq(req, regexs, year, quarter, realDates)

        let debug = false
        if (req.body.debug) {
            debug = req.body.debug
        }

        console.log("debug", debug);

        console.log("regexs: " + regexs[0])
        console.log("realDates: " + realDates[0] + " - " + realDates[1])

        //"(2022-(0[6-9])-)"
        let query = { "end_date_time": { $regex: regexs[0] } }
        //let query = { createdAt: { $gte: dates[0], $lt: dates[1] } }
        let sessions = await sessionsFind(query)

        let usersIds = []
        let sessionsWithUserUnknown = []
        let sessionsWithUsers = []
        await parseUserIds(sessions, usersIds, sessionsWithUserUnknown, sessionsWithUsers, realDates)

        //let UnicUsersIds = [...new Set(usersIds)]
        let UnicUsersIds = []

        for (let i = 0; i != usersIds.length; i++) {
            if (UnicUsersIds.indexOf(usersIds[i]) == -1 && usersIds[i] != 'Unknown')
                UnicUsersIds.push(usersIds[i])
        }

        let usersProfiles = await getUsersProfiles(UnicUsersIds);

        let organizedUsersProfiles = []
        parseOrganizedUsersProfiles(usersProfiles, sessionsWithUsers, organizedUsersProfiles)

        if (organizedUsersProfiles.length != sessionsWithUsers.length) {
            console.log("usersProfiles.length: " + usersProfiles.length)
            console.log("sessionsWithUsers.length: " + sessionsWithUsers.length)
            console.log("organizedUsersProfiles.length: " + organizedUsersProfiles.length)
            console.log(`[${context}] Error `, "Error organizing users")
            return;
        }

        //Filtrar se tem 'PT' ou 'Portugal' no contry
        let domesticUserSessions = []
        let nonDomesticUserSessions = []
        await parseUserType(domesticUserSessions, nonDomesticUserSessions, sessionsWithUsers, organizedUsersProfiles, UnicUsersIds)

        //Dividir em termos de voltagem -> MT // BTN e BTE
        let hwids = [];
        parsehwid(hwids, sessionsWithUsers)

        let unicHwids = [];

        for (let i = 0; i != hwids.length; i++) {
            if (unicHwids.indexOf(hwids[i]) == -1)
                unicHwids.push(hwids[i])
        }

        //Ir buscar os chargers da publicNetworkDB
        let chargers = await getChargersPost(unicHwids)

        let BTDomesticUserSessions = []
        let MTDomesticUserSessions = []
        parseVoltageLevel(MTDomesticUserSessions, BTDomesticUserSessions, domesticUserSessions, chargers)

        let BTNonDomesticUserSessions = []
        let MTNonDomesticUserSessions = []
        parseVoltageLevel(MTNonDomesticUserSessions, BTNonDomesticUserSessions, nonDomesticUserSessions, chargers)

        //Dividir em termos de tipo de tarifa -> Tri / Bi / Sem
        let triBTDomesticUserSessions = []
        let biBTDomesticUserSessions = []
        let simpleBTDomesticUserSessions = []
        parseTarrifType(triBTDomesticUserSessions, biBTDomesticUserSessions, simpleBTDomesticUserSessions, BTDomesticUserSessions)

        let triMTDomesticUserSessions = []
        let biMTDomesticUserSessions = []
        let simpleMTDomesticUserSessions = []
        parseTarrifType(triMTDomesticUserSessions, biMTDomesticUserSessions, simpleMTDomesticUserSessions, MTDomesticUserSessions)

        let triBTNonDomesticUserSessions = []
        let biBTNonDomesticUserSessions = []
        let simpleBTNonDomesticUserSessions = []
        parseTarrifType(triBTNonDomesticUserSessions, biBTNonDomesticUserSessions, simpleBTNonDomesticUserSessions, BTNonDomesticUserSessions)

        let triMTNonDomesticUserSessions = []
        let biMTNonDomesticUserSessions = []
        let simpleMTNonDomesticUserSessions = []
        parseTarrifType(triMTNonDomesticUserSessions, biMTNonDomesticUserSessions, simpleMTNonDomesticUserSessions, MTNonDomesticUserSessions)

        //Dar parse da potencia utilizada -> x >= 11 / x < 11 && x >= 22 / x < 22 & x >= 50 / x < 50
        let lte11triBTDomesticUserSessions = []
        let lte22triBTDomesticUserSessions = []
        let lte50triBTDomesticUserSessions = []
        let gt50triBTDomesticUserSessions = []
        parsePlugPower(lte11triBTDomesticUserSessions, lte22triBTDomesticUserSessions, lte50triBTDomesticUserSessions, gt50triBTDomesticUserSessions, triBTDomesticUserSessions, chargers)

        let lte11biBTDomesticUserSessions = []
        let lte22biBTDomesticUserSessions = []
        let lte50biBTDomesticUserSessions = []
        let gt50biBTDomesticUserSessions = []
        parsePlugPower(lte11biBTDomesticUserSessions, lte22biBTDomesticUserSessions, lte50biBTDomesticUserSessions, gt50biBTDomesticUserSessions, biBTDomesticUserSessions, chargers)

        let lte11simpleBTDomesticUserSessions = []
        let lte22simpleBTDomesticUserSessions = []
        let lte50simpleBTDomesticUserSessions = []
        let gt50simpleBTDomesticUserSessions = []
        parsePlugPower(lte11simpleBTDomesticUserSessions, lte22simpleBTDomesticUserSessions, lte50simpleBTDomesticUserSessions, gt50simpleBTDomesticUserSessions, simpleBTDomesticUserSessions, chargers)

        let lte11triMTDomesticUserSessions = []
        let lte22triMTDomesticUserSessions = []
        let lte50triMTDomesticUserSessions = []
        let gt50triMTDomesticUserSessions = []
        parsePlugPower(lte11triMTDomesticUserSessions, lte22triMTDomesticUserSessions, lte50triMTDomesticUserSessions, gt50triMTDomesticUserSessions, triMTDomesticUserSessions, chargers)

        let lte11biMTDomesticUserSessions = []
        let lte22biMTDomesticUserSessions = []
        let lte50biMTDomesticUserSessions = []
        let gt50biMTDomesticUserSessions = []
        parsePlugPower(lte11biMTDomesticUserSessions, lte22biMTDomesticUserSessions, lte50biMTDomesticUserSessions, gt50biMTDomesticUserSessions, biMTDomesticUserSessions, chargers)

        let lte11simpleMTDomesticUserSessions = []
        let lte22simpleMTDomesticUserSessions = []
        let lte50simpleMTDomesticUserSessions = []
        let gt50simpleMTDomesticUserSessions = []
        parsePlugPower(lte11simpleMTDomesticUserSessions, lte22simpleMTDomesticUserSessions, lte50simpleMTDomesticUserSessions, gt50simpleMTDomesticUserSessions, simpleMTDomesticUserSessions, chargers)

        let lte11triBTNonDomesticUserSessions = []
        let lte22triBTNonDomesticUserSessions = []
        let lte50triBTNonDomesticUserSessions = []
        let gt50triBTNonDomesticUserSessions = []
        parsePlugPower(lte11triBTNonDomesticUserSessions, lte22triBTNonDomesticUserSessions, lte50triBTNonDomesticUserSessions, gt50triBTNonDomesticUserSessions, triBTNonDomesticUserSessions, chargers)

        let lte11biBTNonDomesticUserSessions = []
        let lte22biBTNonDomesticUserSessions = []
        let lte50biBTNonDomesticUserSessions = []
        let gt50biBTNonDomesticUserSessions = []
        parsePlugPower(lte11biBTNonDomesticUserSessions, lte22biBTNonDomesticUserSessions, lte50biBTNonDomesticUserSessions, gt50biBTNonDomesticUserSessions, biBTNonDomesticUserSessions, chargers)

        let lte11simpleBTNonDomesticUserSessions = []
        let lte22simpleBTNonDomesticUserSessions = []
        let lte50simpleBTNonDomesticUserSessions = []
        let gt50simpleBTNonDomesticUserSessions = []
        parsePlugPower(lte11simpleBTNonDomesticUserSessions, lte22simpleBTNonDomesticUserSessions, lte50simpleBTNonDomesticUserSessions, gt50simpleBTNonDomesticUserSessions, simpleBTNonDomesticUserSessions, chargers)

        let lte11triMTNonDomesticUserSessions = []
        let lte22triMTNonDomesticUserSessions = []
        let lte50triMTNonDomesticUserSessions = []
        let gt50triMTNonDomesticUserSessions = []
        parsePlugPower(lte11triMTNonDomesticUserSessions, lte22triMTNonDomesticUserSessions, lte50triMTNonDomesticUserSessions, gt50triMTNonDomesticUserSessions, triMTNonDomesticUserSessions, chargers)

        let lte11biMTNonDomesticUserSessions = []
        let lte22biMTNonDomesticUserSessions = []
        let lte50biMTNonDomesticUserSessions = []
        let gt50biMTNonDomesticUserSessions = []
        parsePlugPower(lte11biMTNonDomesticUserSessions, lte22biMTNonDomesticUserSessions, lte50biMTNonDomesticUserSessions, gt50biMTNonDomesticUserSessions, biMTNonDomesticUserSessions, chargers)

        let lte11simpleMTNonDomesticUserSessions = []
        let lte22simpleMTNonDomesticUserSessions = []
        let lte50simpleMTNonDomesticUserSessions = []
        let gt50simpleMTNonDomesticUserSessions = []
        parsePlugPower(lte11simpleMTNonDomesticUserSessions, lte22simpleMTNonDomesticUserSessions, lte50simpleMTNonDomesticUserSessions, gt50simpleMTNonDomesticUserSessions, simpleMTNonDomesticUserSessions, chargers)

        //Carregar o excel
        const workbook = new Excel.Workbook();

        const UVEDomesticos = workbook.addWorksheet('UVE_Domésticos');

        const UVENaoDomesticos = workbook.addWorksheet('UVE_Não Domésticos');

        //Parse do texto do excel
        const quadro1 = UVEDomesticos.getCell('B2');
        quadro1.value = "Quadro 1: Preços médios faturados aos utilizadores do veículo elétrico (UVE) pelos comercializadores de eletricidade para a mobilidade elétrica (CEME) - UVE Domésticos";

        const quadro2 = UVENaoDomesticos.getCell('B2');
        quadro2.value = "Quadro 2: Preços médios faturados aos utilizadores do veículo elétrico (UVE) pelos comercializadores de eletricidade para a mobilidade elétrica (CEME) - UVE Não Domésticos";

        parseExcelStructure(UVEDomesticos)
        parseExcelStructure(UVENaoDomesticos)
        //Somar as cenas de faturação menos a energia horaria

        //Bt -> MT // Tri -> Bi -> Simples // menor -> maior
        await parseExcel(UVEDomesticos, 7, lte11triBTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 8, lte22triBTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 9, lte50triBTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 10, gt50triBTDomesticUserSessions, false)

        await parseExcel(UVEDomesticos, 11, lte11biBTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 12, lte22biBTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 13, lte50biBTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 14, gt50biBTDomesticUserSessions, false)

        await parseExcel(UVEDomesticos, 15, lte11simpleBTDomesticUserSessions, true)
        await parseExcel(UVEDomesticos, 16, lte22simpleBTDomesticUserSessions, true)
        await parseExcel(UVEDomesticos, 17, lte50simpleBTDomesticUserSessions, true)
        await parseExcel(UVEDomesticos, 18, gt50simpleBTDomesticUserSessions, true)

        await parseExcel(UVEDomesticos, 19, lte11triMTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 20, lte22triMTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 21, lte50triMTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 22, gt50triMTDomesticUserSessions, false)

        await parseExcel(UVEDomesticos, 23, lte11biMTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 24, lte22biMTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 25, lte50biMTDomesticUserSessions, false)
        await parseExcel(UVEDomesticos, 26, gt50biMTDomesticUserSessions, false)

        await parseExcel(UVEDomesticos, 27, lte11simpleMTDomesticUserSessions, true)
        await parseExcel(UVEDomesticos, 28, lte22simpleMTDomesticUserSessions, true)
        await parseExcel(UVEDomesticos, 29, lte50simpleMTDomesticUserSessions, true)
        await parseExcel(UVEDomesticos, 30, gt50simpleMTDomesticUserSessions, true)

        await parseExcel(UVENaoDomesticos, 7, lte11triBTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 8, lte22triBTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 9, lte50triBTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 10, gt50triBTNonDomesticUserSessions, false)

        await parseExcel(UVENaoDomesticos, 11, lte11biBTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 12, lte22biBTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 13, lte50biBTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 14, gt50biBTNonDomesticUserSessions, false)

        await parseExcel(UVENaoDomesticos, 15, lte11simpleBTNonDomesticUserSessions, true)
        await parseExcel(UVENaoDomesticos, 16, lte22simpleBTNonDomesticUserSessions, true)
        await parseExcel(UVENaoDomesticos, 17, lte50simpleBTNonDomesticUserSessions, true)
        await parseExcel(UVENaoDomesticos, 18, gt50simpleBTNonDomesticUserSessions, true)

        await parseExcel(UVENaoDomesticos, 19, lte11triMTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 20, lte22triMTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 21, lte50triMTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 22, gt50triMTNonDomesticUserSessions, false)

        await parseExcel(UVENaoDomesticos, 23, lte11biMTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 24, lte22biMTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 25, lte50biMTNonDomesticUserSessions, false)
        await parseExcel(UVENaoDomesticos, 26, gt50biMTNonDomesticUserSessions, false)

        await parseExcel(UVENaoDomesticos, 27, lte11simpleMTNonDomesticUserSessions, true)
        await parseExcel(UVENaoDomesticos, 28, lte22simpleMTNonDomesticUserSessions, true)
        await parseExcel(UVENaoDomesticos, 29, lte50simpleMTNonDomesticUserSessions, true)
        await parseExcel(UVENaoDomesticos, 30, gt50simpleMTNonDomesticUserSessions, true)

        //Add list of sessions
        if (debug) {

            console.log("Enter debug - ", new Date())
            //const listSessions = workbook.addWorksheet('All Sessions');
            const listSessionsUser = workbook.addWorksheet('Valid Sessions');
            //const listSessionsdomesticUser = workbook.addWorksheet('Sessions D');
            //const listSessionsnonDomesticUser = workbook.addWorksheet('Sessions ND');

            //const listSessionsDomesticUserBT = workbook.addWorksheet('Sessions D BT');
            //const listSessionsDomesticUserMT = workbook.addWorksheet('Sessions D MT');

            //const listSessionsNonDomesticUserBT = workbook.addWorksheet('Sessions ND BT');
            //const listSessionsNonDomesticUserMT = workbook.addWorksheet('Sessions ND MT');

            //const listSessionsDomesticUserBTBi = workbook.addWorksheet('Sessions D BT Bi');
            //const listSessionsDomesticUserMTBi = workbook.addWorksheet('Sessions D MT Bi');

            //const listSessionsNonDomesticUserBTBi = workbook.addWorksheet('Sessions ND BT Bi');
            //const listSessionsNonDomesticUserMTBi = workbook.addWorksheet('Sessions ND MT Bi');

            //const listSessionsDomesticUserBTBilte11 = workbook.addWorksheet('Sessions D BT Bi lte11');
            //const listSessionsDomesticUserBTBilte22 = workbook.addWorksheet('Sessions D BT Bi let22');
            //const listSessionsDomesticUserBTBilte50 = workbook.addWorksheet('Sessions D BT Bi let50');
            //const listSessionsDomesticUserBTBigt50 = workbook.addWorksheet('Sessions D BT Bi gt50');

            //const listSessionsDomesticUserMTBilte11 = workbook.addWorksheet('Sessions D MT Bi lte11');
            //const listSessionsDomesticUserMTBilte22 = workbook.addWorksheet('Sessions D MT Bi let22');
            //const listSessionsDomesticUserMTBilte50 = workbook.addWorksheet('Sessions D MT Bi let50');
            //const listSessionsDomesticUserMTBigt50 = workbook.addWorksheet('Sessions D MT Bi gt50');

            //const listSessionsNonDomesticUserBTBilte11 = workbook.addWorksheet('Sessions ND BT Bi lte11');
            //const listSessionsNonDomesticUserBTBilte22 = workbook.addWorksheet('Sessions ND BT Bi let22');
            //const listSessionsNonDomesticUserBTBilte50 = workbook.addWorksheet('Sessions ND BT Bi let50');
            //const listSessionsNonDomesticUserBTBigt50 = workbook.addWorksheet('Sessions ND BT Bi gt50');

            //const listSessionsNonDomesticUserMTBilte11 = workbook.addWorksheet('Sessions ND MT Bi lte11');
            //const listSessionsNonDomesticUserMTBilte22 = workbook.addWorksheet('Sessions ND MT Bi let22');
            //const listSessionsNonDomesticUserMTBilte50 = workbook.addWorksheet('Sessions ND MT Bi let50');
            //const listSessionsNonDomesticUserMTBigt50 = workbook.addWorksheet('Sessions ND MT Bi gt50');

            //await parseExcelSessionsInformation(listSessions, sessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessonsWithoutUser, sessionsWithUserUnknown, chargers, usersProfiles)
            await parseExcelSessionsInformation(listSessionsUser, sessionsWithUsers, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsdomesticUser, domesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsnonDomesticUser, nonDomesticUserSessions, chargers, usersProfiles)

            //Voltage
            //await parseExcelSessionsInformation(listSessionsDomesticUserBT, BTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserMT, MTDomesticUserSessions, chargers, usersProfiles)

            //await parseExcelSessionsInformation(listSessionsNonDomesticUserBT, BTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserMT, MTNonDomesticUserSessions, chargers, usersProfiles)

            //Bi
            //await parseExcelSessionsInformation(listSessionsDomesticUserBTBi, biBTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserMTBi, biMTDomesticUserSessions, chargers, usersProfiles)

            //await parseExcelSessionsInformation(listSessionsNonDomesticUserBTBi, biBTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserMTBi, biMTNonDomesticUserSessions, chargers, usersProfiles)

            //await parseExcelSessionsInformation(listSessionsDomesticUserBTBilte11, lte11biBTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserBTBilte22, lte22biBTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserBTBilte50, lte50biBTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserBTBigt50, gt50biBTDomesticUserSessions, chargers, usersProfiles)

            //await parseExcelSessionsInformation(listSessionsDomesticUserMTBilte11, lte11biMTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserMTBilte22, lte22biMTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserMTBilte50, lte50biMTDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsDomesticUserMTBigt50, gt50biMTDomesticUserSessions, chargers, usersProfiles)

            //await parseExcelSessionsInformation(listSessionsNonDomesticUserBTBilte11, lte11biBTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserBTBilte22, lte22biBTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserBTBilte50, lte50biBTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserBTBigt50, gt50biBTNonDomesticUserSessions, chargers, usersProfiles)

            //await parseExcelSessionsInformation(listSessionsNonDomesticUserMTBilte11, lte11biMTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserMTBilte22, lte22biMTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserMTBilte50, lte50biMTNonDomesticUserSessions, chargers, usersProfiles)
            //await parseExcelSessionsInformation(listSessionsNonDomesticUserMTBigt50, gt50biMTNonDomesticUserSessions, chargers, usersProfiles)

        }

        //Enviar o excel no email
        const buffer = await workbook.xlsx.writeBuffer();

        let fileName = 'norma-me-2_preços-médios-faturados_Y:' + year[0] + '-Q:' + quarter[0] + '.xlsx'
        let emailSubjext = "RT-" + year[0] + "-2642 - ME 2- Preços Médios Faturados"
        let emailText = "Exmos Srs,\n\nVimos por este meio enviar o ficheiro relativo à Norma ME 2 com os “preços médios faturados” relativos ao " + quarter[0] + "º trimestre de " + year[0] + ".\n\nDisponíveis para qualquer esclarecimento,\n\nMelhores cumprimentos,\nEVIO – Electrical Mobility"


        let cc = []

        if (process.env.NODE_ENV === 'production') {
            //cc.push(process.env.EMAIL_EVIO)
            if (!debug) {
                cc.push(process.env.EMAIL_CARLOS)
                cc.push(process.env.EMAIL_RUI)
            }
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], emailSubjext, emailText, cc)
            //await sendFileBufferToEmailFromSupport(buffer, process.env.EMAIL_TEST, 'norma-me-2_preços-médios-faturados_Y:' + year[0] + '-Q:' + quarter[0] + '.xlsx', cc)
        }
        else {
            if (!debug) {
                cc.push(process.env.EMAIL_TEST2)
            }
            emailSubjext = "[PRE] " + emailSubjext
            await nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], emailSubjext, emailText, cc)
            //await sendFileBufferToEmailFromSupport(buffer, process.env.EMAIL_TEST, 'norma-me-2_preços-médios-faturados_Y:' + year[0] + '-Q:' + quarter[0] + '.xlsx', [])
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function initJobCreateERSEDocument(timer) {
    return new Promise((resolve, reject) => {

        reportTask = cron.schedule(timer, () => {

            let req = []
            let res = []

            let month = moment().month()
            let year = moment().year()
            let quarter = 0

            if (month < 3) {
                year = year - 1;
                quarter = 4
            }
            else {
                quarter = Math.floor(month / 3)
            }

            req.body = {
                "year": year,
                "quarter": quarter
            }

            console.log(req.body)

            reports(req, res)

        }, {
            scheduled: false
        });

        resolve();

    });

};

async function parseReq(req, regexs, years, quarters, realDates) {
    var context = "Function parseReq";
    try {
        //Parse do trimestre
        let year = req.body.year;
        let quarter = req.body.quarter;

        if (!quarter || isNaN(quarter)) {
            console.log(`[${context}] Error `, "No quarter provided")
            return res.status(400).send("No quarter provided");
        }

        //Quarter Values between 1 and 4
        //TODO fix
        //quarter = quarter % 4;
        if (quarter == 0) {
            quarter = 4;
        }

        if (!year || isNaN(year)) {
            console.log(`[${context}] Error `, "No year provided")
            return res.status(400).send("No year provided");
        }

        //let startTime
        //let stopTime
        let realStartTime
        let realStopTime
        let regex = ""

        switch (quarter) {
            case 1:
                realStartTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': (quarter * 3) - 1, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(0[1-3])-)";
                //startTime = moment().set({ 'year': year - 1, 'months': 11, 'date': 31, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                //stopTime = moment().set({ 'year': year, 'months': (quarter * 3), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                break;
            case 2:
                realStartTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': (quarter * 3) - 1, 'date': 30, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(0[4-6])-)";
                //startTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)) - 1, 'date': 31, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                //stopTime = moment().set({ 'year': year, 'months': (quarter * 3), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                break;
            case 3:
                realStartTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': (quarter * 3) - 1, 'date': 30, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(0[7-9])-)";
                //startTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)) - 1, 'date': 30, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                //stopTime = moment().set({ 'year': year, 'months': (quarter * 3), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                break;
            case 4:
                realStartTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)), 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': (quarter * 3) - 1, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(1[0-2])-)";
                //startTime = moment().set({ 'year': year, 'months': (((quarter - 1) * 3)) - 1, 'date': 30, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                //stopTime = moment().set({ 'year': year, 'months': '0', 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                break;
            case 5:
                realStartTime = moment().set({ 'year': year, 'months': 0, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 0, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(01)-)";
                break;
            case 6:
                realStartTime = moment().set({ 'year': year, 'months': 1, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 1, 'date': 28, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(02)-)";
                break;
            case 7:
                realStartTime = moment().set({ 'year': year, 'months': 2, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 2, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(03)-)";
                break;
            case 8:
                realStartTime = moment().set({ 'year': year, 'months': 3, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 3, 'date': 30, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(04)-)";
                break;
            case 9:
                realStartTime = moment().set({ 'year': year, 'months': 4, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 4, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(05)-)";
                break;
            case 10:
                realStartTime = moment().set({ 'year': year, 'months': 5, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 5, 'date': 30, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(06)-)";
                break;
            case 11:
                realStartTime = moment().set({ 'year': year, 'months': 6, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 6, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(07)-)";
                break;
            case 12:
                realStartTime = moment().set({ 'year': year, 'months': 7, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 7, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(08)-)";
                break;
            case 13:
                realStartTime = moment().set({ 'year': year, 'months': 8, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 8, 'date': 30, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(09)-)";
                break;
            case 14:
                realStartTime = moment().set({ 'year': year, 'months': 9, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 9, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(10)-)";
                break;
            case 15:
                realStartTime = moment().set({ 'year': year, 'months': 10, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 10, 'date': 30, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(11)-)";
                break;
            case 16:
                realStartTime = moment().set({ 'year': year, 'months': 11, 'date': 01, 'hour': 00, 'minute': 00, 'second': 00, 'millisecond': 00 })
                realStopTime = moment().set({ 'year': year, 'months': 11, 'date': 31, 'hour': 23, 'minute': 59, 'second': 59, 'millisecond': 999 })
                regex = "(" + year + "-(12)-)";
                break;
            default:
        }

        regexs.push(regex)
        realDates.push(realStartTime)
        realDates.push(realStopTime)
        years.push(year)
        quarters.push(quarter)
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function parseUserIds(sessions, usersIds, sessionsWithUserUnknown, sessionsWithUsers, dates) {
    var context = "Function parseUserIds";
    try {
        for (let i = 0; i != sessions.length; i++) {
            if (sessions[i].userIdToBilling && sessions[i].userIdToBilling != 'Unknown')
                usersIds.push(sessions[i].userIdToBilling)
            else if (sessions[i].userId && sessions[i].userId != 'Unknown')
                usersIds.push(sessions[i].userId)


            if (sessions[i].end_date_time) {

                let endTime = moment(sessions[i].end_date_time)

                if ((sessions[i].userId == 'Unknown' || !sessions[i].userId)) {
                    if (endTime.isBetween(dates[0], dates[1]))
                        sessionsWithUserUnknown.push(sessions[i])
                }
                else {
                    if (sessions[i].paymentStatus != 'CANCELED' && sessions[i].chargerType == '004') {
                        if (endTime.isBetween(dates[0], dates[1])) {
                            sessionsWithUsers.push(sessions[i])
                        }
                    }
                }
            }
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parseOrganizedUsersProfiles(usersProfiles, sessionsWithUsers, organizedUsersProfiles) {
    var context = "Function parseOrganizedUsersProfiles";
    try {
        for (let i = 0; i != sessionsWithUsers.length; i++) {
            if (sessionsWithUsers[i].userId) {
                let parsed = false
                let userId = sessionsWithUsers[i].userId
                if (sessionsWithUsers[i].userIdToBilling && sessionsWithUsers[i].userIdToBilling != 'Unknown') {
                    userId = sessionsWithUsers[i].userIdToBilling
                }
                for (let j = 0; j != usersProfiles.length; j++) {
                    if (userId == usersProfiles[j].userId) {
                        organizedUsersProfiles.push(usersProfiles[j]);
                        parsed = true
                        break;
                    }
                }
                if (!parsed)
                    console.log("Session not parsed: " + sessionsWithUsers[i]._id)
            }
            else {
                console.log("Session without user: " + sessionsWithUsers[i]._id)
            }
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function parseUserType(domesticSessions, nonDoemsticSessions, sessions, usersProfiles, usersIds) {
    var context = "Function parseUserType";
    try {
        let users = await getUsersPost(usersIds);

        for (let i = 0; i != usersProfiles.length; i++) {

            //console.log("usersProfiles[i]._id: " + usersProfiles[i]._id)
            //console.log("usersProfiles[i].clientType: " + usersProfiles[i].clientType)

            if (usersProfiles[i].clientType == 'BUSINESSCUSTOMER') {
                nonDoemsticSessions.push(sessions[i])
            }
            else if (usersProfiles[i].clientType == 'CLIENTTYPEBILLINGPROFILEPRIVATECUSTOMER' || usersProfiles[i].clientType == 'PRIVATECUSTOMER') {
                domesticSessions.push(sessions[i])
            }
            else {
                for (let j = 0; j != users.length; j++) {
                    if (users[j]._id == usersProfiles[i].userId) {
                        if (users[j].country == 'PT' || users[j].country == 'Portugal') {
                            if (usersProfiles[i].nif.startsWith('2') || usersProfiles[i].nif.startsWith('1') || usersProfiles[i].nif.startsWith('3'))
                                domesticSessions.push(sessions[i])
                            else
                                nonDoemsticSessions.push(sessions[i])
                        }
                        else {
                            console.log("Uncataloged foreign user, userId = " + users[j]._id + "!")
                        }
                        break;
                    }

                }
            }
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parseVoltageLevel(MTSessions, BTSessions, sessions, chargers) {
    var context = "Function parseVoltageLevel";
    try {
        for (let i = 0; i != sessions.length; i++) {
            for (let j = 0; j != chargers.length; j++) {
                if (sessions[i].location_id == chargers[j].hwId) {
                    if (chargers[j].voltageLevel == 'MT')
                        MTSessions.push(sessions[i])
                    else
                        BTSessions.push(sessions[i])
                }
            }
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parseTarrifType(triSessions, biSessions, simpleSessions, sessions) {
    var context = "Function parseTarrifType";
    try {
        for (let i = 0; i != sessions.length; i++) {
            if (sessions[i].tariffCEME) {
                if (sessions[i].tariffCEME.tariffType == "server_bi_hour")
                    biSessions.push(sessions[i])
                else if (sessions[i].tariffCEME.tariffType == "server_tri_hour")
                    triSessions.push(sessions[i])
                else
                    simpleSessions.push(sessions[i])
            }
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parsehwid(hwids, sessionsWithUsers) {
    var context = "Function parsehwid";
    try {
        for (let i = 0; i != sessionsWithUsers.length; i++) {
            if (sessionsWithUsers[i].location_id)
                hwids.push(sessionsWithUsers[i].location_id)
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parsePlugPower(lte11, lte22, lte50, gt50, sessions, chargers) {
    var context = "Function parsePlugPower";
    try {
        for (let i = 0; i != sessions.length; i++) {
            for (let j = 0; j != chargers.length; j++) {
                if (sessions[i].location_id == chargers[j].hwId) {
                    for (let k = 0; k != chargers[j].plugs.length; k++) {
                        if (sessions[i].connector_id == chargers[j].plugs[k].plugId) {
                            if (chargers[j].plugs[k].power <= 11)
                                lte11.push(sessions[i])
                            else if (chargers[j].plugs[k].power <= 22)
                                lte22.push(sessions[i])
                            else if (chargers[j].plugs[k].power <= 50)
                                lte50.push(sessions[i])
                            else
                                gt50.push(sessions[i])
                        }
                    }
                }
            }
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function parseExcel(worksheet, line, sessions, simple) {
    var context = "Function parseExcel";
    try {
        if (simple)
            parseExcelEnergySimpleInformation(worksheet, line, sessions)
        else
            await parseExcelEnergyInformation(worksheet, line, sessions)

        await parseExcelFinancialInformation(worksheet, line, sessions)
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parseExcelStructure(worksheet) {
    var context = "Function parseExcelStructure";
    try {
        const nivelDeTensao = worksheet.getCell('B6');
        nivelDeTensao.value = "Nível de Tensão";

        const opcaoHoraria = worksheet.getCell('C6');
        opcaoHoraria.value = "Opção horária";

        const potenciaDeCarregamento = worksheet.getCell('D6');
        potenciaDeCarregamento.value = "Potência de Carregamento (kW)";

        const energiaEmHorasDePonta = worksheet.getCell('E6');
        energiaEmHorasDePonta.value = "Energia em horas de Ponta (kWh)";

        const energiaEmHorasCheias = worksheet.getCell('F6');
        energiaEmHorasCheias.value = "Energia em horas Cheias (kWh)";

        const energiaEmHorasDeForaDeVazio = worksheet.getCell('G6');
        energiaEmHorasDeForaDeVazio.value = "Energia em horas de Fora de Vazio (kWh)";

        const energiaEmHorasDeVazio = worksheet.getCell('H6');
        energiaEmHorasDeVazio.value = "Energia em horas de Vazio (kWh)";

        const energiaSemDiferenciaçãoHoraria = worksheet.getCell('I6');
        energiaSemDiferenciaçãoHoraria.value = "Energia sem diferenciação horária (kWh)";

        const energiaTotal = worksheet.getCell('J6');
        energiaTotal.value = "Energia Total (kWh)";

        const numeroDeCarregamentos = worksheet.getCell('K6');
        numeroDeCarregamentos.value = "Número de Carregamentos";

        const numeroDeUVE = worksheet.getCell('L6');
        numeroDeUVE.value = "Número de UVE";

        const tempoTotalDeCarregamentos = worksheet.getCell('M6');
        tempoTotalDeCarregamentos.value = "Tempo Total de Carregamentos (min)";

        const custoDaTarifaDeAcessoAsRedesME = worksheet.getCell('N6');
        custoDaTarifaDeAcessoAsRedesME.value = "Custo da Tarifa de Acesso às Redes ME (€)";

        const custoDaTarifaEGMEAplicavelAosCEME = worksheet.getCell('O6');
        custoDaTarifaEGMEAplicavelAosCEME.value = "Custo da Tarifa EGME aplicável aos CEME (€)";

        const faturacaoDaComponenteCEME = worksheet.getCell('P6');
        faturacaoDaComponenteCEME.value = "Faturação da componente CEME (€)";

        const faturacaoDaComponenteOPC = worksheet.getCell('Q6');
        faturacaoDaComponenteOPC.value = "Faturação da componente OPC (€)";

        const faturacaoDeTaxasEImpostosSemIVA = worksheet.getCell('R6');
        faturacaoDeTaxasEImpostosSemIVA.value = "Faturação de taxas e impostos, sem IVA (€)";

        const faturacaoDoIVA = worksheet.getCell('S6');
        faturacaoDoIVA.value = "Faturação do IVA (€)";

        const faturacaoTotalComTaxasEImpostosSoma = worksheet.getCell('T6');
        faturacaoTotalComTaxasEImpostosSoma.value = "Faturação total, com taxas e impostos (€)";
        //faturacaoTotalComTaxasEImpostosSoma.value = "Faturação total, com taxas e impostos (€) (Soma das componentes)";

        //const faturacaoTotalComTaxasEImpostos = worksheet.getCell('U6');
        //faturacaoTotalComTaxasEImpostos.value = "Faturação total, com taxas e impostos (€) (Valor da base de dados)";

        for (let i = 0; i != 12; i++) {
            let bt = worksheet.getCell('B' + (7 + i));
            bt.value = 'BT'
            let mt = worksheet.getCell('B' + (19 + i));
            mt.value = 'MT'
        }

        for (let i = 0; i != 4; i++) {
            let tri1 = worksheet.getCell('C' + (7 + i));
            let tri2 = worksheet.getCell('C' + (19 + i));
            tri1.value = "Tri-horário"
            tri2.value = "Tri-horário"
            let bi1 = worksheet.getCell('C' + (11 + i));
            let bi2 = worksheet.getCell('C' + (23 + i));
            bi1.value = "Bi-horário"
            bi2.value = "Bi-horário"
            let simple1 = worksheet.getCell('C' + (15 + i));
            let simple2 = worksheet.getCell('C' + (27 + i));
            simple1.value = "Simples"
            simple2.value = "Simples"
        }
        for (let i = 0; i != 6; i++) {
            let lte11 = worksheet.getCell('D' + (7 + (i * 4)));
            let lte22 = worksheet.getCell('D' + (8 + (i * 4)));
            let lte50 = worksheet.getCell('D' + (9 + (i * 4)));
            let gt50 = worksheet.getCell('D' + (10 + (i * 4)));

            lte11.value = "≤ 11"
            lte22.value = " > 11  e  ≤22"
            lte50.value = "> 22  e ≤ 50"
            gt50.value = "> 50"
        }
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function parseExcelEnergyInformation(worksheet, line, sessions) {
    var context = "Function parseExcelEnergyInformation";
    try {
        //find cdrs
        let cdrsIds = [];

        for (let i = 0; i != sessions.length; i++) {
            if (sessions[i].id) {
                cdrsIds.push(sessions[i].id)
            }
        }

        let cdrsQuery = { session_id: cdrsIds }

        let cdrs = await cdrsFind(cdrsQuery)

        //parse to energy componentes
        let energyRush = 0
        let energyFull = 0
        let energyEmpty = 0
        let energyNotEmpty = 0
        let totalEnergy = 0
        let totalChargeTime = 0



        for (let i = 0; i != cdrs.length; i++) {
            if (cdrs[i].mobie_cdr_extension) {
                if (cdrs[i].mobie_cdr_extension.usage) {
                    if (cdrs[i].mobie_cdr_extension.usage.totalDuration)
                        totalChargeTime += cdrs[i].mobie_cdr_extension.usage.totalDuration
                    if (cdrs[i].mobie_cdr_extension.usage.energia_total_transacao)
                        totalEnergy += cdrs[i].mobie_cdr_extension.usage.energia_total_transacao
                }
                if (cdrs[i].mobie_cdr_extension.subUsages) {
                    for (let k = 0; k != cdrs[i].mobie_cdr_extension.subUsages.length; k++) {
                        if (cdrs[i].mobie_cdr_extension.subUsages[k].energia_ponta) {
                            energyRush += cdrs[i].mobie_cdr_extension.subUsages[k].energia_ponta;
                            //totalEnergy += cdrs[i].mobie_cdr_extension.subUsages[k].energia_ponta;
                        }
                        if (cdrs[i].mobie_cdr_extension.subUsages[k].energia_cheias) {
                            energyFull += cdrs[i].mobie_cdr_extension.subUsages[k].energia_cheias;
                            //totalEnergy += cdrs[i].mobie_cdr_extension.subUsages[k].energia_cheias;
                        }
                        if (cdrs[i].mobie_cdr_extension.subUsages[k].energia_vazio) {
                            energyEmpty += cdrs[i].mobie_cdr_extension.subUsages[k].energia_vazio;
                            //totalEnergy += cdrs[i].mobie_cdr_extension.subUsages[k].energia_vazio;
                        }
                        if (cdrs[i].mobie_cdr_extension.subUsages[k].energia_fora_vazio) {
                            energyNotEmpty += cdrs[i].mobie_cdr_extension.subUsages[k].energia_fora_vazio;
                            //totalEnergy += cdrs[i].mobie_cdr_extension.subUsages[k].energia_fora_vazio;
                        }
                    }
                }
            }
        }

        //put components in excel
        const energyRushcell = worksheet.getCell('E' + line);
        energyRushcell.value = energyRush;

        const energyFullcell = worksheet.getCell('F' + line);
        energyFullcell.value = energyFull;

        const energyEmptycell = worksheet.getCell('H' + line);
        energyEmptycell.value = energyEmpty;

        const energyNotEmptycell = worksheet.getCell('G' + line);
        energyNotEmptycell.value = energyNotEmpty;

        const totalEnergycell = worksheet.getCell('J' + line);
        totalEnergycell.value = totalEnergy;

        const totalChargeTimecell = worksheet.getCell('M' + line);
        totalChargeTimecell.value = totalChargeTime;

    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parseExcelEnergySimpleInformation(worksheet, line, sessions) {
    var context = "Function parseExcelEnergySimpleInformation";
    try {



        let energySimple = 0;

        for (let i = 0; i != sessions.length; i++) {
            console.log(sessions[i]._id)
            if (sessions[i].kwh)
                energySimple = + sessions[i].kwh
        }

        const energySimplecell = worksheet.getCell('I' + line);
        energySimplecell.value = energySimple;
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function onlyUnique(value, index, self) {
    var context = "Function onlyUnique";
    try {
        return self.indexOf(value) === index;
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function parseExcelFinancialInformation(worksheet, line, sessions) {
    var context = "Function parseExcelFinancialInformation";
    try {
        let totalInvoicing = 0;
        let IVAInvoicing = 0;
        let taxesInvoicing = 0;
        let OCPInvoicing = 0;
        let CEMEInvoicing = 0;
        let EGMEInvoicing = 0;
        let accessTariffInvoicing = 0;
        let totalChargeTime = 0;
        let numberOfUsers = 0;
        let users = []
        let numberOfCharges = 0;
        let totalEnergy = 0;

        let cdrsIds = [];

        for (let i = 0; i != sessions.length; i++) {
            if (sessions[i].id) {
                cdrsIds.push(sessions[i].id)
            }
        }

        let cdrsQuery = { session_id: cdrsIds }

        let cdrs = await cdrsFind(cdrsQuery)

        for (let i = 0; i != sessions.length; i++) {
            for (let k = 0; k != cdrs.length; k++) {
                if (sessions[i].id == cdrs[k].session_id) {

                    let minimumBillingConditions = utils.hasMinimumBillingConditionsMobiE(cdrs[k])

                    if (minimumBillingConditions)
                        apoioMobilidadeEletricaCEME = cdrs[k].mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme

                    if (sessions[i].finalPrices) {
                        if (sessions[i].finalPrices.totalPrice) {
                            totalInvoicing += sessions[i].finalPrices.totalPrice.incl_vat;
                            IVAInvoicing += sessions[i].finalPrices.totalPrice.incl_vat - sessions[i].finalPrices.totalPrice.excl_vat;
                        }
                        if (sessions[i].finalPrices.iecPrice)
                            taxesInvoicing += sessions[i].finalPrices.iecPrice.excl_vat - apoioMobilidadeEletricaCEME;
                        if (sessions[i].finalPrices.opcPrice)
                            OCPInvoicing += sessions[i].finalPrices.opcPrice.excl_vat;
                        if (sessions[i].finalPrices.cemePrice)
                            CEMEInvoicing += sessions[i].finalPrices.cemePrice.excl_vat + sessions[i].finalPrices.tarPrice.excl_vat + apoioMobilidadeEletricaCEME;
                        /*
                        if (sessions[i].finalPrices.othersPrice) {
                            let otherPrice = sessions[i].finalPrices.othersPrice.find(price => price.description.includes("Activation Fee"))
                            if (otherPrice) {
                                EGMEInvoicing += otherPrice.price.excl_vat
                            }
                        }
                        */
                        if (sessions[i].finalPrices.tarPrice)
                            accessTariffInvoicing += sessions[i].finalPrices.tarPrice.excl_vat;

                    }
                    if (sessions[i].timeCharged) {
                        totalChargeTime = totalChargeTime + (sessions[i].timeCharged / 60);
                        if ((sessions[i].timeCharged / 60) >= parseInt(process.env.MinimumTimeOfSession)) {
                            EGMEInvoicing += parseFloat(process.env.EGMEFee)
                        }
                    }
                    if (sessions[i].userId)
                        users.push(sessions[i].userId)
                    numberOfCharges++;
                }
            }
        }

        unicUsers = users.filter(onlyUnique);

        numberOfUsers = unicUsers.length

        //const totalInvoicingcell = worksheet.getCell('U' + line);
        //totalInvoicingcell.value = totalInvoicing;

        const totalInvoicingCalculatedcell = worksheet.getCell('T' + line);
        totalInvoicingCalculatedcell.value = IVAInvoicing + taxesInvoicing + OCPInvoicing + CEMEInvoicing;

        const IVAInvoicingcell = worksheet.getCell('S' + line);
        IVAInvoicingcell.value = IVAInvoicing;

        const taxesInvoicinggcell = worksheet.getCell('R' + line);
        taxesInvoicinggcell.value = taxesInvoicing;

        const OCPInvoicingcell = worksheet.getCell('Q' + line);
        OCPInvoicingcell.value = OCPInvoicing;

        const CEMEInvoicingcell = worksheet.getCell('P' + line);
        CEMEInvoicingcell.value = CEMEInvoicing;

        const EGMEInvoicingcell = worksheet.getCell('O' + line);
        EGMEInvoicingcell.value = EGMEInvoicing;

        const accessTariffInvoicingcell = worksheet.getCell('N' + line);
        accessTariffInvoicingcell.value = accessTariffInvoicing;

        const numberOfUserscell = worksheet.getCell('L' + line);
        numberOfUserscell.value = numberOfUsers;

        const numberOfChargescell = worksheet.getCell('K' + line);
        numberOfChargescell.value = numberOfCharges;



    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function parseExcelSessionsInformation(worksheet, sessions, chargers, usersProfiles) {
    var context = "Function parseExcelSessionsInformation";
    try {

        let cdrsIds = [];
        let invoiceIds = [];
        let paymentIds = [];

        for (let i = 0; i != sessions.length; i++) {
            if (sessions[i].id) {
                cdrsIds.push(sessions[i].id)
            }

            if (sessions[i].invoiceId)
                if (sessions[i].invoiceId != "")
                    invoiceIds.push(sessions[i].invoiceId)

            if (sessions[i].paymentId)
                if (sessions[i].paymentId != "")
                    paymentIds.push(sessions[i].paymentId)
        }

        let cdrsQuery = { session_id: cdrsIds }

        let cdrs = await cdrsFind(cdrsQuery)

        let invoices = await getInvoices(invoiceIds)

        let payments = await getPayments(paymentIds)

        let transactions = await getTransactions(invoiceIds)

        let rows = []

        console.log("CRDS LENGH: " + cdrs.length)
        console.log("CRDSID LENGH: " + cdrsIds.length)

        worksheet.addRow(["Session Id", "Cdr Id", "Charger Id",
            "User Id", "Biliing Profile Id",
            "Start Time", "Stop Time",
            "City", "Street", "zip Code",
            "Time Charged (min)",
            "Energia Total (kWh)",
            "Total OPC €", "Total CEME €", "Total TAR €",
            "Total Tarifa EGME", "Ativação c/ Apoio Publico", "Total IEC",
            "Custo Total € s/IVA", "Taxa de IVA", "Custo Total € c/IVA",
            "Energia em ponta", "Energia em cheias",
            "Energia em vazio", "Energia fora do vazio",
            "Voltage Level Session", "Voltage Level Charger", "ClientType", "NIF", "idUsage", "cdrTime", "cdrVoltageLevel", "sessionCdrId", "apoio mobilidade eletrica ceme", "potencia do plug", "token type", "created Way",
            "Client Name", "Tarifa CEME nome", "Tarifa CEME _id", "Invoice Id", "Invoice Document Number", "Invoice Emission Date",
            "User Mobile", "User Email",
            "Display Text", "Command",
            "Payment Id", "Payment Method",
            "Transaction Id", "Adyen id", "Transaction status"

        ]);

        for (let i = 0; i != sessions.length; i++) {

            let sessionId = "-"
            let totalOpc = "-"
            let totalCeme = "-"
            let totalTar = "-"
            let totalEgme = 0
            let totalAcessFee = "-"
            let totalIec = "-"
            let totalPriceExclVat = "-"
            let vatPrice = "-"
            let totalInclVat = "-"
            let energyRush = 0
            let energyFull = 0
            let energyEmpty = 0
            let energyNotEmpty = 0
            let chargerId = "-"
            let cdrsId = "-"
            let startTime = "-"
            let stopTime = "-"
            let clientType = "-"
            let voltageLevelCharger = "-"
            let NIF = "-"
            let bilingProfileId = "-"
            let idUsage = "-"
            let cdrTime = 0;
            let cdrVoltageLevel = "-"
            let totalChargeTime = 0
            let totalEnergy = 0
            let apoioMobilidadeEletricaCEME = 0;
            let potenciaDoPlug = 0;
            let tokenType = "-";
            let createdWay = "-";
            let clientName = "-";
            let tariffCEMEName = "-"
            let tariffCEMEId = "-"
            let invoiceId = "-"
            let invoiceDocumentNumber = "-"
            let invoiceEmissionDate = "-"
            let userMobile = "-"
            let userEmail = "-"
            let displayText = "-"
            let command = "-"
            let paymentId = "-"
            let paymentMethod = "-"
            let transactionId = "-"
            let adyenId = "-"
            let transactionStatus = "-"

            if (sessions[i]._id)
                sessionId = sessions[i]._id

            if (sessions[i].invoiceId)
                if (sessions[i].invoiceId != "") {
                    invoiceId = sessions[i].invoiceId
                }
            if (sessions[i].createdWay)
                createdWay = sessions[i].createdWay


            if (sessions[i].clientName)
                clientName = sessions[i].clientName

            if (sessions[i].cdr_token)
                if (sessions[i].cdr_token.type)
                    tokenType = sessions[i].cdr_token.type

            if (sessions[i].tariffCEME) {
                if (sessions[i].tariffCEME._id)
                    tariffCEMEId = sessions[i].tariffCEME._id

                if (sessions[i].tariffCEME.planName)
                    tariffCEMEName = sessions[i].tariffCEME.planName
            }

            if (sessions[i].displayText) {
                if (sessions[i].displayText.text) {
                    displayText = sessions[i].displayText.text
                }
            }

            if (sessions[i].command) {
                command = sessions[i].command
            }


            if (sessions[i].finalPrices) {
                // TOTAL OPC
                if (sessions[i].finalPrices.opcPrice) {
                    totalOpc = sessions[i].finalPrices.opcPrice.excl_vat
                }

                // TOTAL TAR
                if (sessions[i].finalPrices.tarPrice) {
                    totalTar = sessions[i].finalPrices.tarPrice.excl_vat
                }

                //TOTAL EGME
                if (sessions[i].timeCharged) {
                    if ((sessions[i].timeCharged / 60) >= parseInt(process.env.MinimumTimeOfSession)) {
                        totalEgme += parseFloat(process.env.EGMEFee)
                    }
                }

                //if (sessions[i].finalPrices.othersPrice) {
                //    let otherPrice = sessions[i].finalPrices.othersPrice.find(price => price.description.includes("Activation Fee"))
                //    if (otherPrice) {
                //        totalEgme = otherPrice.price.excl_vat
                //    }
                //}

                // TOTAL ACESS FEE
                if (sessions[i].finalPrices.cemePriceDetail) {
                    if (sessions[i].finalPrices.cemePriceDetail.flatPrice)
                        totalAcessFee = sessions[i].finalPrices.cemePriceDetail.flatPrice.excl_vat
                }

                // TOTAL IEC
                if (sessions[i].finalPrices.iecPrice) {
                    totalIec = sessions[i].finalPrices.iecPrice.excl_vat
                }

                // TOTAL EXCL VAT
                if (sessions[i].finalPrices.totalPrice) {
                    totalPriceExclVat = sessions[i].finalPrices.totalPrice.excl_vat
                }

                // TOTAL VAT
                if (sessions[i].finalPrices.totalPrice) {
                    vatPrice = sessions[i].finalPrices.totalPrice.incl_vat - sessions[i].finalPrices.totalPrice.excl_vat
                }

                // TOTAL INCL VAT
                if (sessions[i].finalPrices.totalPrice) {
                    totalInclVat = sessions[i].finalPrices.totalPrice.incl_vat
                }
            }

            for (let j = 0; j != chargers.length; j++) {
                if (sessions[i].location_id == chargers[j].hwId) {
                    chargerId = chargers[j].hwId
                    voltageLevelCharger = chargers[j].voltageLevel
                    for (let k = 0; k != chargers[j].plugs.length; k++) {
                        if (sessions[i].connector_id == chargers[j].plugs[k].plugId) {
                            potenciaDoPlug = chargers[j].plugs[k].power
                        }
                    }
                }
            }


            for (let j = 0; j != invoices.length; j++) {
                if (invoices[j]._id)
                    if (sessions[i].invoiceId == invoices[j]._id) {
                        if (invoices[j].documentNumber)
                            invoiceDocumentNumber = invoices[j].documentNumber
                        if (invoices[j].emissionDate)
                            invoiceEmissionDate = invoices[j].emissionDate
                    }
            }

            for (let j = 0; j != payments.length; j++) {
                if (payments[j]._id)
                    if (sessions[i].paymentId == payments[j]._id) {
                        paymentId = payments[j]._id
                        paymentMethod = payments[j].paymentMethod
                    }
            }

            for (let j = 0; j != transactions.length; j++) {
                if (sessions[i].invoiceId == transactions[j].invoiceId) {
                    if (transactions[j]._id)
                        transactionId = transactions[j]._id
                    if (transactions[j].adyenReference)
                        adyenId = transactions[j].adyenReference
                    if (transactions[j].status)
                        transactionStatus = transactions[j].status
                }
            }


            let userId = "-"
            if (sessions[i].userId) {
                userId = sessions[i].userId
            }
            if (sessions[i].userIdToBilling) {
                userId = sessions[i].userIdToBilling
            }
            if (userId != "-") {
                for (let j = 0; j != usersProfiles.length; j++) {
                    if (userId == usersProfiles[j].userId) {
                        if (usersProfiles[j]._id)
                            bilingProfileId = usersProfiles[j]._id
                        if (usersProfiles[j].clientType !== null)
                            clientType = usersProfiles[j].clientType
                        else
                            clientType = "Calculado a paritr do NIF"
                        NIF = usersProfiles[j].nif
                    }
                }
            }

            if (userId != "-") {
                let users = await getUsersPost([userId])
                if (users.length > 0) {
                    if (users[0].mobile)
                        userMobile = users[0].mobile
                    if (users[0].email)
                        userEmail = users[0].email
                }
            }
            else {
                userMobile = "-"
                userEmail = "-"
            }

            for (let k = 0; k != cdrs.length; k++) {
                if (sessions[i].id == cdrs[k].session_id && sessions[i].cdrId == cdrs[k].id) {

                    cdrsId = cdrs[k].id
                    startTime = cdrs[k].start_date_time
                    stopTime = cdrs[k].end_date_time


                    if (cdrs[k].mobie_cdr_extension) {
                        if (cdrs[k].mobie_cdr_extension.usage) {
                            if (cdrs[k].mobie_cdr_extension.usage.totalDuration)
                                totalChargeTime = cdrs[k].mobie_cdr_extension.usage.totalDuration
                            if (cdrs[k].mobie_cdr_extension.usage.energia_total_transacao)
                                totalEnergy = cdrs[k].mobie_cdr_extension.usage.energia_total_transacao
                            if (cdrs[k].mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme)
                                apoioMobilidadeEletricaCEME = cdrs[k].mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme

                        }
                    }
                    if (cdrs[k].mobie_cdr_extension) {
                        if (cdrs[k].mobie_cdr_extension.usage) {
                            if (cdrs[k].mobie_cdr_extension.usage.idUsage)
                                idUsage = cdrs[k].mobie_cdr_extension.usage.idUsage
                            if (cdrs[k].mobie_cdr_extension.usage.totalDuration)
                                cdrTime = cdrs[k].mobie_cdr_extension.usage.totalDuration
                            if (cdrs[k].mobie_cdr_extension.usage.nivel_tensao_transacao)
                                cdrVoltageLevel = cdrs[k].mobie_cdr_extension.usage.nivel_tensao_transacao
                        }
                        if (cdrs[k].mobie_cdr_extension.subUsages) {
                            for (let g = 0; g != cdrs[k].mobie_cdr_extension.subUsages.length; g++) {
                                if (cdrs[k].mobie_cdr_extension.subUsages[g].energia_ponta)
                                    energyRush += cdrs[k].mobie_cdr_extension.subUsages[g].energia_ponta;
                                if (cdrs[k].mobie_cdr_extension.subUsages[g].energia_cheias)
                                    energyFull += cdrs[k].mobie_cdr_extension.subUsages[g].energia_cheias;
                                if (cdrs[k].mobie_cdr_extension.subUsages[g].energia_vazio)
                                    energyEmpty += cdrs[k].mobie_cdr_extension.subUsages[g].energia_vazio;
                                if (cdrs[k].mobie_cdr_extension.subUsages[g].energia_fora_vazio)
                                    energyNotEmpty += cdrs[k].mobie_cdr_extension.subUsages[g].energia_fora_vazio;
                            }
                        }
                    }
                }
            }

            // TOTAL CEME
            if (sessions[i].finalPrices) {
                if (sessions[i].finalPrices.cemePrice) {
                    totalCeme = sessions[i].finalPrices.cemePrice.excl_vat + totalTar + apoioMobilidadeEletricaCEME;
                }
            }

            if (cdrsId != "-")
                rows.push([sessionId, cdrsId, chargerId,
                    sessions[i].userId, bilingProfileId,
                    startTime, stopTime,
                    sessions[i].address.city, sessions[i].address.street, sessions[i].address.zipCode,
                    totalChargeTime,
                    totalEnergy,
                    totalOpc, totalCeme, totalTar,
                    totalEgme, totalAcessFee, totalIec,
                    totalPriceExclVat, vatPrice, totalInclVat,
                    energyRush, energyFull,
                    energyEmpty, energyNotEmpty,
                    sessions[i].voltageLevel, voltageLevelCharger, clientType, NIF, idUsage, cdrTime, cdrVoltageLevel, sessions[i].cdrId, apoioMobilidadeEletricaCEME, potenciaDoPlug, tokenType, createdWay,
                    clientName, tariffCEMEName, tariffCEMEId, invoiceId, invoiceDocumentNumber, invoiceEmissionDate,
                    userMobile, userEmail,
                    displayText, command,
                    paymentId, paymentMethod,
                    transactionId, adyenId, transactionStatus
                ])

        }

        console.log("ROWs length: " + rows.length)

        for (let i = 0; i != rows.length; i++)
            await worksheet.addRow(rows[i]);

        console.log("Rows added With sucess!")

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function sendFileBufferToEmailFromSupport(buffer, email, fileName, emailscc) {
    var context = "Function sendFileBufferToEmailFromSupport";
    try {
        var transporter = nodemailer.createTransport({
            maxConnections: 2,
            maxMessages: 1,
            pool: true,
            host: 'smtp.office365.com',
            port: 587,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        var mailOptions = {
            source: '"evio Support" <support@go-evio.com>',
            from: '"evio Support" <support@go-evio.com>',
            to: email,
            cc: emailscc,
            subject: 'norma-me-2_preços-médios-faturados',
            attachments:
            {
                filename: fileName,
                content: buffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent!');
            };
        });
    }
    catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function sessionsFind(query) {
    var context = "Function sessionsFind";


    let project = {
        userId: 1,
        chargerType: 1,
        id: 1,
        end_date_time: 1,
        kwh: 1,
        location_id: 1,
        connector_id: 1,
        cdrId: 1,
        paymentStatus: 1,
        userIdToBilling: 1,
        timeCharged: 1,
        tariffCEME: 1,
        finalPrices: 1,
        voltageLevel: 1,
        address: 1,
        cdr_token: 1,
        clientName: 1,
        createdWay: 1,
        invoiceId: 1,
        paymentId: 1
    }



    return new Promise((resolve, reject) => {
        Sessions.find(query, project, (err, sessionsFound) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(sessionsFound);
            };
        });
    });
};

function sessionsFindFields(query, fields) {
    var context = "Function sessionsFindFields";
    return new Promise((resolve, reject) => {
        Sessions.find(query, fields, (err, sessionsFound) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(sessionsFound);
            };
        });
    });
};

function cdrsFind(query) {
    var context = "Function cdrsFind";

    let project = {
        id: 1,
        session_id: 1,
        start_date_time: 1,
        end_date_time: 1,
        mobie_cdr_extension: 1,
        total_time: 1,
        total_energy: 1
    }


    return new Promise((resolve, reject) => {
        Cdrs.find(query, project, (err, sessionsFound) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(sessionsFound);
            };
        });
    });
};

function getChargers(hwids) {
    var context = "Function getChargers";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                hwId: hwids
            };

            console.log("hwids: " + hwids.length)

            //Change route
            let host = process.env.HostPublicNetwork + process.env.PathGetAllCharger


            axios.get(host, { params })
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error.message);
                    resolve([]);
                })

        }
        catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve([]);
        }
    });
}

function getInvoices(invoiceId) {
    var context = "Function getChargers";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                invoiceId: invoiceId
            };


            //Change route
            let host = process.env.HostBilling + process.env.PathGetInvoiceDocuments


            axios.get(host, { params })
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error.message);
                    resolve([]);
                })

        }
        catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve([]);
        }
    });
}

function getUsersProfiles(userIds) {
    var context = "Function getUsersProfiles";
    return new Promise(async (resolve, reject) => {
        try {

            let body = {
                _id: userIds
            };

            //Change route
            let host = process.env.HostUser + process.env.PathProfilesList

            axios.post(host, body)
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error);
                    resolve([]);
                })

        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            resolve([]);
        }
    });
};

function getPayments(paymentIds) {
    var context = "Function getPayments";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                _id: paymentIds
            };

            //Change route
            let host = process.env.HostPayments + process.env.PathGetPaymentsById

            axios.get(host, { params })
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error);
                    resolve([]);
                })

        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            resolve([]);
        }
    });
};

function getTransactions(invoiceIds) {
    var context = "Function getTransactions";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                invoices: invoiceIds
            };

            //Change route
            let host = process.env.HostPayments + process.env.PathGetTrnsactionsByInvoiceId

            axios.get(host, { params })
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error);
                    resolve([]);
                })

        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            resolve([]);
        }
    });
};


function getUsers(userIds) {
    var context = "Function getUsers";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                _id: userIds
            };

            //Change route
            let host = process.env.HostUser + process.env.PathListOfUsers
            axios.get(host, { params })
                .then(response => {
                    resolve(response.data);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error);
                    resolve([]);
                })

        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            resolve([]);
        }
    });
};

async function getChargersPost(hwids) {
    var context = "Function getChargersPost";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                hwId: hwids
            };

            let host = process.env.HostPublicNetwork + process.env.PathGetAllCharger

            let response = await axiosS.axiosPostBody(host, params)

            resolve(response)
        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            resolve([]);
        }
    });
}

async function getUsersPost(userIds) {
    var context = "Function getUsers";
    return new Promise(async (resolve, reject) => {
        try {

            let params = {
                _id: userIds
            };

            //Change route
            let host = process.env.HostUser + process.env.PathListOfUsers

            let response = await axiosS.axiosPostBody(host, params)

            resolve(response)

        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            resolve([]);
        }
    });
};
