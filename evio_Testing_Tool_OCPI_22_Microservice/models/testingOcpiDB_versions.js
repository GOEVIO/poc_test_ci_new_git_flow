const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const versionsModel = new Schema({
    version: {
        type: String
    },
    url: {
        type: String
    }
});

var Versions = module.exports = mongoose.model('mobie_versions', versionsModel);

