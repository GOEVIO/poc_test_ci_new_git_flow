require("dotenv-safe").load();
const Sentry = require('@sentry/node');
const Contracts = require('../models/contracts');
const Cards = require('../models/toProcessCards');
const User = require('../models/user');
const GroupCSUsers = require('../models/groupCSUsers');
const fs = require("fs");
const path = require("path");
const checkDigitMobility = require('../digitCalculation/digitCalculation')
const rawdata = fs.readFileSync(path.resolve(__dirname, "../digitCalculation/lists.json"));
const checkDigitLists = JSON.parse(rawdata);
const moment = require('moment');
const Excel = require('exceljs');
const nodemailerS = require('./../services/nodemailerService')
const axios = require("axios");
const notificationsHost = 'http://notifications:3008';
const sendEmailRequest = `${notificationsHost}/api/private/sendEmail`;
const { logger } = require('../utils/constants');
const axiosS = require('../services/axios');
const mongoose = require('mongoose');

module.exports = {

    verifyCards: (card) => verifyCards(card),

    createCard: (card) => createCard(card),

    findCardsContracts: (cards) => findCardsContracts(cards),

    checkCardsWithNoContracts: (cards, contracts) => checkCardsWithNoContracts(cards, contracts),

    checkCardsWithDuplicateTags: (cards) => checkCardsWithDuplicateTags(cards),

    activateNetWorks: (cards, contracts) => activateNetWorks(cards, contracts),

    findCards: (query) => findCards(query),

    findCardsLimited: (query) => findCardsLimited(query),

    updateCard: (query, updateQuery) => updateCard(query, updateQuery),

    findContract: (query) => findContract(query),

    setRefId: (contractId, network, refId) => setRefId(contractId, network, refId),

    sendEmail: () => sendEmail(),

    filterWhiteListCards: (cards) => filterWhiteListCards(cards),

    createArrayOfCardNumbers: (cards) => createArrayOfCardNumbers(cards),

    indexOfFondTokensWithTokenType: (tokens, tokenType) => indexOfFondTokensWithTokenType(tokens, tokenType),

    setOrCreateTagsWithIndexTokenAndTags: (network, indexToken, tags, tokenType) => setOrCreateTagsWithIndexTokenAndTags(network, indexToken, tags, tokenType),

    createBodyToSendToOCPIMobiE: (countryCode, partyId, tags, contract) => createBodyToSendToOCPIMobiE(countryCode, partyId, tags, contract),

    createBodyToSendToOCPIGireve: (countryCode, partyId, tag, contract) => createBodyToSendToOCPIGireve(countryCode, partyId, tag, contract),

    getCard: (cardNumber) => getCard(cardNumber),

    updateCardACP: (cardNumber) => updateCardACP(cardNumber)

}

function verifyCards(card) {

    if (!card.fileName || !card.cardNumber || !card.idTagDec || !card.idTagHexa || !card.idTagHexaInv) {
        return false;
    }

    return true;
}

async function createCard(card) {

    let newCard = new Cards();

    newCard.fileName = card.fileName
    newCard.cardNumber = card.cardNumber

    newCard.tags = {
        idTagDec: card.idTagDec,
        idTagHexa: card.idTagHexa,
        idTagHexaInv: card.idTagHexaInv
    }

    newCard.status = process.env.TOPROCESSCARDSTATUSTOPROCESS;
    newCard.emailSent = false
    newCard.tries = {
        numberOfTries: 0
    }

    await newCard.save();

    return newCard
}

async function findCardsContracts(cards) {

    let cardsNumbers = createArrayOfCardNumbers(cards)

    let query = {
        cardNumber: cardsNumbers
    }

    return await findContract(query)
}

async function checkCardsWithNoContracts(cards, contracts) {

    let ContractcardNumbers = createArrayOfCardNumbers(contracts)

    let cardsWithContract = []

    cards.forEach(card => {
        if (card.cardNumber) {
            let index = ContractcardNumbers.indexOf(card.cardNumber)

            if (index == -1) {

                let query = {
                    _id: card._id
                }
                let update = {
                    $set: {
                        status: process.env.TOPROCESSCARDSTATUSNOCONTRACT
                    }
                }

                updateCard(query, update)

            }
            else {
                if (!card.userId) {

                    let query = {
                        _id: card._id
                    }
                    let update = {
                        $set: {
                            userId: contracts[index].userId
                        }
                    }

                    updateCard(query, update)
                }
                cardsWithContract.push(card)
            }

        }

    });

    return cardsWithContract
}

