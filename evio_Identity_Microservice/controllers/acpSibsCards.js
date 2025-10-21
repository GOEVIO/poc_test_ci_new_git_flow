const ACPSibsCards = require('../models/acpSibsCards');
const { logger } = require('../utils/constants');

module.exports = {
    addSibsCards: (req) => {
        const context = "Funciton addSibsCards";
        return new Promise((resolve, reject) => {
            try {

                if (!Array.isArray(req.body)) {

                    reject({ auth: false, code: 'server_must_array', message: "The attribute must be an array" })

                };

                if (req.body.length === 0) {

                    reject({ auth: false, code: 'server_list_empty', message: "List of cards can't be empty" })

                };

                let listCards = req.body;

                Promise.all(listCards.map((card, index) => {
                    return new Promise(async resolve => {

                        let newCard = new ACPSibsCards(card);
                        let cardFound = await ACPSibsCards.findOne({ cardNumber: newCard.cardNumber });

                        if (cardFound) {

                            let cardUpdated = await ACPSibsCards.findOneAndUpdate({ _id: cardFound._id }, { $set: card }, { new: true });
                            resolve(cardUpdated)

                        } else {

                            ACPSibsCards.createACPSibsCards(newCard, (err, result) => {
                                if (err) {
                                    console.log(`[${context}] Error `, err.message);
                                    reject(err);
                                }
                                resolve(result)
                            });

                        };

                    })

                })
                ).then((values) => {
                    resolve(values)
                })

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getSibsCards: () => {
        const context = "Funciton getSibsCards";
        return new Promise(async (resolve, reject) => {
            try {

                let cardsFound = await ACPSibsCards.find({});
                resolve(cardsFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getSibsCardsByCardNumber: (req) => {
        const context = "Funciton getSibsCardsByCardNumber";
        return new Promise(async (resolve, reject) => {
            try {

                let cardNumber = req.params.cardNumber;
                let cardFound = await ACPSibsCards.findOne({ cardNumber: cardNumber, inUse: false });

                if (cardFound)
                    resolve(cardFound);
                else
                    resolve(null);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    updateInUse: (req) => {
        const context = "Funciton updateInUse";
        return new Promise(async (resolve, reject) => {
            try {

                let cardNumber = req.body.cardNumber;
                let cardUpdated = await ACPSibsCards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { inUse: true } }, { new: true });
                resolve(cardUpdated);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getCard: (cardNumber) => {
        const context = "Funciton getCard";
        return new Promise(async (resolve, reject) => {
            try {

                let cardFound = await ACPSibsCards.findOne({ cardNumber: cardNumber, inUse: false });
                if (cardFound)
                    resolve(cardFound);
                else
                    reject({ auth: false, code: 'server_card_already_use', message: 'Card already in use in another contract' });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    updateCard: (cardNumber) => {
        const context = "Funciton updateCard";
        return new Promise(async (resolve, reject) => {
            try {

                let cardFound = await ACPSibsCards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { inUse: true } }, { new: true });
                resolve(cardFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    }
}