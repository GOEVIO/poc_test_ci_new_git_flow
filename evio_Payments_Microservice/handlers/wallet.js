const Wallet = require('../models/wallet');

module.exports = {
    getWallet: function (userId) {
        const context = "Function getWallet";
        return new Promise(async (resolve, reject) => {
            try {

                let wallet = await Wallet.findOne({ userId: userId });

                resolve(wallet);

            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    },
    removeBalanceFromWallet: function (transaction) {
        const context = "Function removeBalanceFromWallet";
        return new Promise(async (resolve, reject) => {
            try {

                let wallet = await  Wallet.findOne({ userId: transaction.userId });

                if (wallet) {
        
                    let found = wallet.transactionsList.find(elem => {
                        return elem.transactionId == transaction._id
                    });
        
                    if (found) {
        
                        if (wallet.amount.value - transaction.amount.value >= 0) {
        
                            var query = {
        
                                userId: transaction.userId,
                                "transactionsList.transactionId": transaction._id
        
                            };
        
                            var newTransaction = {
        
                                $set: {
                                    "transactionsList.$.status": transaction.status,
                                    "transactionsList.$.transactionType": transaction.transactionType
                                },
                                $inc: {
                                    "amount.value": -transaction.amount.value
        
                                }
                            };
        
                            Wallet.updateOne(query, newTransaction, (err, result) => {
                                if (err) {
        
                                    console.error(`[${context}][updateOne] Error `, err.message);
                                    reject(err);
        
                                }
                                else {
        
                                    resolve(true);
        
                                };
                            });
        
                        }
                        else {
                            var query = {
        
                                userId: transaction.userId,
                                "transactionsList.transactionId": transaction._id
        
                            };
        
                            var newTransaction = {
        
                                $set: {
                                    "transactionsList.$.status": process.env.TransactionStatusFaild,
                                    "transactionsList.$.transactionType": transaction.transactionType
                                }
                            };
        
                            Wallet.updateOne(query, newTransaction, (err, result) => {
                                if (err) {
        
                                    console.error(`[${context}][updateOne] Error `, err.message);
                                    reject(err);
        
                                }
                                else {
        
                                    resolve(false);
        
                                };
                            });
                        };
        
                    }
                    else {
        
                        //console.log("found 1", found);
                        if (wallet.amount.value - transaction.amount.value >= 0) {
        
                            var query = {
        
                                userId: transaction.userId
        
                            };
        
                            var newTransaction = {
        
                                $push: {
                                    transactionsList: {
                                        transactionId: transaction._id,
                                        transactionType: transaction.transactionType,
                                        status: transaction.status
                                    }
        
                                },
                                $inc: {
                                    "amount.value": -transaction.amount.value
        
                                }
                            };
        
                            Wallet.addTansationsList(query, newTransaction, (err, result) => {
                                if (err) {
        
                                    console.error(`[${context}][updateOne] Error `, err.message);
                                    reject(err);
        
                                }
                                else {
        
                                    resolve(true);
        
                                };
                            })
        
                        }
                        else {
        
                            var query = {
        
                                userId: transaction.userId
        
                            };
        
                            var newTransaction = {
        
                                $push: {
                                    transactionsList: {
                                        transactionId: transaction._id,
                                        transactionType: transaction.transactionType,
                                        status: process.env.TransactionStatusFaild,
                                    }
        
                                }
                            };
        
                            Wallet.addTansationsList(query, newTransaction, (err, result) => {
                                if (err) {
        
                                    console.error(`[${context}][updateOne] Error `, err.message);
                                    reject(err);
        
                                }
                                else {
        
                                    resolve(false);
        
                                };
                            })
                        };
                    };
        
                }
                else {
        
                    console.error(`[${context}][walletFindOne] Wallet not found `);
                    reject('Wallet not found');
        
                };

            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    },
    addTransactionToWallet: function(transaction) {
        var context = "Function addTransactionToWallet";
        return new Promise((resolve, reject) => {
            var query = {
                userId: transaction.userId
            };
    
            var newTransaction = {
                $push: {
                    transactionsList: {
                        transactionId: transaction._id,
                        transactionType: transaction.transactionType,
                        status: transaction.status
                    }
                }
            };
    
            Wallet.addTansationsList(query, newTransaction, (err, result) => {
                if (err) {
    
                    console.error(`[${context}][addTansationsList] Error `, err.message);
                    reject(err);
    
                }
                else {
    
                    if (result) {
    
                        resolve(true);
    
                    }
                    else {
    
                        reject({message : "No wallet was found"});
    
                    };
    
                };
            });
    
        });
    },
    updateTransactionToWallet: function (transaction) {
        const context = "Function updateTransactionToWallet"
        try {
            const query = {
        
                userId: transaction.userId,
                "transactionsList.transactionId": transaction._id
        
            };
        
            const newTransaction = {
        
                $set: {
                    "transactionsList.$.status": transaction.status,
                    "transactionsList.$.transactionType": transaction.transactionType
                }
            };
        
        
            Wallet.updateOne(query, newTransaction, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateOne] Error `, err.message);
                    //reject(err);
                }
                else {
                    console.log(`[${context}][updateOne]  Updated`);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    
    }
}