async function checkCardsWithDuplicateTags(cards) {

    let query = createQueryWithCardsNumbersAndTags(cards)

    let project = {
        "networks.tokens.idTagDec": 1,
        _id: 0
    }

    let contracts = await findContractWithProject(query, project)

    let tagsArray = []

    contracts.forEach(contract => {
        contract.networks.forEach(tags => {
            tags.tokens.forEach(tag => {
                tagsArray.push(tag.idTagDec)
            })
        });
    });

    let cardsWithoutDuplicateTags = []

    cards.forEach(card => {
        if (card.tags)
            if (card.tags.idTagDec) {
                const index = tagsArray.indexOf(card.tags.idTagDec)
                const duplicatedTagCard = cards.find(c => c.cardNumber !== card.cardNumber && c.tags.idTagDec === card.tags.idTagDec)

                if (index != -1 || duplicatedTagCard) {

                    let query = {
                        _id: card._id
                    }
                    let update = {
                        $set: {
                            status: process.env.TOPROCESSCARDSTATUSDUPLICATETAGS
                        }
                    }

                    updateCard(query, update)

                }
                else {
                    cardsWithoutDuplicateTags.push(card)
                }

            }

    });

    return cardsWithoutDuplicateTags
}

async function activateNetWorks(cards, contracts) {
    const context = 'activateNetWorks';

    let errorCode = 0
    try {


        let ContractcardNumbers = createArrayOfCardNumbers(contracts)

        errorCode++;

        let bodysToSendToOCPI = []

        for (let i = 0; i != cards.length; i++) {

            let card = cards[i];

            if (card.cardNumber) {

                let index = await ContractcardNumbers.indexOf(card.cardNumber)

                let bodys = await processNetWorks(contracts[index], card)

                bodysToSendToOCPI.push(bodys)
            }

        }

        errorCode++;

        console.log(`[${context}] before sendToOCPI `, bodysToSendToOCPI);
        let result = await sendToOCPI(bodysToSendToOCPI)
        console.log(`[${context}] after sendToOCPI `, result);

        errorCode++;

        await atachRefIdToMobiETokensAndSetCardsStatus(result, errorCode)

        errorCode++;

        console.log(`[${context}] Job Cards Successfully finished `, { errorCode });

        return result
    }
    catch (err) {
        Sentry.captureException(err);
        console.log(err);
        console.log(`[${context}] Error `, { ...err, errorCode });
        setCardsToFialed(cards, errorCode);
        return {}
    }
}


async function processNetWorks(contract, card) {

    let countryCode = "PT"
    let partyId = "EVI"

    let informationNeededToOCPI = {
        userId: contract.userId,
        contractId: contract._id,
        cardId: card._id,
        bodyToSendToOCPI: []
    }

    //console.log("contract.networks")
    //console.log(contract.networks)

    if (contract.networks) {
        for (let i = 0; i != contract.networks.length; i++) {
            //contract.networks.forEach(async network => {
            let network = contract.networks[i];

            //console.log("ANTES network")
            //console.log(network.tokens)

            let indexTokenRFID = await indexOfFondTokensWithTokenType(network.tokens, process.env.TokensTypeRFID)

            await setOrCreateTagsWithIndexTokenAndTags(network, indexTokenRFID, card.tags, process.env.TokensTypeRFID)

            //console.log("DEPOIS network")
            //console.log(network.tokens)


            if (process.env.NetworksEVIO.includes(network.network)) {
                //console.log("0")
            } else if (network.network === process.env.NetworkMobiE) {

                //console.log("1")

                let indexTokenAppUser = await indexOfFondTokensWithTokenType(network.tokens, process.env.TokensTypeApp_User)

                if (indexTokenAppUser != -1)
                    if (network.tokens[indexTokenAppUser].status == process.env.NetworkStatusActive) {

                        let bodyToSendToOCPIMobiE = await createBodyToSendToOCPIMobiE(countryCode, partyId, card.tags, contract)

                        await informationNeededToOCPI.bodyToSendToOCPI.push(bodyToSendToOCPIMobiE)
                    }

            } else {

                //console.log("2")

                let indexTokensTypeOTHER = await indexOfFondTokensWithTokenType(network.tokens, process.env.TokensTypeOTHER)

                if (indexTokensTypeOTHER != -1)
                    if (network.tokens[indexTokensTypeOTHER].status == process.env.NetworkStatusActive) {

                        let bodyToSendToOCPIGireve = await createBodyToSendToOCPIGireve(countryCode, partyId, card.tags.idTagHexa, contract)

                        await informationNeededToOCPI.bodyToSendToOCPI.push(bodyToSendToOCPIGireve)
                    }

            }

            //});
        }
    }

    let query = {
        _id: contract._id
    }

    let updateQuery = {
        $set: {
            networks: contract.networks
        }
    }

    let result = await updateContract(query, updateQuery)

    //console.log("informationNeededToOCPI.bodyToSendToOCPI")
    //console.log(informationNeededToOCPI.bodyToSendToOCPI)

    //console.log("result")
    //console.log(result)

    return informationNeededToOCPI
}

