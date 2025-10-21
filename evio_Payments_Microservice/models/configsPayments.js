const mongoose = require('mongoose'); 
 
const { Schema } = mongoose; 
 
const configsPaymentsModel = new Schema( 
    { 
        AllowPayments: { type: Boolean, default: true }, 
        AllowPaymentsMessageError: { type: String, default: "De momento o método de pagamento MBWAY está indisponível. Por favor use um método de pagamento alternativo, ou tente mais tarde." },
        Type: { type: String }, 
    }, 
    { 
        timestamps: true 
    } 
); 
 
var configsPayments = module.exports = mongoose.model('configsPayments', configsPaymentsModel); 
 
module.exports.createconfigsPayments = function (newconfigsPayments, callback) { 
    newconfigsPayments.save(callback); 
}; 
 
module.exports.updateconfigsPayments = function (query, values, callback) { 
    configsPayments.findOneAndUpdate(query, values, callback); 
}; 
 
module.exports.removeconfigsPayments = function (query, callback) { 
    configsPayments.findOneAndRemove(query, callback); 
}; 