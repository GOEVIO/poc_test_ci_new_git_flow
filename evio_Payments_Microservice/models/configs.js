const mongoose = require('mongoose'); 
 
const { Schema } = mongoose; 
 
const blockCreditCard = new Schema( 
    { 
        clientNames: { type: Array, default: [] }, 
        minAccoutCreatedDays: { type: Number, default: 30 }, 
        whitelist: { type: Array, default: [] }
    }, 
    { 
        timestamps: true 
    } 
); 

const configsModel = new Schema( 
    { 
        blockCreditCard: { type: blockCreditCard },
        minAmountToReserve: { type: Number, default: 0 },
        maxAmountToReserve: { type: Number, default: 0 },
        timeToSimulatePrice: { type: Number, default: 0 },
        timeToSimulatePriceUpdated: { type: Number, default: 0 }
    }, 
    { 
        timestamps: true 
    } 
); 
 
var configs = module.exports = mongoose.model('configs', configsModel); 
 
