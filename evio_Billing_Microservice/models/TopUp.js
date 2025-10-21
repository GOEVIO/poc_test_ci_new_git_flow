const mongoose = require('mongoose');
const { Schema } = mongoose;

//TopUp status
//10 - created
//20 - processing
//30 - failed
//40 - closed

const topUpModel = new Schema(
    {
        id: { type: String, index: true },
        payment: { type: Number },
        currency: { type: String },
        userId: { type: String },
        status: { type: String },
        type: { type: String },
        paymentId: { type: String },
        transactionId: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    { timestamps: true }
);

//topUpModel.index({ _id: 1 });
topUpModel.index({ userId: 1 });
topUpModel.index({ status: 1 });

var topUp = (module.exports = mongoose.model("topUp", topUpModel));

module.exports.createTopUp = function (newTopUp, callback) {
    newTopUp.save(callback);
};

module.exports.updateTopUp = function (query, values, callback) {
    topUp.findOneAndUpdate(query, values, callback);
};
