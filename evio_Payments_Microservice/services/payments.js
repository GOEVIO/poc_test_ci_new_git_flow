const axios = require('axios');
const transactionService = require('../services/transactions');
const walletService = require('../services/walletService');
const ExternalRequestHandlers = require("../handlers/externalRequest");
const Transactions = require('../models/transactions');
const NotificationsPayments = require('../models/notificationsPayments');
const Payments = require('../models/payments');
const Wallet = require('../models/wallet');
const Constants = require('../utils/constants');
const { ObjectId } = require('mongodb');
const formatDate = (date) => date.toISOString().split('T')[0];

exports.verifyPendingTransactionsLusoPay = async (credentialType) => {
    const context = "verifyPendingTransactionsLusoPay";
    let transactionId, userId, statusBefore, statusAfter, walletBefore, walletBeforeAmount, walletAfterAmount;

    const authHeader = getAuthHeader(credentialType);
    const dateFilter = buildDateFilter();

    try {
        console.log(`[${context}] Fetching pending transactions...`);

        const [transactionsResponseRef, transactionsResponseMbWay] = await Promise.all([
            axios.get(`${Constants.lusopay.apiUrl}${Constants.lusopay.apiUrlFilterRefMultibanco}${dateFilter}`, { headers: { 'Authorization': authHeader } }),
            axios.get(`${Constants.lusopay.apiUrl}${Constants.lusopay.apiUrlFilterMbWay}${dateFilter}`, { headers: { 'Authorization': authHeader } })
        ]);
        const transactionsData = [...(transactionsResponseRef.data || []), ...(transactionsResponseMbWay.data || [])];


        if (!transactionsData.length) {
            console.log(`[${context}] No successful transactions found.`);
            return { message: "No successful transactions found" };
        }

        console.log(`[${context}] Found ${transactionsData.length} successful total transactions.`);

        const filteredTransactions = transactionsData.filter(transaction =>
            transaction.description === "Pag. MB Way" || transaction.description.startsWith("Ent.")
        );
        if (filteredTransactions.length === 0) {
            console.log(`[${context}] No transactions with description "Pag. MB Way" found.`);
            return { message: "No transactions with description 'Pag. MB Way' found" };
        }

        console.log(`[${context}] Found ${filteredTransactions.length} Pag. MB Way transactions.`);

        const detailsPromises = filteredTransactions.map(transaction =>
            axios.get(`${Constants.lusopay.apiUrl}/transactions/${transaction.id}?fields=customValues`, {
                headers: { 'Authorization': authHeader }
            }).catch(error => {
                console.error(`[${context}] Error fetching details for ${transaction.id}:`, error.message);
                return null;
            })
        );

        const detailsResponses = await Promise.all(detailsPromises);

        const bulkUpdates = [];
        const walletUpdates = [];

        for (const detailsResponse of detailsResponses) {
            if (!detailsResponse?.data?.customValues?.[0]?.stringValue) continue;

            const documentId = detailsResponse.data.customValues[0].stringValue;
            if (!ObjectId.isValid(documentId)) {
                console.warn(`Skipping invalid ObjectId: ${documentId}`);
                continue;
            }

            const matchingTransaction = await Transactions.findOne({
                _id: new ObjectId(documentId),
                status: process.env.TransactionStatusInPayment,
                provider: { $in: ["MBRef/PSNet", "MBWay"] },
                transactionType: "credit"
            }).lean();

            console.info(`[${context}] MatchingTransaction - id: ${documentId.toString()}`);
            if (matchingTransaction) {
                bulkUpdates.push({
                    updateOne: {
                        filter: { _id: matchingTransaction._id },
                        update: { $set: { status: process.env.TransactionStatusPaidOut } }
                    }
                });

                walletUpdates.push({
                    updateOne: {
                        filter: { userId: matchingTransaction.userId },
                        update: {
                            $push: {
                                transactionsList: {
                                    transactionId: matchingTransaction._id,
                                    transactionType: matchingTransaction.transactionType,
                                    status: process.env.TransactionStatusPaidOut
                                }
                            },
                            $inc: { "amount.value": matchingTransaction.amount.value }
                        }
                    }
                });
                transactionId = matchingTransaction._id;
                userId = matchingTransaction.userId;
                statusBefore = matchingTransaction.status;
                statusAfter = process.env.TransactionStatusPaidOut;

                walletBefore = await Wallet.findOne({ userId: matchingTransaction.userId }).lean();
                walletBeforeAmount = walletBefore ? walletBefore.amount.value : 0;
                walletAfterAmount = walletBeforeAmount + matchingTransaction.amount.value;

                console.info(`[${context}] transaction and wallet updated`, {
                    transactionId: transactionId,
                    userId: userId,
                    statusBefore: statusBefore,
                    statusAfter: statusAfter,
                    walletBeforeAmount: walletBeforeAmount,
                    walletAfterAmount: walletAfterAmount,
                    Timestamp: new Date().toISOString()
                });

                await validateNotifications(transactionId, userId);
            }
        }

        if (bulkUpdates.length) {
            await Transactions.bulkWrite(bulkUpdates);
            await Wallet.bulkWrite(walletUpdates);
            console.info(`[${context}] Transactions and Wallets updated in bulk.`);
        }

        return { message: "Transactions processed successfully" };
    } catch (error) {
        console.error(`[${context}] Error: `, error);
        throw new Error("Error processing pending transactions");
    }
};

