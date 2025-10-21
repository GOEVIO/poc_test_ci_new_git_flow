const mongoose = require('mongoose'); 
require("dotenv-safe").load();
var AutoIncrement = require('mongoose-sequence')(mongoose);

const { Schema } = mongoose;

const comissionEVIOModel = new Schema(
    {
        userId: { type: String },
        minAmount:  { type: Number },
        percentage:  { type: Number },
        specialClients: [
            {
                userId: { type: String }, 
                minAmount: { type: Number },
                percentage: { type: Number },
            }
        ]
    },
    {
        timestamps: true
    }
);



var comissionEVIO = module.exports = mongoose.model('comissionEVIO', comissionEVIOModel);