async function sendToOCPI(bodysToSendToOCPI) {

    let host = process.env.HostMobie + process.env.PathSendMultipleTokens

    let body = { cardsBodys: bodysToSendToOCPI }

    let response = {}

    let config = {
        apikey: process.env.ocpiApiKey
    }

    //console.log("host")

    //console.log(host)

    try {
        response = await axiosS.axiosPutBodyAndHeader(host, body, config)
        console.log('OCPI tokens finished');
    }
    catch (err) {
        console.log('OCPI tokens failed - ', err);
        Sentry.captureException(err);
        response = {};
    }
    return await response;
}
async function sendCardRequestEmail(contract) {

    console.log(`sendEmailClientCard - contract.Id: ${contract._id} - email: ${contract.email} - clientName: ${contract.clientName}`);

    const user = await User.findOne({ _id: contract.userId }, { _id: 1, name: 1, clientType: 1 });

    const mailOptions = {
        to: contract.email,
        subject: `EVIO - Solicitação do Cartão`,
        message: {
            "username": user.name,
        },
        type: user.clientType === "b2c" ? "sendCardB2C" : "sendCardB2B"
    };

    sendEmailClient(mailOptions, contract.clientName)
}

async function atachRefIdToMobiETokensAndSetCardsStatus(OCPIResponse, errorCode) {
    const context = 'atachRefIdToMobiETokensAndSetCardsStatus';

    console.log('atachRefIdToMobiETokensAndSetCardsStatus point 1');

    for (let i = 0; i != OCPIResponse.length; i++) {
        try {

            const hasErrorResponse = OCPIResponse[i].result.some(({ code }) => code !== process.env.OCPIRESPONSESUCESS);
            console.log('atachRefIdToMobiETokensAndSetCardsStatus point 2', hasErrorResponse, { _id: OCPIResponse[i].contractId });

            if (hasErrorResponse) {
                console.log(`[${context}]  OCPIResponse Result`, { OCPIResponseCode: OCPIResponse[i]?.result });
                await setCardStatus(OCPIResponse[i].cardId, false, errorCode, OCPIResponse[i]?.result);
                continue;
            }

            const contractId = mongoose.Types.ObjectId(OCPIResponse[i].contractId);
            const contractIdQuery = { _id: contractId };

            const contracts = await findContract(contractIdQuery);
            console.log('atachRefIdToMobiETokensAndSetCardsStatus point 3.1b', contractIdQuery, contracts, typeof contractId);
            const [contract] = contracts;
            console.log('atachRefIdToMobiETokensAndSetCardsStatus point 3.2b', contractIdQuery, contracts, contract, typeof contractId);

            let { networks } = contract;

            for (const result of OCPIResponse[i].result) {
                networks = setRefId(networks, result.platformCode, result.refId);
                console.log('atachRefIdToMobiETokensAndSetCardsStatus point 4', result.platformCode);
            }

            const updateQuery = {
                $set: {
                    cardPhysicalStateInfo: process.env.CARDPHYSICALSTATEINFOASSOCIATED,
                    processedThirdPartyDate: new Date(),
                    networks: networks
                }
            };

            console.log('atachRefIdToMobiETokensAndSetCardsStatus point 5', updateQuery);

            await updateContract(contractIdQuery, updateQuery);
            console.log('atachRefIdToMobiETokensAndSetCardsStatus point 6 UPDATED');
            await setCardStatus(OCPIResponse[i].cardId, true, errorCode, OCPIResponse[i].result);

            console.log('atachRefIdToMobiETokensAndSetCardsStatus point 7 setCardStatus');
            if (process.env.NODE_ENV === 'production') {
                await sendCardRequestEmail(contract);
            }

            console.log(`[${context}] Contract ${OCPIResponse[i].contractId} successfully updated`, { contractId: OCPIResponse[i]?.contractId, cardId: OCPIResponse[i]?.cardId });
        } catch (err) {
            console.error(err);
            Sentry.captureException(err);
            console.log(`[${context}] Error `, { ...err, errorCode });
        }
    }

        return;
}

