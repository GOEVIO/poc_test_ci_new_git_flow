const { StatusCodes } = require('http-status-codes');
const Wallet = require('../models/wallet');
const axios = require("axios");
const Constants = require('../utils/constants');
const sendNotificationEmail = require('../utils/notificationEmail');

const getWalletsRequiringClearance = async () => {
    const context = "Function getWalletsRequiringClearance";
    try {
        console.info(`[${context}] - Retrieving wallets requiring balance clearance`);
        const query = { isBalanceClearanceRequired: true, clearanceDate: null };
        return await Wallet.find(query);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

const clearWalletBalances = async (wallet) => {
    const context = "Function clearWalletBalances";
    console.info(`[${context}] - Starting wallet clearance process.`);

    try {
        // Store the current amount in clearedAmount
        wallet.clearedAmount = { ...wallet.amount };
        // Clear the wallet balance
        wallet.amount.value = 0;
        wallet.clearanceDate = new Date();

        await wallet.save();

        console.info(`[${context}] - Wallet ID ${wallet._id} cleared successfully.`);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

const anonymizeUserData = async (userId) => {
    const context = 'function anonymizeUserData';
    console.info(`[${context}] - Initiating user data anonymization for userId: ${userId}`);

    const headers = {
        userid: userId,
        requestUserId: userId
    };
    const url = `${Constants.services.identity.host}${Constants.services.identity.anonymizeUserData}`;

    try {
        const result = await axios.patch(url, null, { headers });
        console.log(`[${context}] [${url}] User data anonymized successfully for userId: ${userId}`);
    } catch (error) {
        console.error(`[${context}] [${url}] Error anonymizing user data for userId: ${userId}`, error.response?.data || error.message);
        throw error;
    }
};

const sendEmailWalletClearance = async (type, messageParams = {}, cc = '', clientName = 'EVIO') => {
    const context = 'function sendEmailWalletClearance';
    try {
        const emailBody = {
            mailOptions: {
                to: messageParams.destinationEmail || messageParams.userEmail,
                cc,
                message: {
                    ...messageParams
                },
                type
            }
        };
        await sendNotificationEmail(emailBody, clientName);
        console.info(`[${context}] - Email sent to: ${emailBody.to}`);
    } catch (error) {
        console.error(`[${context}] - Error sending email of type ${type}`, error.message);
        throw error;
    }
};

const enableBalanceClearance = async (userId) => {
    const context = "Service enableBalanceClearance";

    try {
        const query = { userId };
        const wallet = await Wallet.findOne(query);

        if (!wallet) {
            return {
                status: StatusCodes.NOT_FOUND,
                body: { message: 'Wallet not found for the given user' }
            };
        }

        if (wallet.isBalanceClearanceRequired) {
            return {
                status: StatusCodes.OK,
                body: { message: "Wallet liquidation request has already been made - process is already closed" }
            };
        }

        const update = { $set: { isBalanceClearanceRequired: true } };
        await Wallet.updateOne(query, update);

        return {
            status: StatusCodes.OK,
            body: { message: "Wallet liquidation request made" }
        };
    } catch (error) {
        console.error(`[${context}] Error:`, error);
        throw error; 
    }
};

async function removeBalanceFromWallet(transaction) {
    const context = "[removeBalanceFromWallet]";
    
    try {
        const wallet = await Wallet.findWallet({ userId: transaction.userId });

        if (!wallet) {
            console.error(`${context} Wallet not found for userId: ${transaction.userId}`);
            return false;
        }

        const hasTransaction = wallet.transactionsList.some(elem => elem.transactionId === transaction._id);
        const hasSufficientBalance = wallet.amount.value >= transaction.amount.value;

        let query = { userId: transaction.userId };
        let updateOperation = {};

        if (hasTransaction) {
            query["transactionsList.transactionId"] = transaction._id;
            updateOperation = {
                $set: {
                    "transactionsList.$.status": hasSufficientBalance ? transaction.status : process.env.TransactionStatusFaild,
                    "transactionsList.$.transactionType": transaction.transactionType
                }
            };
            if (hasSufficientBalance) {
                updateOperation.$inc = { "amount.value": -transaction.amount.value };
            }
        } else {
            updateOperation = {
                $push: {
                    transactionsList: {
                        transactionId: transaction._id,
                        transactionType: transaction.transactionType,
                        status: hasSufficientBalance ? transaction.status : process.env.TransactionStatusFaild
                    }
                }
            };
            if (hasSufficientBalance) {
                updateOperation.$inc = { "amount.value": -transaction.amount.value };
            }
        }

        const updateResult = await Wallet.updateWalletOne(query, updateOperation);

        if (updateResult.nModified === 0) {
            console.warn(`${context} No records updated for userId: ${transaction.userId}`);
        }

        return hasSufficientBalance;
    } catch (error) {
        console.error(`${context} Error: ${error.message}`);
        throw error;
    }
};

async function removeBalanceFromWallet(transaction) {
    const context = "[removeBalanceFromWallet]";
    
    try {
        const wallet = await Wallet.findWallet({ userId: transaction.userId });

        if (!wallet) {
            console.error(`${context} Wallet not found for userId: ${transaction.userId}`);
            return false;
        }

        const hasTransaction = wallet.transactionsList.some(elem => elem.transactionId === transaction._id);
        const hasSufficientBalance = wallet.amount.value >= transaction.amount.value;

        let query = { userId: transaction.userId };
        let updateOperation = {};

        if (hasTransaction) {
            query["transactionsList.transactionId"] = transaction._id;
            updateOperation = {
                $set: {
                    "transactionsList.$.status": hasSufficientBalance ? transaction.status : process.env.TransactionStatusFaild,
                    "transactionsList.$.transactionType": transaction.transactionType
                }
            };
            if (hasSufficientBalance) {
                updateOperation.$inc = { "amount.value": -transaction.amount.value };
            }
        } else {
            updateOperation = {
                $push: {
                    transactionsList: {
                        transactionId: transaction._id,
                        transactionType: transaction.transactionType,
                        status: hasSufficientBalance ? transaction.status : process.env.TransactionStatusFaild
                    }
                }
            };
            if (hasSufficientBalance) {
                updateOperation.$inc = { "amount.value": -transaction.amount.value };
            }
        }

        const updateResult = await Wallet.updateWalletOne(query, updateOperation);

        if (updateResult.nModified === 0) {
            console.warn(`${context} No records updated for userId: ${transaction.userId}`);
        }

        return hasSufficientBalance;
    } catch (error) {
        console.error(`${context} Error: ${error.message}`);
        throw error;
    }
}


module.exports = {
    getWalletsRequiringClearance,
    clearWalletBalances,
    anonymizeUserData,
    sendEmailWalletClearance,
    enableBalanceClearance,
    removeBalanceFromWallet
};
