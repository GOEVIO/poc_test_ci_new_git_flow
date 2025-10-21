
const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const endpoints = new Schema({
    identifier: { type: String },
    role: { type: String },
    url: { type: String }
});

const versionsDetailsModel = new Schema({
    version: {
        type: String
    },
    endpoints: [endpoints]
});

var VersionsDetails = module.exports = mongoose.model('mobie_details', versionsDetailsModel);