function setRefId(networks, network, refId) {

    const indexnetwork = networks.findIndex(({network: currentNetwork})=> currentNetwork === network)

    if (indexnetwork == -1)
        return networks

    let indexToken = indexOfFondTokensWithTokenType(networks[indexnetwork].tokens, process.env.TokensTypeRFID)

    if (indexToken == -1)
        return networks

    networks[indexnetwork].tokens[indexToken].refId = refId

    return networks
}

async function setCardStatus(cardId, successProsseed, errorCode, ocpiLogs) {

    let query = {
        _id: cardId
    }

    let updateQuery = {
        $set: {
            status: process.env.TOPROCESSCARDSTATUSSENDOFFLINETAGS
        }
    }

    if (!successProsseed)
        updateQuery = {
            $set: {
                status: process.env.TOPROCESSCARDSTATUSFAILPROCESS,
                "tries.failReason": errorCode,
                "tries.timeTried": moment(),
                "tries.ocpiLogs": ocpiLogs
            },
            $inc: {
                "tries.numberOfTries": 1
            }
        }


    //console.log("query")
    //console.log(query)


    //console.log("updateQuery")
    //console.log(updateQuery)

    let result = await updateCard(query, updateQuery)

    return result
}

function indexOfFondTokensWithTokenType(tokens, tokenType) {
    for (let i = 0; i != tokens.length; i++) {
        if (tokens[i].tokenType == tokenType)
            return i;
    }

    return -1
}

function setOrCreateTagsWithIndexTokenAndTags(network, indexToken, tags, tokenType) {
    if (indexToken == -1) {
        if (network.tokens)
            if (network.tokens.length > 0) {
                let token = {
                    wasAssociated: false,
                    tokenType: tokenType,
                    status: network.tokens[0].status,
                    idTagDec: tags.idTagDec,
                    idTagHexa: tags.idTagHexa,
                    idTagHexaInv: tags.idTagHexaInv
                };

                network.tokens.push(token);
            }
    }
    else {

        network.tokens[indexToken].idTagDec = tags.idTagDec;
        network.tokens[indexToken].idTagHexa = tags.idTagHexa;
        network.tokens[indexToken].idTagHexaInv = tags.idTagHexaInv;

    }

    return;
}

function createBodyToSendToOCPIMobiE(countryCode, partyId, tags, contract) {
    let bodyToSendToOCPIMobiE =
    {
        "platformCode": process.env.PLATFORMCODEMOBIE,
        "OCPIVersion": process.env.OCPI22,
        "country_code": countryCode,
        "party_id": partyId,
        "uid": tags.idTagDec,
        "type": process.env.TokensTypeRFID,
        "contract_id": contract.contract_id,
        "issuer": "EVIO - Electrical Mobility",
        "valid": false,
        "last_updated": "",
        "source": "",
        "evId": (contract.contractType === 'fleet') ? contract.evId : '-1',
        "whitelist": "ALWAYS",
        "energy_contract": {
            "supplier_name": process.env.EnergyContractSupplierName,
            "contract_id": (process.env.NODE_ENV === 'production') ? process.env.ProdEnergyContractDiaBi : process.env.PreProdEnergyContractDiaBi
        }
    }

    return bodyToSendToOCPIMobiE;
}

