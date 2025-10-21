// Models
const NotificationPayments = require('../models/notificationsPayments');
const paymentsService = require('../services/payments');

const commonLog = '[Controller payments ';
module.exports = {
    checkUserHasDebt: async (req, res) => {
        const context = `${commonLog} checkUserDebt]`;
        try {
            const { userid:userId } = req.headers;
            console.log("userId", userId)
            if (!userId) return res.status(400).send({ auth: false, message: 'No userId provided' });
            const query = {
                userId,
                active: true,
            }
            const debt = await NotificationPayments.findOne(query, { _id: 1 });
            return res.status(200).send(debt ? true : false);
        } catch (error) {
            console.error(`${context} Error: ${error.message}`);
            return res.status(500).send(error.message);
        }
    },
    verifyPendingTransactionsLusoPay: async (req, res) => {
        const context = "POST /api/private/payments/verifyPendingTransactionsLusoPay";
        const { credentialType = 'evio' } = req.body; 

        try {
            const result = await paymentsService.verifyPendingTransactionsLusoPay(credentialType);            
            return res.status(200).send(result);
        } catch (error) {
            console.error(`[${context}] Error:`, error);
            return res.status(500).send({ message: error.message });
        }
    }
}