const getAuthHeader = (credentialType) => {
    const { user, pass } = Constants.lusopay[credentialType];
    return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
};

const buildDateFilter = () => {
    const today = new Date();
    const nextDay = new Date(today.getTime());
    nextDay.setDate(today.getDate() + 1);

    const twoDaysAgo = new Date(today.getTime());
    twoDaysAgo.setDate(today.getDate() - 2);

    return `&datePeriod=${formatDate(twoDaysAgo)}&datePeriod=${formatDate(nextDay)}`;
};

async function validateNotifications(transactionId, userId) {
    const context = "Function validateNotifications";
    try {
        const query = { transactionId, active: true };
        console.log(`[${context}] Searching notifications for transactionId: ${transactionId}`);
        const notificationsFound = await NotificationsPayments.find(query);
        console.log(`[${context}] Found ${notificationsFound.length} active notifications`);

        if (notificationsFound.length > 0) {
            console.log(`[${context}] Processing notifications`);
            await Promise.all(notificationsFound.map(notification => makePaymentAsync(notification)));

            const updatedNotifications = await NotificationsPayments.find(query);
            const wallet = await Wallet.findOne({ userId });

            console.log(`[${context}] Checking wallet balance for userId: ${userId}, balance: ${wallet.amount.value}`);
            if (wallet.amount.value >= 20) {
                console.log(`[${context}] Wallet balance sufficient, verifying blocked RFID`);
                await ExternalRequestHandlers.verifyBlockedRFID(userId);
            }

            if (updatedNotifications.length === 0) {
                console.log(`[${context}] No active notifications left, activating contracts`);
                await activateContracts(userId);
            }
        } else {
            console.log(`[${context}] No active notifications found for userId: ${userId}`);
            const wallet = await Wallet.findOne({ userId });
            if (wallet.amount.value >= 20) {
                console.log(`[${context}] Wallet balance sufficient, verifying blocked RFID`);
                await ExternalRequestHandlers.verifyBlockedRFID(userId);
            }
        }
    } catch (error) {
        logError(context, error);
    }
}

/**
 * Process a single notification to make a payment if applicable.
 * @param {Object} notification The notification to process.
 */
async function makePaymentAsync(notification) {
    const context = "Function makePaymentAsync";
    try {
        console.log(`[${context}] Making payment for notificationId: ${notification._id}`);
        const payment = await paymentFindOne({ _id: notification.paymentId });
        const result = await makePaymentWallet(payment);

        if (result) {
            console.log(`[${context}] Payment successful, updating notification status to inactive`);
            await updateNotificationStatus(notification._id);
        }
    } catch (error) {
        logError(context, error);
        throw error;
    }
}

/**
 * Find a payment by a query and return it.
 * @param {Object} query Query object to find the payment.
 * @returns {Object} The payment object.
 */
async function paymentFindOne(query) {
    try {
        console.log(`[Function paymentFindOne] Finding payment with query:`, query);
        return await Payments.findOne(query);
    } catch (error) {
        logError("Function paymentFindOne", error);
        throw error;
    }
}

