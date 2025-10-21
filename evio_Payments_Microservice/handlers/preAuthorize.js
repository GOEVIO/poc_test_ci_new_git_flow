const PreAuthorize = require('../models/preAuthorize');
const ErrorHandler = require('./errorHandler');
const PaymentsAdyenHandler = require('./paymentsAdyen');
const TransactionsHandler = require('./transactions');
const PreAuthValidator = require('../validators/preAuthorize');
const RequestHistoryLogs = require('./requestHistoryLogsHandler');
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
    handleCreate: async function (req,res) {
        const context = "Function handleCreate";
        try {

            // Validate body
            await PreAuthValidator.validateCreate(req.body)

            // Create pre auth
            const created = await createPreAuthorize(req.body)

            // Send response
            res.status(200).send(created);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, created);
            return res
                
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(req, error, res);
        };
    },
    handleGet: async function (req,res) {
        const context = "Function handleGet";
        try {

            // Validate query
            await PreAuthValidator.validateGet(req.query)

            // Get pre auth
            const found = await findPreAuthorize(req.query)

            // Send response
            res.status(200).send(found);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, found);
            return res
                
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(req, error, res);
        };
    },
    handlePatch: async function (req,res) {
        const context = "Function handlePatch";
        try {

            // Validate body
            await PreAuthValidator.validateEdit(req.body)

            // Edit pre auth 
            const found = await editPreAuthorize(req.body)

            // Send response
            res.status(200).send(found);
            RequestHistoryLogs.saveRequestHistoryLogs(req, res, found);
            return res
                
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(req, error, res);
        };
    },
    createPreAuthorize,
    findPreAuthorize,
    editPreAuthorize,
    findOnePreAuthorize,
    createPreAuthorizeEntry,
}

async function createPreAuthorize(preAuthorizeBody) {
    const context = "Function createPreAuthorize";
    try {
        const preAuthObject = new PreAuthorize(preAuthorizeBody)   
        return await preAuthObject.save()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    };
}

async function findPreAuthorize(query) {
    const context = "Function findPreAuthorize";
    try {
        return await PreAuthorize.find(query).lean()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    };
}

async function editPreAuthorize(data) {
    const context = "Function editPreAuthorize";
    try {
        // Deep copy of the data object so we can delete its properties
        const body = JSON.parse(JSON.stringify(data));
        if (body._id || body.reference) {
            const query = {
                $and : [
                    body._id ? {_id : body._id} : {},
                    body.reference ? {reference : body.reference} : {},
                ]
            } 
            delete body._id
            delete body.reference
            return await PreAuthorize.findOneAndUpdate(query  , {$set : body} , {new : true}).lean()
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function findPreAuthToCancel() {
    const context = "Function findPreAuthToCancel";
    try {
        // I set the dateLimit for 15 min if, for some reason, there's a request at the same time as the job is running and there's an invalid set to false of the pre auth 
        const dateLimit = moment.utc().subtract(15, 'minutes').format();
        const found = await findPreAuthorize({ authorizeDate : {$lt : dateLimit} , success : true , active  :true  })
        await Promise.all(found.map(async auth => await cancelPreAuth(auth)))
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function cancelPreAuth(auth) {
    const context = "Function cancelPreAuth";
    try {
        // Set pre auth to not active since it no longer can be used
        editPreAuthorize({_id : auth._id , active : false})

        // Cancel adyen pre auth
        const cancelResponse = await PaymentsAdyenHandler.cancelPaymentAdyen(auth.clientName , auth.adyenReference , auth.reference)

        // Update transaction with cancel response
        const transaction = await TransactionsHandler.updateTransaction(auth.reference, {$set : {dataReceived : cancelResponse}})

        return transaction
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function findOnePreAuthorize(query) {
    const context = "Function findPreAuthorize";
    try {
        return await PreAuthorize.findOne(query).lean()
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

async function createPreAuthorizeEntry(reference , currency , value , paymentMethodId , adyenReference , userId , success , active , clientName ,  authorizeDate=undefined ) {
    const context = "Function createPreAuthorizeEntry";
    try {
        const body = {
            reference,
            amount: {
                currency,
                value,
            },
            paymentMethodId,
            adyenReference,
            userId,
            success,
            active,
            authorizeDate,
            clientName,
        }
        await createPreAuthorize(body)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    };
}

cron.schedule('*/30 * * * *', () => {
    console.log("Routine to cancel Pre Auth");
    findPreAuthToCancel()
});
    