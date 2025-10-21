require("dotenv-safe").load();
const Contracts = require('../models/contracts');
const Cards = require('../models/cards');
const User = require('../models/user');
const ContractsController = require('../controllers/contracts')
const axiosS = require("../services/axios");
const nodemailerS = require("../services/nodemailerService")
const Converter = require('hexadecimal-to-decimal')
const { logger } = require('../utils/constants');
const TokenStatusService = require('../services/tokenStatus.service');

module.exports = {
    create: (req, res) => creatCard(req, res),
    editCard: (req, res) => editCard(req, res),
    use: (req, res) => useCard(req, res),
    verifyCards: (card, errors) => verifyCards(card, errors),
    checkForCardWithSameTags: (tags, contractId) => checkForCardWithSameTags(tags, contractId),
    runFirstTime: () => runFirstTime(),
    sendEmailWithWarningOfRepeteadContractTagsAndGetUsers: (idTagDec, contractId, contractWithTheTags) => sendEmailWithWarningOfRepeteadContractTagsAndGetUsers(idTagDec, contractId, contractWithTheTags),
    sendEmailWithWarningOfRepeteadContractTags: (contractWithTheTags, userWithTheTags, contractThatActivatedTheCard, userThatActivatedTheCard, idTagDec) => sendEmailWithWarningOfRepeteadContractTags(contractWithTheTags, userWithTheTags, contractThatActivatedTheCard, userThatActivatedTheCard, idTagDec),
}

//========== CREATE ==========
//Function to create comission
async function creatCard(req, res) {
    var context = "function creatCard";
    try {

        if (!req.body.cards)
            return res.status(400).send({ code: 'cards_null', message: "Card is null" });

        let cards = req.body.cards

        let result = {
            'cardsSaved': 0,
            'cardsRefused': 0,
            'errors': []
        }

        for (let i = 0; i != cards.length; i++) {
            if (await verifyCards(cards[i], result.errors)) {
                let newCard = new Cards(cards[i]);
                await newCard.save()
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

//========== GET ==========

//========== PATCH ==========
//Edit comission percentage
async function editCard(req, res) {

};

async function useCard(req, res) {
    let context = "function useCard";
    try {

        const { clientname: clientName, userid: userId } = req.headers
        
        console.log("request: ", req.body)
        if (!req.body.cardNumber)
            return res.status(400).send({ code: 'cardNumber_null', message: "CardNumber is null" });

        let cardNumber = req.body.cardNumber

        if (!req.body.nif)
            return res.status(400).send({ code: 'nif_null', message: "Niff is null" });

        let nif = req.body.nif

        if (!req.body.contractId)
            return res.status(400).send({ code: "contractId_null", message: "ContractId is null" });

        let contractId = req.body.contractId

        if (!isEvioCard(cardNumber)) {
            return res.status(400).send({ code: "cardNumber_not_EVIO", message: "CardNumber is not EVIO" });
        }

        let query = {
            _id: contractId
        }

        let contractsFound = await Contracts.findOne(query)

        if (!contractsFound) return res.status(400).send({ code: "contract_not_found", message: "Contract not found" });

        query = {
            cardNumber: cardNumber
        }

        let cardsFound = await Cards.findOne(query)

        if (!cardsFound) return res.status(400).send({ code: "card_not_found", message: "Card not found" });

        if (cardsFound.inUse) return res.status(400).send({ code: "card_already_inUse", message: "Card already inUse" });

        const { tagHexa, tagDecimal, tagHexaInvert } = await convertTags(cardsFound.dec);
        const tags = {
            idTagHexa: tagHexa,
            idTagDec: tagDecimal,
            idTagHexaInv: tagHexaInvert
        }

        const hasCardWithSameTags = await checkForCardWithSameTags(tags, contractId);

        if (hasCardWithSameTags) {
            return res.status(400).send({ code: "server_card_tags_already_use", message: "Card already in use in another contract" });
        }

        let result = await ContractsController.activateNewCard(contractId, cardsFound, clientName, cardNumber, userId)

        if (!result)
            return res.status(500).send({ code: "activate_card_failed", message: "Activate card failed" });

        let update = {
            $set: {
                inUse: true,
                activationDate: new Date()
            }
        }

        let updateResult = await Cards.updateOne(query, update)

        let host = process.env.HostPayments + process.env.PathCreateAndProcessVoucher

        let body = {
            'card': cardsFound,
            'userId': contractsFound.userId
        }

        result = await axiosS.axiosPostBody(host, body);

        if (!result)
            return res.status(500).send({ code: "voucher_process_failed", message: "Voucher process failed" });

        query = {
            _id: contractId
        }

        contractsFound = await Contracts.find(query).lean()

        if (contractsFound.length == 0)
            return res.status(400).send({ code: "contract_not_found", message: "Contract not found" });
        else {
            const tokenStatusService = new TokenStatusService();
            const user = await User.findOne({ _id: contractsFound[0].userId });
            contractsFound[0].rfidUIState = user ? tokenStatusService.getRfidUIState({ contract: contractsFound[0], clientType: user.clientType, requestUserId: userId }) : tokenStatusService.getRfidUiStateDisabled();
            return res.status(200).send(contractsFound[0]);
        }
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};


async function verifyCards(card, errors) {

    console.log("card")
    console.log(card)

    if (!card.cardNumber || !card.dec || !card.decInvert || !card.amount) {
        errors.push("Card_incomplete")
        return false;
    }

    if (!card.amount.currency || !card.amount.value) {
        errors.push("Card_amount_incomplete")
        return false;
    }

    let query = {
        cardNumber: card.cardNumber
    }

    let cardsFound = await Cards.find(query)

    if (cardsFound.length != 0) {
        errors.push("Card_already_exists: " + card.cardNumber)
        return false;
    }

    let contractsFound = await Contracts.find(query)

    if (contractsFound.length != 0) {
        errors.push("Card_already_exists: " + card.cardNumber)
        return false;
    }

    return true;
}

function isEvioCard(cardNumber) {
    let initialString = cardNumber

    if (cardNumber.length > 7)
        initialString = cardNumber.slice(0, 7)

    return initialString.includes(process.env.CardEVIOString)
}

async function checkForCardWithSameTags(tags, contractId) {
    var context = "function checkForCardWithSameTags";
    try {
        let query = {
            _id: { $ne: contractId },
            $or: [
                {
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    idTagHexa: tags.idTagHexa
                                }
                            }
                        }
                    }
                },
                {
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    idTagDec: tags.idTagDec
                                }
                            }
                        }
                    }
                },
                {
                    networks: {
                        $elemMatch: {
                            tokens: {
                                $elemMatch: {
                                    idTagHexaInv: tags.idTagHexaInv
                                }
                            }
                        }
                    }
                }
            ]
        };

        let contracts = await Contracts.find(query)
        if (contracts.length > 0) {
            sendEmailWithWarningOfRepeteadContractTagsAndGetUsers(tags.idTagDec, contractId, contracts[0])
            return true;
        }

        return false;

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return true;
    };
}

