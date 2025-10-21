const Transactions = require('../models/transactions');
const Wallet = require('../models/wallet');
const axios = require("axios");

module.exports = {
    createTransaction: function (data, transactionType) {
        const context = "Function createTransaction";
        return new Promise(async (resolve, reject) => {

            data = JSON.parse(JSON.stringify(data));

            let paymentId = data._id;
            delete data._id;

            let transaction = new Transactions(data);

            transaction.transactionType = transactionType;
            transaction.paymentId = paymentId
            transaction.provider = data.paymentMethod

            Transactions.createTransactions(transaction, (err, transactionCreated) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                };

                resolve(transactionCreated);

            })
        });
    },
    updateTransaction: function (transactionId, dataToUpdate) {
        const context = "Function updateTransaction";
        return new Promise(async (resolve, reject) => {
            try {
                let transactionUpdated = await Transactions.findOneAndUpdate({ _id: transactionId }, dataToUpdate, { new: true })

                resolve(transactionUpdated)
            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }

        });
    },
    processTopUps: (req) => {
        const context = "Function processTopUps";
        return new Promise(async (resolve, reject) => {
            try {

                let date = req.body.date;

                console.log("date", date);
                let query = {
                    status: process.env.TransactionStatusPaidOut,
                    transactionType: process.env.TransactionTypeCredit,
                    createdAt: { $gte: new Date(date) }
                }

                let transactionsFound = await Transactions.find(query);

                if (transactionsFound.length > 0) {
                    transactionsFound.forEach(transaction => {
                        sendEmailTopUpBilling(transaction)
                    })
                    resolve("ok")
                } else {
                    resolve("ok")
                };

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            };
        });
    },
    createTransactionEntry,
    createAndProcessVoucher: async function (req, res) {
        const context = "Function createAndProcessVoucher";
        try {

            if (!req.body.card)
                return res.status(400).send("Card is necessary");

            if (!req.body.userId)
                return res.status(400).send("UserId is necessary");

            let userId = req.body.userId
            let card = req.body.card
            let clientName = req.body.clientName
            let transaction = {}

            transaction.transactionType = process.env.TransactionTypeCredit;
            transaction.provider = process.env.TransactionProviderCreditOther;
            transaction.status = process.env.TransactionStatusInPayment;
            transaction.clientName = process.env.clientNameEVIO;

            if (clientName) {

                switch (clientName) {
                    case process.env.clientNameSC:
                        transaction.notes = process.env.VoucherNotesTransactionGoCharge;
                        break;
                    case process.env.clientNameHyundai:
                        transaction.notes = process.env.VoucherNotesTransactionHyundai;
                        break;
                    default:
                        transaction.notes = process.env.VoucherNotesTransaction;
                        break;
                }
            } else
                transaction.notes = process.env.VoucherNotesTransaction;

            transaction.amount = card.amount;
            transaction.userId = userId

            transaction = new Transactions(transaction);

            console.log("transaction")
            console.log(transaction)

            let result = await transaction.save()

            console.log("result")
            console.log(result)

            if (!result)
                return res.status(500).send("CreateTransactions failed");


            let query = {

                userId: result.userId

            };

            let newTransaction = {

                $push: {
                    transactionsList: {
                        transactionId: result._id,
                        transactionType: result.transactionType,
                        status: process.env.TransactionStatusPaidOut
                    }

                },
                $inc: {
                    "amount.value": result.amount.value

                }
            };

            console.log("query")
            console.log(query)

            console.log("newTransaction")
            console.log(newTransaction)

            let wallet = await Wallet.updateOne(query, newTransaction)

            if (!wallet)
                return res.status(500).send("AddTansationsList failed");


            let updateStatus = {
                $set: {
                    status: process.env.TransactionStatusPaidOut
                }

            };


            let transactionUpdated = await Transactions.findOneAndUpdate({ _id: result._id }, updateStatus)

            if (!transactionUpdated)
                return res.status(500).send("Transactions.FindOneAndUpdate failed");

            return res.status(200).send("Voucher added to wallet");

        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(err.message);
        }

    }

}

function sendEmailTopUpBilling(transaction) {
    let context = "Function sendEmailBilling";

    let proxyBilling = process.env.HostBilling + process.env.PathTopUpEmail;

    let headers = {
        userId: transaction.userId,
        clientName: transaction.clientName
    };

    let data = {
        headers: headers,
        payment: transaction.amount.value,
        currency: transaction.amount.currency,
        transactionId: transaction._id
    };

    axios.post(proxyBilling, data)
        .then((result) => {
            console.log(`[${context}] `, result.data.message);
        })
        .catch((error) => {
            console.error(`[${context}] Error`, error.message);
        });
};


async function createTransactionEntry(userId, transactionType, status, provider, currency, value, clientName) {
    const context = "Function createTransactionEntry";
    try {
        const newTransaction = new Transactions(
            {
                userId: userId,
                transactionType: transactionType,
                status: status,
                provider: provider,
                amount: {
                    currency: currency,
                    value: value
                },
                clientName
            }
        );
        return await createNewTransactions(newTransaction);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    };
}

function createNewTransactions(transaction) {
    var context = "Funciton createNewTransactions";
    return new Promise((resolve, reject) => {
        Transactions.createTransactions(transaction, (err, result) => {
            if (err) {

                console.error(`[${context}][createTransactions] Error `, err.message);
                reject(err);

            }
            else {

                resolve(result);

            };
        });
    });
};