const Wallet = require('../models/wallet');
const Payment = require('../models/payments');

const getUserFinancialData = async (userId) => {
    const context = `Function getUserFinancialData`;
    try {
        const query = { userId: userId };
        const [walletData, paymentData] = await Promise.all([
            Wallet.find(query).lean(),
            Payment.find(query).lean()
        ]);

        return {
            wallet: walletData,
            payments: paymentData,
        };
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

module.exports = {
    getUserFinancialData,
};