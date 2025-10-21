const axios = require('axios');


const UtilsPayments = {

    walletFindOne: async function (userId) {
        const context = "Funciton walletFindOne";
        try {
            let host = process.env.HostPayments + process.env.PathGetWalletByUser + userId
            let foundWallet = await axios.get(host)
            return foundWallet.data ? foundWallet.data : null
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            return null
        }
    }
}


module.exports = UtilsPayments;