/**
 * Process the wallet payment by updating the transaction and the wallet balance.
 * @param {Object} payment The payment object.
 * @returns {Object} The updated payment.
 */
async function makePaymentWallet(payment) {
    const context = "Function makePaymentWallet";
    try {
        console.log(`[${context}] Processing wallet payment for transactionId: ${payment.transactionId}`);

        const originalTransaction = await Transactions.findById(payment.transactionId);
        if (!originalTransaction) {
            throw new Error("Transaction not found");
        }

        const transactionUpdate = {
            $set: {
                status: process.env.TransactionStatusPaidOut,
                data: process.env.ReasonSuccessBalance,
                provider: process.env.PaymentMethodWallet
            }
        };

        const transaction = await updateTransaction(payment.transactionId, transactionUpdate);

        if (transaction) {
            console.log(`[${context}] Wallet update successful, removing balance from wallet`);

            let walletUpdated = false;
            try {
                walletUpdated = await walletService.removeBalanceFromWallet(payment);
            } catch (error) {
                console.log(`[${context}] Wallet update failed, rolling back transaction`);
                await updateTransaction(payment.transactionId, {
                    $set: {
                        status: originalTransaction.status,
                        data: originalTransaction.data,
                        provider: originalTransaction.provider
                    }
                });
                throw error;
            }
            
            if (walletUpdated) {
                console.log(`[${context}] Wallet balance updated, updating payment status`);
                await updatePaymentStatus(payment);

                return payment;
            } else {
                console.log(`[${context}] Insufficient balance, updating transaction to failed`);
                await updateTransactionFailed(payment.transactionId);
                throw new Error("Insufficient balance");
            }
        }
    } catch (error) {
        logError(context, error);
        throw error;
    }
}

/**
 * Update a transaction with new values.
 * @param {string} transactionId The transaction ID.
 * @param {Object} update The update data for the transaction.
 * @returns {Object} The updated transaction.
 */
async function updateTransaction(transactionId, update) {
    try {
        console.log(`[Function updateTransaction] Updating transaction with ID: ${transactionId}`);
        return await Transactions.findOneAndUpdate({ _id: transactionId }, update, { new: true });
    } catch (error) {
        logError("Function updateTransaction", error);
        throw error;
    }
}

/**
 * Update the payment status after processing the wallet payment.
 * @param {Object} payment The payment object.
 */
async function updatePaymentStatus(payment) {
    const updateData = {
        $set: {
            status: process.env.TransactionStatusPaidOut,
            reason: process.env.ReasonSuccessBalance,
            transactionId: payment._id,
            paymentMethod: process.env.PaymentMethodWallet
        }
    };
    console.log(`[Function updatePaymentStatus] Updating payment with ID: ${payment._id}`);
    await Payments.updateOne({ _id: payment._id }, updateData);
}

/**
 * Determine if the billing OCPI should be sent.
 * @param {Object} payment The payment object.
 * @returns {boolean} True if billing should be sent, otherwise false.
 */
function shouldSendBilling(payment) {
    return !process.env.PublicNetworkChargerType.includes(payment.chargerType) && payment.amount.value > 0;
}

/**
 * Update notification status to inactive after payment is processed.
 * @param {string} notificationId The notification ID.
 */
async function updateNotificationStatus(notificationId) {
    console.log(`[Function updateNotificationStatus] Deactivating notification with ID: ${notificationId}`);
    await NotificationsPayments.updateOne(
        { _id: notificationId },
        { $set: { active: false } }
    );
}

/**
 * Log error messages with context.
 * @param {string} context The context where the error occurred.
 * @param {Error} error The error object.
 */
function logError(context, error) {
    console.error(`[${context}] Error:`, error.message || error);
}

/**
 * Update the transaction to failed status if there's an error.
 * @param {string} transactionId The transaction ID.
 */
async function updateTransactionFailed(transactionId) {
    const transaction = {
        $set: {
            status: process.env.TransactionStatusFaild,
            data: process.env.ReasonFail
        }
    };

    try {
        console.log(`[Function updateTransactionFailed] Updating failed transaction with ID: ${transactionId}`);
        const result = await updateTransaction(transactionId, transaction);
        result.status = process.env.TransactionStatusFaild;
        await updateTransactionToWallet(result);
    } catch (error) {
        logError("Function updateTransactionFailed", error);
    }
}