async function createBodyToSendToOCPIGireve(countryCode, partyId, tag, contract) {

    let random8Int = await getRandomInt(10000000, 99999999)

    //TODO this function has the memory leak
    let checkDigit = await checkDigitMobility(countryCode + partyId + "C" + random8Int, checkDigitLists)

    let bodyToSendToOCPIGireve =
    {
        "platformCode": process.env.PLATFORMCODEGIREVE,
        "OCPIVersion": process.env.OCPI211,
        "uid": tag,
        "type": process.env.TokensTypeRFID,
        "contract_id": `${countryCode}-${partyId}-C${random8Int}-${checkDigit}`,
        "issuer": "EVIO - Electrical Mobility",
        "valid": false,
        "last_updated": "",
        "source": "",
        "whitelist": "NEVER",
        "evId": contract.contractType === 'fleet' ? contract.evId : '-1',
    }

    return bodyToSendToOCPIGireve
}

async function setCardsToFialed(cards, errorCode) {

    for (let i = 0; i != cards.length; i++) {
        setCardStatus(cards[i]._id, false, errorCode, [])
    }

}

async function aggregateCards(agregation) {

    return await Cards.aggregate(agregation);

}

async function findCards(query) {

    return await Cards.find(query);

}

async function findCardsLimited(query) {

    return await Cards.find(query).limit(parseInt(process.env.MAXIMUMCARDNUMBERSTOPROCESS));

}

async function updateCard(query, updateQuery) {

    return await Cards.update(query, updateQuery);

}

async function updateContract(query, updateQuery) {

    return await Contracts.update(query, updateQuery);

}

async function findContract(query) {
    const contractsFound = await Contracts.find(query);
    console.log('final log', query, contractsFound);
    return contractsFound;
}

async function findContractWithProject(query, project) {

    return await Contracts.find(query, project);

}

async function findGroupCSUsers(query) {

    return await GroupCSUsers.find(query);

}

function createArrayOfCardNumbers(cards) {
    let cardNumbers = []

    cards.forEach(card => {
        if (card.cardNumber)
            cardNumbers.push(card.cardNumber)
    });

    return cardNumbers
}

function createQueryWithCardsNumbersAndTags(cards) {
    let cardNumbers = []
    let tagsDec = []

    cards.forEach(card => {
        if (card.cardNumber)
            cardNumbers.push(card.cardNumber)
        if (card.tags.idTagDec)
            tagsDec.push(card.tags.idTagDec)
    });

    let query = {
        cardNumber: { $nin: cardNumbers },
        "networks.tokens.idTagDec": tagsDec
    }

    return query
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};

async function sendEmail() {

    let agregation = [{
        "$match": {
            "emailSent": false
        }
    },
    {
        "$group": {
            "_id": "$fileName",
            "status": { $push: "$status" },
            "cards": { $push: "$$ROOT" }
        }
    },
    {
        "$project": {
            "fileName": "$_id",
            "status": "$status",
            "cards": "$cards"
        },
    }
    ];

    let files = await aggregateCards(agregation)

    //console.log("filesToSend")
    //console.log(files)

    let filesToSend = findFilesToSend(files)

    if (filesToSend.length > 0) {
        await sendFiles(filesToSend)

        await setEmailsToSent(filesToSend)
    }

    return filesToSend
}

function findFilesToSend(files) {
    let filesToSend = []

    files.forEach(file => {

        let indexFileFailed = file.status.indexOf(process.env.TOPROCESSCARDSTATUSFAILPROCESS)

        let indexToProcess = file.status.indexOf(process.env.TOPROCESSCARDSTATUSTOPROCESS)

        if (indexToProcess == -1) {

            if (indexFileFailed == -1) {

                filesToSend.push(file)

            }
            else {

                let sendFile = true

                for (let i = 0; i != file.cards.length; i++) {
                    if (file.cards[i].status == process.env.TOPROCESSCARDSTATUSFAILPROCESS) {
                        if (file.cards[i].tries.numberOfTries < process.env.MINIMUMFAILEDNUMBERTOPROCESSCARD)
                            sendFile = false
                    }
                }

                if (sendFile)
                    filesToSend.push(file)

            }
        }
    });

    return filesToSend
}

