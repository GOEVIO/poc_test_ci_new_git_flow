const mongoose = require('mongoose');
require("dotenv-safe").load();
const { Schema } = mongoose;

const configsModel = new Schema(
    {
        conversionEfficiency: { type: Number },
    }
);

var Configs = module.exports = mongoose.model('configs', configsModel);