const mongoose = require('mongoose'); 

const { Schema } = mongoose;


var triesModel = mongoose.Schema({
    numberOfTries: { type: Number },
    timeTried: { type: Date },
    failReason: { type: String },
    ocpiLogs: []
});


var tagsModel = mongoose.Schema({
    idTagDec: { type: String },
    idTagHexa: { type: String },
    idTagHexaInv: { type: String }
});

const toProcessCardsModel = new Schema(
    {
        id: { type: String, index: true },
        fileName: { type: String },
        cardNumber: { type: String },
        tags: { type: tagsModel },
        status: { type: String },
        userId: { type: String },
        emailSent: { type: Boolean, default: false },
        tries: { type: triesModel }
    },
    {
        timestamps: true
    }
);

toProcessCardsModel.index({ _id: 1, cardNumber: 1 });

var toProcessCards = module.exports = mongoose.model('toProcessCards', toProcessCardsModel);