async function sendFiles(files) {

    //PUT INFO IN  EXCEL
    let workbook = new Excel.Workbook();

    let sheet = workbook.addWorksheet('Cards');

    let statusNumbers = buildStatusNumbers();

    parseExcelFiles(sheet, files, statusNumbers);

    statusNumbers.originalContractCardNumber = await findContractWithProject({ cardNumber: { $nin: statusNumbers.cardNumberDuplicatedTags }, "networks.tokens.idTagDec": { $in: statusNumbers.tagsDuplicated } }, { cardNumber: 1 , userId: 1, _id: 0});

    let buffer = await workbook.xlsx.writeBuffer();

    //SEND INFO
    let fileName = "sibs";

    const subject = "SIBS Tag Processing Report - " + moment().format("YYYY-MM-DD");

    const body = `Numero de cartões processados com sucesso: ${statusNumbers.successProcessed}\n` +
        `Numero de cartões sem contrato encontrado (sem efeito para cartões ACP): ${statusNumbers.failedNoContract}\n` +
        `Numero de cartões com tag duplicada: ${statusNumbers.failedTagsDuplicated}\n` +
        `Numero de cartões falhados por outra razão: ${statusNumbers.failed}\n` +
        `Contratos com tags duplicadas pedidos: ${JSON.stringify(statusNumbers.cardNumberDuplicatedTagsAndUserId)}\n` +
        `Contratos com tags duplicadas existentes no sistema: ${statusNumbers.originalContractCardNumber}\n` +
        `Tags de cartões duplicados: ${statusNumbers.tagsDuplicated}\n`;

    for (let i = 0; i != files.length; i++) {
        fileName = fileName + "_" + files[i].fileName;
    }

    fileName = fileName + '.xlsx';

    let cc = [];

    if (process.env.NODE_ENV === 'production') {
        cc.push(process.env.EMAIL_TEST)
        nodemailerS.sendEmailFromSupport(process.env.EMAIL_USER, [buffer], [fileName], subject, body, cc);
    }
    else {
        nodemailerS.sendEmailFromSupport(process.env.EMAIL_TEST, [buffer], [fileName], "[PRE] " + subject, body, []);
    }

}

function parseExcelFiles(sheet, files, statusNumbers) {

    sheet.addRow(["Número do cartão", "Tag decimal", "Estado"]);

    for (let i = 0; i != files.length; i++) {
        for (let j = 0; j != files[i].cards.length; j++) {
            let status;

            switch (files[i].cards[j].status) {
                case process.env.TOPROCESSCARDSTATUSNOCONTRACT:
                    status = "FAILED, no contract associated";
                    statusNumbers.failedNoContract++;
                    break;
                case process.env.TOPROCESSCARDSTATUSDUPLICATETAGS:
                    status = "FAILED, tags duplicated";
                    statusNumbers.failedTagsDuplicated++;
                    statusNumbers.cardNumberDuplicatedTags.push(files[i].cards[j].cardNumber);
                    statusNumbers.cardNumberDuplicatedTagsAndUserId.push({cardNumber: files[i].cards[j].cardNumber, userId: files[i].cards[j].userId});
                    statusNumbers.tagsDuplicated.push(files[i].cards[j].tags.idTagDec);
                    break;
                case process.env.TOPROCESSCARDSTATUSFAILPROCESS:
                    status = "FAILED";
                    statusNumbers.failed++;
                    break;
                case process.env.TOPROCESSCARDSTATUSSENDOFFLINETAGS:
                case process.env.TOPROCESSCARDSTATUSACTIVATED:
                    status = "PROCESSED SUCCESSFULLY";
                    statusNumbers.successProcessed++;
                    break;
                default:
                    status = "UNDEFINED";
            }

            sheet.addRow([files[i].cards[j].cardNumber, files[i].cards[j].tags.idTagDec, status]);
        }
    }
}

function setEmailsToSent(files) {

    let cardsId = []

    let updateQuery = {
        $set: {
            emailSent: true
        }
    }

    for (let i = 0; i != files.length; i++) {
        for (let j = 0; j != files[i].cards.length; j++) {
            updateCard({ _id: files[i].cards[j]._id }, updateQuery)
        }
    }

}

