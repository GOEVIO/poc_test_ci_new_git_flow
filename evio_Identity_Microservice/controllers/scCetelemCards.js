const SCCetelemCards = require('../models/scCetelemCards');
const { logger } = require('../utils/constants');

module.exports = {
    addCetelemCards: (req) => {
        const context = "Funciton addCetelemCards";
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

                        let newCard = new SCCetelemCards(card);
                        let cardFound = await SCCetelemCards.findOne({ hash: newCard.hash });

                        if (cardFound) {

                            let cardUpdated = await SCCetelemCards.findOneAndUpdate({ _id: cardFound._id }, { $set: card }, { new: true });
                            resolve(cardUpdated)

                        } else {

                            SCCetelemCards.createSCCetelemCards(newCard, (err, result) => {
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
    getCetelemCards: () => {
        const context = "Funciton getCetelemCards";
        return new Promise(async (resolve, reject) => {
            try {

                let cardFound = await SCCetelemCards.find({});
                resolve(cardFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getCetelemCardsByHash: (req) => {
        const context = "Funciton getCetelemCardsByHash";
        return new Promise(async (resolve, reject) => {
            try {

                let hash = req.params.hash;
                let cardFound = await SCCetelemCards.findOne({ hash: hash, inUse: false });

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
                //TODO
                let cardNumber = req.body.cardNumber;
                let cardUpdated = await SCCetelemCards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { inUse: true } }, { new: true });
                resolve(cardUpdated);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getCard: (hash) => {
        const context = "Funciton getCard";
        return new Promise(async (resolve, reject) => {
            try {

                //console.log("hash", hash);

                let cardFound = await SCCetelemCards.findOne({ hash: hash, inUse: false });
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
    updateCard: (hash) => {
        const context = "Funciton updateCard";
        return new Promise(async (resolve, reject) => {
            try {

                console.log("2,hash", hash)
                let cardFound = await SCCetelemCards.findOneAndUpdate({ hash: hash }, { $set: { inUse: true } }, { new: true });
                resolve(cardFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    }
}
