const PaymentsAdyenHandler = require('../handlers/paymentsAdyen');
const PreAuthorizeHandler = require('../handlers/preAuthorize');
const TransactionsHandler = require('../handlers/transactions');
const moment = require('moment');
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};

module.exports = {
    forceJobProcessPreAuthCancel,
}

// CANCEL PRE AUTH ROUTINE

async function findPreAuthToCancel() {
    const context = "Function findPreAuthToCancel";
    try {
        // I set the dateLimit for 15 min if, for some reason, there's a request at the same time as the job is running and there's an invalid set to false of the pre auth 
        const dateLimit = moment.utc().subtract(15, 'minutes').format();
        const found = await PreAuthorizeHandler.findPreAuthorize({ authorizeDate : {$lt : dateLimit} , success : true , active  :true  })
        await Promise.all(found.map(async auth => await cancelPreAuth(auth)))
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function cancelPreAuth(auth) {
    const context = "Function cancelPreAuth";
    try {

        // Cancel adyen pre auth
        const cancelResponse = await PaymentsAdyenHandler.cancelPaymentAdyen(auth.clientName , auth.adyenReference , auth.reference)

        // Update transaction with cancel response
        const transaction = await TransactionsHandler.updateTransaction(auth.reference, {$set : {dataReceived : cancelResponse , status : process.env.TransactionStatusFaild}})

        // Set pre auth to not active since it no longer can be used
        PreAuthorizeHandler.editPreAuthorize({_id : auth._id , active : false})

        return transaction
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function forceJobProcessPreAuthCancel(req,res) {
    const context = "Function handleCreate";
    try {
        
        console.log("Forcing to cancel Pre Auth");
        findPreAuthToCancel()
        return res.status(200).send("OK");
            
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(200).send("KO");

    };
}

cron.schedule('*/30 * * * *', () => {
    console.log("Routine to cancel Pre Auth");
    findPreAuthToCancel()
});
    