function filterWhiteListCards(cards) {

    return cards;

    //TODO uncomment this funtions when restriction is establiched

    let whiteListCards = []

    for (let i = 0; i != cards.length; i++) {
        //TODO chagen true to some retriction
        if (true)
            whiteListCards.push(cards[i])
        else
            setCardStatusActive(cards[i])
    }

    return whiteListCards
}

async function getChargers(card) {

    let findResult = await findContract({ cardNumber: card.cardNumber })

    let contract = findResult[0]

    //console.log("contract")
    //console.log(contract)

    let host = process.env.HostCharger + process.env.PathGetAllChargersToWhiteList

    let params = {
        userid: contract.userId,
        accessType: process.env.ChargerAccessPublic,
    }

    if (contract.contractType === process.env.ContractTypeUser) {
        let groupIds = []

        let query = {
            "listOfUsers.userId": contract.userId
        };

        let groupsCsUsers = await findGroupCSUsers(query);

        for (let group of groupsCsUsers) {
            groupIds.push(group._id.toString())
        }

        if (groupIds.length > 0)
            params.groupIds = groupIds

    } else if (contract.contractType === process.env.ContractTypeFleet) {
        params.fleetId = contract.fleetId
    }

    let chargers = await axiosS.axiosPostBody(host, params)

    return chargers;

}



async function getAuthorizationList(charger) {

    if (!charger)
        return [];

    if (!charger.hwId || !charger.accessType || !charger.createUser || !charger.listOfGroups || !charger.listOfFleets || !charger.status || !charger.chargerType)
        return [];

    let { hwId, accessType, createUser, listOfGroups, listOfFleets, status, chargerType } = charger
    let authorizationList = []

    if (status !== process.env.ChargePointStatusEVIOFaulted && chargerType === process.env.OCPPJ16Type) {

        //console.log(`Offline Whitelist update on charger ${hwId}`)
        if (accessType === process.env.ChargerAccessPrivate) {

            let query = {
                userId: createUser
            }
            let allContracts = await findContract(query)

            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            authorizationList.push(...idTags)

        } else if (accessType === process.env.ChargerAccessRestrict) {
            //Groups of users
            let usersIdTags = await getUsersGroupIdtags(listOfGroups)
            //Groups of fleet
            let fleetsIdTags = await getFleetsGroupIdtags(listOfFleets)

            authorizationList.push(...usersIdTags, ...fleetsIdTags)


        } else if (accessType === process.env.ChargerAccessPublic || accessType === process.env.ChargerAccessFreeCharge) {
            let allContracts = await findContract({})
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            authorizationList.push(...idTags)
        }

        authorizationList = removeRepeatedIdTags(authorizationList)
        return authorizationList
    }

    return authorizationList
}

function removeRepeatedIdTags(authorizationArray) {
    /**
        If eventually there're repeated idTags, we can't send them, else the charger will return an error
        when updating local authorization list
    */
    return authorizationArray.filter((obj, index, self) =>
        index === self.findIndex((t) => (
            t.idTag === obj.idTag
        ))
    )
}

function getSpecificToken(contract, networkEnum, tokenType) {
    return contract.networks.find(network => network.network === networkEnum).tokens.find(token => token.tokenType === tokenType)
}

function retrieveIdTagsFromToken(token, status) {
    const context = "Function retrieveIdTagsFromToken";
    try {
        const idTagInfoStatus = {
            "active": "Accepted",
            "inactive": "Blocked",
            "toRequest": "Blocked",
        }
        if (token.status === status) {
            if (token.tokenType === process.env.AuthTypeRFID) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                if (token.idTagHexa) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexa, idTagInfoStatus[status]))
                }
                if (token.idTagHexaInv) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexaInv, idTagInfoStatus[status]))
                }
                return returnTokens
            } else if (token.tokenType === process.env.AuthTypeApp_User) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                return returnTokens
            }
        } else {
            return []
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }

}

function formatIdTagToWhitelist(idTag, status) {
    return {
        idTag: idTag,
        idTagInfo: {
            status: status
        }
    }
}

