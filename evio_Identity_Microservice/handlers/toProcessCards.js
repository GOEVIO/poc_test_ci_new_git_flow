require("dotenv-safe").load();
const Sentry = require('@sentry/node');
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
const Cards = require('../controllers/toProcessCards');
const Job = require('../models/jobs');
const { logger } = require('../utils/constants');
const { default: { deleteCachedContractsByUser  } } = require('../services/contracts');

let createProcessCards = null
let createWhiteList = null

module.exports = {

    createCards: (req, res) => createCards(req, res),

    startProcessCardsJob: (req, res) => startProcessCardsJob(req, res),
    forceProcess: () => forceProcess(),

    startWhiteListJob: (req, res) => startWhiteListJob(req, res),
    get: (req, res) => get(req, res),
    getFailedOrInvalidCards: (req, res) => getFailedOrInvalidCards(req, res),
    getFileCards: (req, res) => getFileCards(req, res),
    getCardNumberCards: (req, res) => getCardNumberCards(req, res),
}

//========== CREATE ==========
async function createCards(req, res) {
    var context = "function creatCard";
    try {

        if (!req.body.cards)
            return res.status(400).send({ code: 'cards_null', message: "Cards is null" });

        let cards = req.body.cards

        let result = {
            'cardsSaved': 0,
            'cardsRefused': 0
        }

        for (let i = 0; i != cards.length; i++) {
            if (await Cards.verifyCards(cards[i], result.errors)) {
                Cards.createCard(cards[i])
                result.cardsSaved++;
            }
            else {
                result.cardsRefused++;
            }
        }
        return res.status(200).send(result);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function forceProcess() {
    var context = "function forceProcess";
    try {

        let query = {
            status: {
                $in: [process.env.TOPROCESSCARDSTATUSFAILPROCESS, process.env.TOPROCESSCARDSTATUSTOPROCESS]
            }
        }

        let results = []

        let cards = await Cards.findCards(query)

        let contracts = await Cards.findCardsContracts(cards)

        await removeContractsCache(contracts);

        let cardsWithContract = await Cards.checkCardsWithNoContracts(cards, contracts)

        let cardsWithContractAndNoDuplicateTags = await Cards.checkCardsWithDuplicateTags(cardsWithContract)

        let cardsActivated = await Cards.activateNetWorks(cardsWithContractAndNoDuplicateTags, contracts)

        results.push(cardsActivated)

        Cards.sendEmail();

        return cardsActivated

    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);
        return []
    };
}

async function forceWhiteList() {
    var context = "function forceWhiteList";
    try {

        let query = {
            status: process.env.TOPROCESSCARDSTATUSSENDOFFLINETAGS
        }

        let cards = await Cards.findCards(query)

        let cardsToWhiteList = Cards.filterWhiteListCards(cards)

        let result = await Cards.activateWhiteList(cardsToWhiteList)

        return;

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return;
    };
}

async function get(req, res) {
    var context = "function creatCard";
    try {

        if (!req.params.query)
            return res.status(400).send({ code: 'no_query', message: "Query is null" });

        let query = req.params.query

        let cards = await Cards.findCards(query)

        return res.status(200).send(cards);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function getFailedOrInvalidCards(req, res) {
    var context = "function creatCard";
    try {

        let query = {
            status: {
                $in: [process.env.TOPROCESSCARDSTATUSFAILPROCESS, process.env.TOPROCESSCARDSTATUSNOCONTRACT]
            }
        }

        let cards = await Cards.findCards(query)

        return res.status(200).send(cards);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function getFileCards(req, res) {
    var context = "function creatCard";
    try {

        if (!req.params.fileName)
            return res.status(400).send({ code: 'no_fileName', message: "File name is null" });

        let fileName = req.params.fileName

        let query = {
            fileName: fileName
        }

        let cards = await Cards.findCards(query)

        return res.status(200).send(cards);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

async function getCardNumberCards(req, res) {
    var context = "function creatCard";
    try {

        if (!req.params.cardNumber)
            return res.status(400).send({ code: 'no_cardNumber', message: "Card Number is null" });

        let cardNumber = req.params.cardNumber

        let query = {
            cardNumber: cardNumber
        }

        let cards = await Cards.findCards(query)

        return res.status(200).send(cards);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
}

function startProcessCardsJob() {
    initProcessCards().then(() => {
        createProcessCards.start();
        console.log("Process Cards Job Started")

    }).catch((e) => {
        console.log("Error starting Process Cards Job")
    });
}

function initProcessCards() {
    return new Promise(async (resolve, reject) => {

        console.log("Process Cards Job Init");
        let timer = await getJobProcessCardsTimer(); // Everyday at 03h:35 04h:35 05h:35

        createProcessCards = cron.schedule(timer, () => {
            console.log('Process Cards Job ' + new Date().toISOString());

            forceProcess()
        }, {
            scheduled: false
        });

        resolve();

    });
};

function startWhiteListJob() {
    initWhiteListJob().then(() => {
        createWhiteList.start();
        console.log("White List Job Started")

    }).catch((e) => {
        console.log("Error starting White List Job")
    });
}

function initWhiteListJob() {
    return new Promise((resolve, reject) => {

        console.log("White List Job Init");
        var timer = "0 2,3 * * 2,4"; // Tuesday and Thursday at 02h:00 and 3:00

        createWhiteList = cron.schedule(timer, () => {
            console.log('White List Job ' + new Date().toISOString());

            forceWhiteList()
        }, {
            scheduled: false
        });

        resolve();

    });
};

function getJobProcessCardsTimer() {
    const context = "[ jobCardCSV getJobListCSV]"
    return new Promise((resolve, reject) => {

        let defaultTimer = "*/30 * * * *"

        try {
            let query = {
                name: process.env.TOPROCESSCARDSJOBNAME
            }
            Job.findOne(query).then(function (job) {
                if (!job)
                    resolve(defaultTimer);

                resolve(job)

            }).catch(function (error) {
                console.log(`${context} Error : `, error);
                resolve(defaultTimer);
            })
        } catch (error) {
            console.log(`${context} Error : `, error);
            resolve(defaultTimer);
        }
    })
}

async function removeContractsCache (contracts) {
    const context = "Function removeContractsCache"
    contracts.forEach(async(contract) => {
        try {
            await deleteCachedContractsByUser(contract.userId);
            console.log(`[${context}] Cache removed from Redis for user ${contract.userId}`);
        }
        catch(err) {
            console.log(`[${context}] Error while removing cache from Redis `, err.message);
            Sentry.captureException(err)
        }
    });
}
