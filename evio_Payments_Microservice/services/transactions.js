const Transactions = require('../models/transactions');

const transactionService = {
    async updateTransaction(query, newValues) {
        try {
            const updatedTransaction = await Transactions.findOneAndUpdate(query, newValues, { new: true });

            if (!updatedTransaction) {
                throw new Error("Transaction update failed: No matching record found.");
            }

            return updatedTransaction;
        } catch (error) {
            console.error(`[transactionService.updateTransaction] Error: ${error.message}`);
            throw error;
        }
    }
};

module.exports = transactionService;
