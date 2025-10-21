require("dotenv-safe").load();
const Contract = require('../models/contracts');
const axiosServices = require('../services/axios');
const GroupOfDrives = require('../models/groupDrivers')
const moment = require('moment');
const User = require('../models/user')
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
const { logger } = require('../utils/constants');

module.exports = {
    getByUser: (req, res) => getContractsUser(req, res),
    getByAdmin: (req, res) => getContractsAdmin(req, res),
    putCancelPhysicalCard: (req, res) => putCancelPhysicalCard(req, res),
    putChangeStatusToProcess: (req, res) => putChangeStatusToProcess(req, res),
    putCard: (req, res) => cardsChangeCard(req, res),
    getEVIds: (req, res) => getEVIds(req, res),
    deleteContractWithoutEv: (req, res) => deleteContractWithoutEv(req, res),
    startDelteExtraContractsJob: () => startDelteExtraContractsJob()
}

let createDeleteExtraContractstask = null

//========== GET ==========
async function getContractsUser(req, res) {
    let context = "GET getContractsUser";
    try {
        let userId = req.headers['userid'];

        console.log("userid: " + userId)

        console.log(req.query)

        if (!req.query.pageNumber) {
            return res.status(400).send("Param pageNumber is needed");
        }

        let pageNumber = req.query.pageNumber;

        let limiteQuery = process.env.LimiteQueryContract;

        if (req.query.limiteQuery)
            limiteQuery = req.query.limiteQuery;


        let query = {
            "userId": userId,
            "contractType": process.env.ContractTypeFleet,
            'cardPhysicalStateInfo': { $ne: process.env.CARDPHYSICALSTATEINFOVIRTUALONLY }
        }

        let options = {
            skip: (Number(pageNumber) - 1) * Number(limiteQuery),
            limit: Number(limiteQuery),
            //allowDiskUse: true
        };

        var sort = { createdAt: -1 };

        let project = {
            cardNumber: 1,
            evId: 1,
            cardPhysicalLicensePlate: 1,
            cardPhysicalStateInfo: 1,
            cardPhysicalName: 1,
            cardName: 1,
            requestDate: 1,
            requestThirdPartyDate: 1,
            processedThirdPartyDate: 1,
            activationDate: 1
        }

        let contracts = await Contract.find(query, project, options).sort(sort)

        console.log("Number of contacts: " + contracts.length)

        if (contracts.length == 0) {
            return res.status(200).header({ 'Access-Control-Expose-Headers': ['totalOfEntries', 'numberOfPages'], 'totalOfEntries': 0, 'numberOfPages': 0 }).send([]);
        }

        let totalOfEntries = await Contract.find(query).count()
        let numberOfPages = Math.ceil(totalOfEntries / limiteQuery)


        let host = process.env.HostEv + process.env.PathGetEVGeral


        let evsIds = []

        for (let i = 0; i != contracts.length; i++)
            evsIds.push(contracts[i].evId)

        let evs = await axiosServices.axiosGet(host, { _id: evsIds });
        console.log("Number of evs: " + evs.length)

        let finalData = []

        for (let i = 0; i != contracts.length; i++) {

            let driversNames = []
            let utilizador = 'Utilizadores';
            let licensePlate = '';

            for (let j = 0; j != evs.length; j++) {
                if (contracts[i].evId == evs[j]._id) {

                    licensePlate = evs[j].licensePlate

                    if (evs[j].listOfGroupDrivers) {

                        let listOfGroupDriversGroupId = []

                        for (let k = 0; k != evs[j].listOfGroupDrivers.length; k++) {
                            listOfGroupDriversGroupId.push(evs[j].listOfGroupDrivers[k].groupId)
                        }

                        let groupOfDrives = await GroupOfDrives.find({ _id: listOfGroupDriversGroupId })

                        for (let k = 0; k != groupOfDrives.length; k++) {
                            for (let l = 0; l != groupOfDrives[k].listOfDrivers.length; l++) {
                                if (groupOfDrives[k].listOfDrivers[l].name)
                                    driversNames.push(groupOfDrives[k].listOfDrivers[l].name)
                                else
                                    driversNames.push("UnNamed")
                            }
                        }

                    }

                    if (evs[j].listOfDrivers)
                        for (let k = 0; k != evs[j].listOfDrivers.length; k++) {
                            if (evs[j].listOfDrivers[k].name)
                                driversNames.push(evs[j].listOfDrivers[k].name)
                            else
                                driversNames.push("UnNamed")
                        }

                }
            }

            if (driversNames.length == 1)
                utilizador = driversNames[0];

            if (driversNames.length == 0) {
                let user = await User.find({ _id: userId })

                if (user.length > 0) {
                    driversNames = user[0].name
                    utilizador = [user[0].name]
                }
            }

            finalData.push({
                cardNumber: contracts[i].cardNumber,
                cardPhysicalName: contracts[i].cardPhysicalName ? contracts[i].cardPhysicalName : contracts[i].cardName,
                cardName: contracts[i].cardName,
                cardPhysicalStateInfo: contracts[i].cardPhysicalStateInfo,
                requestDate: contracts[i].requestDate instanceof Date ? contracts[i].requestDate : new Date(contracts[i].requestDate),
                requestThirdPartyDate: contracts[i].requestThirdPartyDate instanceof Date ? contracts[i].requestThirdPartyDate : new Date(contracts[i].requestThirdPartyDate),
                processedThirdPartyDate: contracts[i].processedThirdPartyDate instanceof Date ? contracts[i].processedThirdPartyDate : new Date(contracts[i].processedThirdPartyDate),
                activationDate: contracts[i].activationDate instanceof Date ? contracts[i].activationDate : new Date(contracts[i].activationDate),
                utilizador: utilizador,
                driversNames: driversNames,
                cardPhysicalLicensePlate: contracts[i].cardPhysicalLicensePlate ? contracts[i].cardPhysicalLicensePlate : "",
            })

        }

        return res.status(200).header({ 'Access-Control-Expose-Headers': ['totalOfEntries', 'numberOfPages'], 'totalOfEntries': totalOfEntries, 'numberOfPages': numberOfPages }).send(finalData);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function getContractsAdmin(req, res) {
    var context = "function getContractsAdmin";
    try {

        let sort = { requestDate: -1 };

        let project = {
            cardNumber: 1,
            cardPhysicalName: 1,
            cardPhysicalLicensePlate: 1,
            cardPhysicalText: 1,
            cardPhysicalSendTo: 1,
            cardPhysicalInTheCareOf: 1,
            cardName: 1,
            evId: 1,
            name: 1,
            email: 1,
            shippingAddress: 1,
            contract_id: 1,
            userId: 1,
            requestDate: 1,
            mobile: 1,
            internationalPrefix: 1
        }

        let query = {
            cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOREQUESTEDBYCUSTOMER,
            status: 'active',
            active: true,
            clientName: "EVIO" //TODO remove from query when B2B WL customer management when done in control center
        }

        let contracts = await Contract.find(query, project).sort(sort)


        let finalData = [];

        for (let i = 0; i != contracts.length; i++) {

            finalData.push({
                cardNumber: contracts[i].cardNumber,
                cardPhysicalName: contracts[i].cardPhysicalName ? contracts[i].cardPhysicalName : contracts[i].cardName,
                cardName: contracts[i].cardName,
                name: contracts[i].name,
                email: contracts[i].email,
                cardPhysicalLicensePlate: contracts[i].cardPhysicalLicensePlate ? contracts[i].cardPhysicalLicensePlate : "",
                cardPhysicalText: contracts[i].cardPhysicalText ? contracts[i].cardPhysicalText : "",
                cardPhysicalSendTo: contracts[i].cardPhysicalSendTo ? contracts[i].cardPhysicalSendTo : "",
                cardPhysicalInTheCareOf: contracts[i].cardPhysicalInTheCareOf ? contracts[i].cardPhysicalInTheCareOf : "",
                address: contracts[i].shippingAddress,
                contractId: contracts[i].contract_id,
                requestDate: contracts[i].requestDate,
                mobile: contracts[i].mobile ? contracts[i].mobile : "",
                internationalPrefix: contracts[i].internationalPrefix ? contracts[i].internationalPrefix : "",
            })

        }

        return res.status(200).send(finalData);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function putCancelPhysicalCard(req, res) {
    let context = "PUT /api/private/contracts/cancelPhysicalCards";
    try {

        if (!req.body.cardsNumbers) {
            return res.status(400).send("cardsNumbers are needed");
        }

        let cardsNumbers = req.body.cardsNumbers;


        let query = {
            "cardNumber": cardsNumbers
        }

        let update = {
            $set: { cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOCANCELEDBYEVIO }
        }

        let result = await Contract.updateMany(query, update)

        return res.status(200).send(result);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function putChangeStatusToProcess(req, res) {
    let context = "PUT /api/private/contracts/cardsToProcessStatusUpdate";
    try {

        if (!req.body.cardsNumbers) {
            return res.status(400).send("cardsNumbers are needed");
        }

        let cardsNumbers = req.body.cardsNumbers;


        let query = {
            "cardNumber": cardsNumbers
        }

        let update = {
            $set: { cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOREQUESTEDTOTHIRDPARTY, requestThirdPartyDate: new Date() }
        }

        console.log(update)

        let result = await Contract.updateMany(query, update)

        return res.status(200).send(result);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function cardsChangeCard(req, res) {
    let context = "PUT /api/private/contracts/cardsChangeCard";
    try {

        if (!req.body.card) {
            return res.status(400).send("cardsNumber are needed");
        }

        let newCard = req.body.card

        let cardNumber = newCard.cardNumber;

        let query = {
            "cardNumber": cardNumber
        }

        let update = {
            $set: newCard
        }

        console.log("update")
        console.log(update)

        let result = await Contract.updateMany(query, update)

        return res.status(200).send(result);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

}

async function getEVIds(req, res) {
    var context = "function getContractsAdmin";
    try {

        let query = { $match: { $and: [{ evId: { $exists: true } }, { evId: { $ne: "" } }] } }

        let project = {
            $group:
            {
                _id: null,
                EVIds: { $push: "$evId" }
            }
        }


        let EVids = await Contract.aggregate([query, project])

        return res.status(200).send(EVids[0].EVIds);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function deleteContractWithoutEv(req, res) {
    var context = "function deleteContractWithoutEv";
    try {

        processDeleteContractWithoutEv()

        return res.status(200).send();
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function processDeleteContractWithoutEv(req, res) {
    var context = "function deleteContractWithoutEv";
    try {

        let host = process.env.HostEv + process.env.PathGetEVsIds

        let evIds = await axiosServices.axiosGet(host, {})

        let query = { $and: [{ evId: { $exists: true } }, { evId: { $ne: "" } }, { evId: { $nin: evIds } }] }

        console.log("query")
        console.log(query)

        let evsLeft = await Contract.find(query)

        console.log("Ev with contract Found: " + evIds.length + "\nEvs without contract Found: " + evsLeft.length)

        evsLeft.forEach(ev => {
            return new Promise((resolve, reject) => {
                let query = { _id: ev._id }
                Contract.removeContracts(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}][findone] Error `, err.message);
                        reject(err);
                    }
                    else {
                        resolve(result);
                    };
                });
            });
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

function startDelteExtraContractsJob() {
    initDeleteExtraContractsJob().then(() => {
        createDeleteExtraContractstask.start();
        console.log("Create delete extra Contracts Job Started")

    }).catch((e) => {
        console.log("Error starting Create delete extra Contracts Job")
    });
}

function initDeleteExtraContractsJob() {
    return new Promise((resolve, reject) => {

        console.log("Create delete extra Contracts Job Init");
        var timer = "50 4 * * *"; // Everyday at 04h:50

        createDeleteExtraContractstask = cron.schedule(timer, () => {
            console.log('Create delete extra Contracts Job ' + new Date().toISOString());

            processDeleteContractWithoutEv()
        }, {
            scheduled: false
        });

        resolve();

    });
};