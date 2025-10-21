require("dotenv-safe").load();
const CDR = require('../models/cdrs')
const moment = require("moment");
const axiosS = require('../services/axios')
const utils = require('../utils')

module.exports = {
    get: (req, res) => getCemeReports(req, res),
    getTotal: (req, res) => getCemeReportTotal(req, res),
    getEGMEMonth: (req, res) => getCemeEGMEMonth(req, res),
    getApoioMonth: (req, res) => getCemeApoioMonth(req, res),
    getIECMonth: (req, res) => getCemeIECMonth(req, res),
    getCEMEExportMonth: (req, res) => getCEMEExportMonth(req, res)
};

async function getCemeReportTotal(req, res) {
    let context = "Function getCemeReportTotal";
    try {
        //Validate fields
        //3 fields data de inicio data de fim e ceme
        //if (validateFields(req.query, req.headers['isadmin'])) return res.status(400).send(validateFields(req.query, req.headers['isadmin']))
        //let cpoUserId = req.headers['isadmin'] ? req.query.ownerId : req.headers['userid']
        //let foundUser = await Utils.findUserById(cpoUserId)

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");

        let ceme = req.query.ceme;

        let query = [{
            "$match": {
                "$and": [
                    { status: process.env.OcpiSessionCompleted },
                    { "tariffCEME.CEME": ceme },
                    { end_date_time: { $gte: startDate, $lt: endDate } }
                ]
            }
        },
        {
            "$group": {
                "_id": null,
                "sessionsNumber": { $sum: 1 },
                "totalEnergy": { $sum: "$kwh" },
                "totalTime": { $sum: { $divide: ["$timeCharged", 3600] } },
                "totalReveneuFromEnergy": { $sum: "$finalPrices.cemePriceDetail.powerPrice.excl_vat" },
                "totalActivationFee": { $sum: "$finalPrices.cemePriceDetail.flatPrice.excl_vat" },
                "totalIEC": { $sum: { $multiply: ["$kwh", "$fees.IEC"] } },
                "totalTAR": { $sum: "$finalPrices.tarPrice.excl_vat" },
            }
        },
        {
            "$project": {
                "totalEnergy": "$totalEnergy",
                "totalTime": "$totalTime",
                "sessionsNumber": '$sessionsNumber',
                "totalReveneuFromEnergy": '$totalReveneuFromEnergy',
                "totalActivationFee": '$totalActivationFee',
                "totalHelp": '$totalIEC',
                "totalIEC": '$totalIEC',
                "totalTAR": '$totalTAR',
                "_id": 0
            }
        }
        ];

        let hostCDR = process.env.HostOcpi + process.env.PathGetAgregateSessionsOCPI;

        finalData = await axiosS.axiosPostBody(hostCDR, query)

        query = [{
            "$match": {
                "$and": [
                    { "mobie_cdr_extension.usage.idServiceProvider": ceme },
                    { end_date_time: { $gte: startDate, $lt: endDate } }
                ]
            }
        },
        {
            "$group": {
                "_id": null,
                "sessionsNumber": { $sum: 1 },
                "aid": { $sum: "$mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme" },
            }
        }
        ];

        hostCDR = process.env.HostOcpi + process.env.PathGetCDRsAgregate;


        let totalAID = await axiosS.axiosPostBody(hostCDR, query)

        console.log("finalData")
        console.log(finalData)
        console.log("totalAID")
        console.log(totalAID)

        if (finalData.length > 0 && totalAID > 0)
            finalData[0].totalHelp = totalAID[0].aid


        if(finalData.length == 0) {
            finalData.push(
                {
                    "totalEnergy": 0,
                    "totalTime": 0,
                    "sessionsNumber": 0,
                    "totalReveneuFromEnergy": 0,
                    "totalActivationFee": 0,
                    "totalHelp": 0,
                    "totalIEC": 0,
                    "totalTAR": 0
                }
            )
        }

        return res.status(200).send(finalData)

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

async function getCEMEExportMonth(req, res) {
    let context = "Function getCEMEExportMonth";
    try {

        if (!req.query.date) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        let date = req.query.date;
        let ceme = req.query.ceme;

        let finalData = [];

        let dateStart = moment(date, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let dateEnd = moment(date, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");

        let query = [{
            "$match": {
                "$and": [
                    { status: process.env.OcpiSessionCompleted },
                    { "tariffCEME.CEME": ceme },
                    { end_date_time: { $gte: dateStart, $lt: dateEnd } }
                ]
            }
        },
        {
            "$group": {
                "_id": '$party_id',
                "sessionsNumber": { $sum: 1 },
                "totalEnergy": { $sum: "$kwh" },
                "totalTime": { $sum: { $divide: ["$timeCharged", 3600] } },
                "totalReveneuFromEnergy": { $sum: "$finalPrices.cemePriceDetail.powerPrice.excl_vat" },
                "totalActivationFee": { $sum: "$finalPrices.cemePriceDetail.flatPrice.excl_vat" },
            }
        },
        {
            "$project": {
                "cpo": "$_id",
                "totalEnergy": "$totalEnergy",
                "totalTime": "$totalTime",
                "sessionsNumber": '$sessionsNumber',
                "totalReveneuFromEnergy": '$totalReveneuFromEnergy',
                "totalActivationFee": '$totalActivationFee',
                "_id": 0
            }
        }
        ];

        let hostCDR = process.env.HostOcpi + process.env.PathGetAgregateSessionsOCPI;



        finalData = await axiosS.axiosPostBody(hostCDR, query)



        console.log(finalData)

        return res.status(200).send(finalData)

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

async function getCemeReports(req, res) {
    let context = "Function getCemeReports";
    try {

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        let dateStart = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let dateEnd = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");

        let query = [{
            "$match": {
                "$and": [
                    { status: process.env.OcpiSessionCompleted },
                    { "tariffCEME.CEME": req.query.ceme },
                    { end_date_time: { $gte: dateStart, $lt: dateEnd } }
                ]
            }
        },
        {
            "$group": {
                "_id": { month: { $month: { $dateFromString: { dateString: "$end_date_time" } } }, year: { $year: { $dateFromString: { dateString: "$end_date_time" } } } },
                "sessionsNumber": { $sum: 1 },
                "totalEnergy": { $sum: "$kwh" },
                "totalTime": { $sum: { $divide: ["$timeCharged", 3600] } },
                "totalReveneuFromEnergy": { $sum: "$finalPrices.cemePriceDetail.powerPrice.excl_vat" },
                "totalActivationFee": { $sum: "$finalPrices.cemePriceDetail.flatPrice.excl_vat" },
            }
        },
        { "$sort": { "_id.year": -1, "_id.month": -1 } },
        {
            "$project": {
                "month": "$_id.month",
                "year": "$_id.year",
                "totalEnergy": "$totalEnergy",
                "totalTime": "$totalTime",
                "sessionsNumber": '$sessionsNumber',
                "totalReveneuFromEnergy": '$totalReveneuFromEnergy',
                "totalActivationFee": '$totalActivationFee',
                "_id": 0
            }
        },
        ];

        let hostCDR = process.env.HostOcpi + process.env.PathGetAgregateSessionsOCPI;

        console.log(hostCDR)
        console.log(query)

        let foundCdrs = await axiosS.axiosPostBody(hostCDR, query)

        return res.status(200).send(foundCdrs)

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}


async function getCemeEGMEMonth(req, res) {
    let context = "Function getCemeEGMEMonth";
    try {

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");
        let ceme = req.query.ceme;

        let query = {
            "$and": [
                { total_time: { $gte: 2 } },
                { "mobie_cdr_extension.usage.idServiceProvider": ceme },
                { end_date_time: { $gte: startDate, $lt: endDate } }
            ]
        }

        let hostCDR = process.env.HostOcpi + process.env.PathGetCDRsFind;

        let foundCdrs = await axiosS.axiosPostBody(hostCDR, query)

        return res.status(200).send({
            "egme": foundCdrs.length * parseFloat(process.env.EGMEFee),
            "numberOfSessions": foundCdrs.length
        })

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

function OLD_getEGME(cdrs, ceme) {
    let egme = 0

    for (let i = 0; i != cdrs.length; i++) {
        //check for ceme
        if (cdrs[i].mobie_cdr_extension)
            if (cdrs[i].mobie_cdr_extension.usage)
                if (cdrs[i].mobie_cdr_extension.usage.idServiceProvider)
                    if (cdrs[i].mobie_cdr_extension.usage.idServiceProvider == ceme) {
                        if (cdrs[i].total_time >= 2) {
                            egme += parseFloat(process.env.EGMEFee)
                        }
                    }
    }

    return egme;
}

async function getCemeApoioMonth(req, res) {
    let context = "Function getCemeApoioMonth";
    try {

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");
        let ceme = req.query.ceme;

        let query = [{
            "$match": {
                "$and": [
                    { "mobie_cdr_extension.usage.idServiceProvider": ceme },
                    { end_date_time: { $gte: startDate, $lt: endDate } }
                ]
            }
        },
        {
            "$group": {
                "_id": null,
                "sessionsNumber": { $sum: 1 },
                "aid": { $sum: "$mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme" },
            }
        }
        ];

        let hostCDR = process.env.HostOcpi + process.env.PathGetCDRsAgregate;

        let foundCdrs = await axiosS.axiosPostBody(hostCDR, query)

        if (foundCdrs.length == 0) {
            foundCdrs.push(
                {
                    sessionsNumber: 0,
                    aid: 0
                }
            )
        }

        return res.status(200).send(foundCdrs[0])

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

function OLD_getApoio(cdrs, ceme) {
    let apoio = 0

    for (let i = 0; i != cdrs.length; i++) {
        //check for ceme
        if (cdrs[i].mobie_cdr_extension)
            if (cdrs[i].mobie_cdr_extension.usage)
                if (cdrs[i].mobie_cdr_extension.usage.idServiceProvider)
                    if (cdrs[i].mobie_cdr_extension.usage.idServiceProvider == ceme) {
                        apoio += parseFloat(cdrs[i].mobie_cdr_extension.usage.apoio_mobilidade_eletrica_ceme)
                    }
    }

    return apoio;

}

async function getCemeIECMonth(req, res) {
    let context = "Function getCemeIECMonth";
    try {

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");
        let ceme = req.query.ceme;

        let query = [{
            "$match": {
                "$and": [
                    { status: process.env.OcpiSessionCompleted },
                    { "tariffCEME.CEME": req.query.ceme },
                    { end_date_time: { $gte: startDate, $lt: endDate } }
                ]
            }
        },
        {
            "$group": {
                "_id": { IEC: "$fees.IEC", IVA: "$fees.IVA" },
                "sessionsNumber": { $sum: 1 },
                "totalIEC": { $sum: { $multiply: ["$kwh", "$fees.IEC"] } }
            }
        },
        {
            "$project": {
                "IEC": "$_id.IEC",
                "IVA": "$_id.IVA",
                "sessionsNumber": "$sessionsNumber",
                "totalIEC": "$totalIEC",
                "_id": 0
            }
        },
        ];

        let hostCDR = process.env.HostOcpi + process.env.PathGetAgregateSessionsOCPI;

        let foundCdrs = await axiosS.axiosPostBody(hostCDR, query)

        let finalData =
        {
            "iec": {
                "iecMadeira": 0,
                "iecMadeiraNumber": 0,
                "iecAcores": 0,
                "iecAcoresNumber": 0,
                "iecContinente": 0,
                "iecContinenteNumber": 0
            },
            "numberOfSessions": 0
        }

        for (let i = 0; i != foundCdrs.length; i++) {
            if (foundCdrs[i].IEC != 0) {
                if (foundCdrs[i].IVA == process.env.IVAContinente) {
                    finalData.iec.iecContinenteNumber += foundCdrs[i].sessionsNumber
                    finalData.iec.iecContinente += foundCdrs[i].totalIEC
                }
                else if (foundCdrs[i].IVA == process.env.IVAMadeira) {
                    finalData.iec.iecMadeiraNumber += foundCdrs[i].sessionsNumber
                    finalData.iec.iecMadeira += foundCdrs[i].totalIEC
                }
                else if (foundCdrs[i].IVA == process.env.IVAAzores) {
                    finalData.iec.iecAcoresNumber += foundCdrs[i].sessionsNumber
                    finalData.iec.iecAcores += foundCdrs[i].totalIEC
                }
            }
            finalData.numberOfSessions += foundCdrs[i].sessionsNumber
        }

        return res.status(200).send(finalData)

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

async function OLD_getCemeIECMonth(req, res) {
    let context = "Function getCemeIECMonth";
    try {

        if (!req.query.ceme) {
            return res.status(400).send("CEME is needed");
        }

        if (!req.query.startDate) {
            return res.status(400).send("StartDate is needed");
        }

        if (!req.query.endDate) {
            return res.status(400).send("EndDate is needed");
        }

        let startDate = moment(req.query.startDate, ["YYYY-M-DD", "YYYY-MM-DD"]).startOf('month').format("YYYY-MM-DD");
        let endDate = moment(req.query.endDate, ["YYYY-M-DD", "YYYY-MM-DD"]).endOf('month').format("YYYY-MM-DD");
        let ceme = req.query.ceme;

        let query = {
            "$and": [
                { "mobie_cdr_extension.usage.idServiceProvider": ceme },
                { end_date_time: { $gte: startDate, $lt: endDate } }
            ]
        }

        let hostCDR = process.env.HostOcpi + process.env.PathGetCDRsFind;

        let foundCdrs = await axiosS.axiosPostBody(hostCDR, query)

        let iec = await getIEC(foundCdrs, ceme)

        return res.status(200).send({
            "iec": iec,
            "numberOfSessions": foundCdrs.length
        })

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error);
    }
}

async function getIEC(cdrs, ceme) {
    let iecMadeira = 0
    let iecMadeiraNumber = 0

    let iecAcores = 0
    let iecAcoresNumber = 0

    let iecContinente = 0
    let iecContinenteNumber = 0

    let sessionsIds = []

    for (let i = 0; i != cdrs.length; i++) {
        if (cdrs[i].session_id)
            sessionsIds.push(cdrs[i].session_id)
    }

    //query dos sessions
    let params = {
        "id": sessionsIds
    }

    let host = process.env.HostOcpi + process.env.PathGetChargingSessionsOCPI;

    let sessions = await axiosS.axiosPostBody(host, params)

    for (let i = 0; i != cdrs.length; i++) {
        //check for ceme
        if (cdrs[i].mobie_cdr_extension)
            if (cdrs[i].mobie_cdr_extension.usage)
                if (cdrs[i].mobie_cdr_extension.usage.idServiceProvider == ceme) {
                    for (let j = 0; j != sessions.length; j++) {
                        if (sessions[j].id == cdrs[i].session_id) {
                            if (sessions[j].fees && cdrs[i].total_energy) {
                                if (sessions[j].fees.IEC == 0) {
                                    //Foreigner
                                }
                                else if (sessions[j].fees.IVA == process.env.IVAContinente) {
                                    //TODO used IVA because fuction was too slow, maybe add a camp to CDRs in the future if Iva changes
                                    iecContinente += (cdrs[i].total_energy * sessions[j].fees.IEC);
                                    iecContinenteNumber++;
                                }
                                else {

                                    let timeZone = utils.getTimezone(cdrs[i].cdr_location.coordinates.latitude, cdrs[i].cdr_location.coordinates.longitude)

                                    if (timeZone == process.env.TIME_ZONE_MADEIRA) {
                                        iecMadeira += (cdrs[i].total_energy * sessions[j].fees.IEC);
                                        iecMadeiraNumber++;
                                    }

                                    else if (timeZone == process.env.TIME_ZONE_ACORES) {
                                        iecAcores += (cdrs[i].total_energy * sessions[j].fees.IEC);
                                        iecAcoresNumber++;
                                    }

                                }
                            }
                        }
                    }
                }
    }

    return {
        "iecMadeira": iecMadeira,
        "iecMadeiraNumber": iecMadeiraNumber,
        "iecAcores": iecAcores,
        "iecAcoresNumber": iecAcoresNumber,
        "iecContinente": iecContinente,
        "iecContinenteNumber": iecContinenteNumber
    };

}