async function getFleetsGroupIdtags(listOfFleets) {
    const context = "Function getFleetsGroupIdtags";
    try {
        let idTagsArray = []
        for (let fleet of listOfFleets) {
            let contractsQuery = {
                fleetId: fleet.fleetId,
                contractType: process.env.ContractTypeFleet
            }
            let allContracts = await findContract(contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getUsersGroupIdtags(listOfGroups) {
    const context = "Function getUsersGroupIdtags";
    try {
        let listOfUsers = await getListOfUsersArray(listOfGroups)
        let idTags = await getListOfUsersIdTags(listOfUsers)
        return idTags
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getListOfUsersArray(listOfGroups) {
    const context = "Function getListOfUsersArray";
    try {
        let listOfUsers = []
        for (let group of listOfGroups) {
            let groupQuery = {
                _id: group.groupId
            }
            let usersGroup = await findGroupCSUsers(groupQuery)
            if (usersGroup[0]) {
                listOfUsers.push(...usersGroup[0].listOfUsers)
            }
        }
        return listOfUsers
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getListOfUsersIdTags(listOfUsers) {
    const context = "Function getListOfUsersIdTags";
    try {
        let idTagsArray = []
        for (let user of listOfUsers) {
            let contractsQuery = {
                userId: user.userId,
                contractType: process.env.ContractTypeUser
            }
            let allContracts = await findContract(contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function getIdTags(allContracts, networkEnum, tokenType, tokenStatus) {
    const context = "Function getIdTags";
    try {
        let idTags = []
        for (let contract of allContracts) {
            let token = getSpecificToken(contract, networkEnum, tokenType)
            let idTagsArray = token ? retrieveIdTagsFromToken(token, tokenStatus) : []
            idTags.push(...idTagsArray)
        }
        return idTags
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function sendTagToChargers(charger, authorizationList) {
    try {
        let host = process.env.HostCharger + process.env.PathGetPriorityIdTags
        let chargerHwid = charger.hwId;
        let data = {
            authorizationList,
            chargerHwid
        }
        let resp = await axiosS.axiosGet(host, { data })
        if (resp) {
            return true
        } else {
            return false
        }
    }
    catch (err) {
        console.log(err)
        return false
    }
}

function setCardStatusActive(card) {

    let query = {
        _id: card._id
    }

    let updateQuery = {
        $set: {
            status: process.env.TOPROCESSCARDSTATUSACTIVATED
        }
    }

    updateCard(query, updateQuery)

}

function sendEmailClient(mailOptions, clientName) {
    var context = "Function sendEmailClient";

    let headers = {
        clientname: clientName ? clientName : "EVIO"
    }

    axios.post(sendEmailRequest, { mailOptions }, { headers })
        .then((response) => {
            if (response)
                console.log(`[${context}] Email sent`);
            else
                console.log(`[${context}] Email not sent`);
        })
        .catch((error) => {
            console.log(`[${context}] Error `, error.message);
        });

};

function getCard(cardNumber) {
    const context = "Funciton getCard";
    return new Promise(async (resolve, reject) => {
        try {

            let query = {
                cardNumber: cardNumber,
                $and: [
                    { status: { $ne: process.env.TOPROCESSCARDSTATUSSENDOFFLINETAGS } },
                    { status: { $ne: process.env.TOPROCESSCARDSTATUSACTIVATED } }
                ]
            }

            let cardFound = await Cards.findOne(query);
            if (cardFound)
                resolve(cardFound);
            else
                reject({ auth: false, code: 'server_card_already_use', message: 'Card already in use in another contract' });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });

}

function updateCardACP(cardNumber) {
    const context = "Funciton updateCardACP";
    return new Promise(async (resolve, reject) => {
        try {

            let cardFound = await Cards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { status: process.env.TOPROCESSCARDSTATUSSENDOFFLINETAGS } }, { new: true });
            resolve(cardFound);

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });

}

function buildStatusNumbers() {
    return {
        successProcessed: 0,
        failedNoContract: 0,
        failedTagsDuplicated: 0,
        cardNumberDuplicatedTags: [],
        cardNumberDuplicatedTagsAndUserId: [],
        originalContractCardNumber: [],
        tagsDuplicated: [],
        failed: 0,
    }
}