async function sendEmailWithWarningOfRepeteadContractTagsAndGetUsers(idTagDec, contractId, contractWithTheTags) {
    var context = "function sendEmailWithWarningOfRepeteadContractTagsAndGetUsers";
    try {

        let userWithTheTags = await User.findOne({ _id: contractWithTheTags.userId })

        let contractThatActivatedTheCard = await ContractsContracts.findOne({ _id: contractId })

        let userThatActivatedTheCard = await User.findOne({ _id: contractThatActivatedTheCard.userId })

        sendEmailWithWarningOfRepeteadContractTags(contractWithTheTags, userWithTheTags, contractThatActivatedTheCard, userThatActivatedTheCard, idTagDec)
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return true;
    };
}

function sendEmailWithWarningOfRepeteadContractTags(contractWithTheTags, userWithTheTags, contractThatActivatedTheCard, userThatActivatedTheCard, idTagDec) {
    var context = "function sendEmailWithWarningOfRepeteadContractTags";
    try {
        let emailTo = process.env.EMAIL1

        let subject = "Ativação de um cartão com etiquetas duplicadas: " + idTagDec

        if (process.env.NODE_ENV != 'production') {
            emailTo = process.env.EMAIL4
            subject = "[PRE] Ativação de um cartão com etiquetas duplicadas: " + idTagDec
        }

        let text =
            "Houve uma tentativa de ativação de cartão com etiquetas duplicadas." +
            "\nDados do utilizador que tentou ativar o cartão:" +
            "\nNome - " + userThatActivatedTheCard.name +
            "\nEmail - " + userThatActivatedTheCard.email +
            "\nNumero de telemovel - " + userThatActivatedTheCard.internationalPrefix + userThatActivatedTheCard.mobile +
            "\nTipo de cliente - " + userThatActivatedTheCard.clientType +
            "\nClientName - " + userThatActivatedTheCard.clientName +
            "\nNumero do contrato - " + contractThatActivatedTheCard.cardNumber +
            "\nNome do contrato - " + contractThatActivatedTheCard.cardName +
            "\nData da tentativa de ativação - " + moment(new Date()).format("YYYY-MM-DDTHH:MM") +
            "\n\n" +
            "\nDados do utilizador que tem o contrato com as tags:" +
            "\nNome - " + userWithTheTags.name +
            "\nEmail - " + userWithTheTags.email +
            "\nNumero de telemovel - " + userWithTheTags.internationalPrefix + userWithTheTags.mobile +
            "\nTipo de cliente - " + userWithTheTags.clientType +
            "\nClientName - " + userWithTheTags.clientName +
            "\nNumero do contrato - " + contractWithTheTags.cardNumber +
            "\nNome do contrato - " + contractWithTheTags.cardName


        let cc = []
        cc.push(process.env.EMAIL4)

        nodemailerS.sendEmailFromSupport(emailTo, null, null, subject, text, cc)
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return;
    };
}

async function runFirstTime() {
    let context = "function runFirstTime";
    try {
        let query = {
            createdAt: {$gt: "2023-11"}
        }

        let cardsFound = await Cards.find(query)

        cardsFound.forEach(async(card) => {
            let tags = await convertTags(card.decInvert)
            
            let queryCard = {
                _id: card._id
            }

            let update = {
                $set: {
                    dec: tags.tagDecimalInvert,
                }
            }
    
            let updateResult = await Cards.updateOne(queryCard, update)

        });


       
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
};

function convertTags(tagDec) {
    const context = "Function convertTags"
    return new Promise((resolve, reject) => {
        try {

            let hexa = (BigInt(tagDec).toString(16)).toUpperCase();

            while (hexa.length < 7 * 2) {
                hexa = "0" + hexa
            };

            let hexaInvert = "";

            for (let i = hexa.length; i > 0; i -= 2) {
                const sub = String(hexa).substring(i, i - 2);
                hexaInvert += sub;
            };

            console.log("hexaInvert", hexaInvert);
            let decimalInvert = Converter.decimal(hexaInvert)

            let response = {
                tagDecimal: tagDec,
                tagDecimalInvert: decimalInvert,
                tagHexa: hexa,
                tagHexaInvert: hexaInvert

            };

            resolve(response);

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            reject(error);

        };
    });
};