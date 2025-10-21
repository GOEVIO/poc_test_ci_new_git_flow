const HYSibsCards = require('../models/hySibsCards');
const axiosS = require("../services/axios");

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

                        let newCard = new HYSibsCards(card);
                        let cardFound = await HYSibsCards.findOne({ cardNumber: newCard.cardNumber });

                        if (cardFound) {

                            let cardUpdated = await HYSibsCards.findOneAndUpdate({ _id: cardFound._id }, { $set: card }, { new: true });
                            resolve(cardUpdated)

                        } else {

                            HYSibsCards.createHYSibsCards(newCard, (err, result) => {
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

                let cardsFound = await HYSibsCards.find({});
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
                let cardFound = await HYSibsCards.findOne({ cardNumber: cardNumber, inUse: false });

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
                let cardUpdated = await HYSibsCards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { inUse: true } }, { new: true });
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

                let cardFound = await HYSibsCards.findOne({ cardNumber: cardNumber, inUse: false });
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
    updateCard: (cardNumber, userId) => {
        const context = "Funciton updateCard";
        return new Promise(async (resolve, reject) => {
            try {

                let cardFound = await HYSibsCards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { inUse: true, activationDate: new Date() } }, { new: true });

                let host = process.env.HostPayments + process.env.PathCreateAndProcessVoucher;

                let body = {
                    'card': cardFound,
                    'userId': userId,
                    'clientName': process.env.NetworkHyundai
                }

                let result = await axiosS.axiosPostBody(host, body);

                if (!result)
                    reject({ code: "voucher_process_failed", message: "Voucher process failed" });


                resolve(cardFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    updateNotInUse: (cardNumber) => {
        const context = "Funciton updateNotInUse";

        return new Promise(async (resolve, reject) => {
            try {

                let cardFound = await HYSibsCards.findOneAndUpdate({ cardNumber: cardNumber }, { $set: { inUse: false } }, { new: true });
                resolve(cardFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });

    },
    getSibsCardsByMobile: (mobile) => {
        const context = "Funciton getSibsCardsByMobile";

        return new Promise(async (resolve, reject) => {
            try {

                let cardFound = await HYSibsCards.findOne({ mobile: mobile });
                resolve(cardFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    }
}