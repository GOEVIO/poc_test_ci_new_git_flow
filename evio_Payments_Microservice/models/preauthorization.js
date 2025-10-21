const mongoose = require('mongoose');
require("dotenv-safe").load();
const axios = require("axios");

const { Schema } = mongoose;

const preAuthorizationModel = new Schema(
    {
        transactionId: { type: String },
        initialAmount: { type: Number },
        reservedAmountToUpdatePreAuth: { type: Number },
        amount: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        },
        paymentMethodId: { type: String },
        adyenReference: { type: String },
        userId: { type: String },
        success: { type: Boolean, default: false },
        active: { type: Boolean, default: false },
        createdAt: { type: String },
        updatedAt: { type: String },
        adyenPspReferenceUpdated: { type: Array },
        blobPreAuthorization: { type: String },
        amountRefunded: { type: Number },
    },
    {
        timestamps: true
    }
);


module.exports.retrieveReservationAmountBySessionId = async (sessionId)=>{
    return new Promise(async (resolve, reject) => {
        const context = 'retrieveReservationAmountBySessionId ';
        const proxy = process.env.HostPaymentsV2 + process.env.PathPostPreAuthorization + 'preauthorization/session/' + sessionId
        console.log(`[${context}] sessionId: ${sessionId}, proxy: ${proxy}`);
        axios.get(proxy)
            .then(async (result) => {
                console.log('[', context, ']', 'Result', result.data.info);
                resolve(result.data.info);
            })
            .catch((error) => {
                console.error(`[${context}]Error `, error.message);
                resolve(null);
            }); 
    })
    
}

module.exports.updatePreAuthorization = async (query, update)=>{
    const preAuthorizationCollection = mongoose.connection.db.collection('preAuthorizations');    
    const result = await preAuthorizationCollection.updateOne(query, update);
    console.log('preAuthorizationCollection result:' ,result);
    return result;
}

