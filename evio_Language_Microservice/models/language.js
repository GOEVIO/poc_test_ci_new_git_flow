const mongoose = require('mongoose');

const { Schema } = mongoose;

const languageModel = new Schema(
    {
        id: { type: String, index: true },
        languageCode: { type: String },
        languageName: { type: String },
        translations: [{
            key: { type: String },
            value: { type: String }
        }],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

languageModel.index({ languageCode: 1, languageName: 1 });

var Language = module.exports = mongoose.model('Language', languageModel);

module.exports.createLanguage = function (newLanguage, callback) {
    newLanguage.save(callback);
};

module.exports.updateLanguage = function (query, values, callback) {
    Language.findOneAndUpdate(query, values, callback);
};

module.exports.getTransalationsByLanguage = function (language, callback) {
    var query = { defaultLanguage: language };
    Language.findOne(query, callback);
};

module.exports.removeLanguage = function (query, callback) {
    Language.findByIdAndRemove(query, callback);
};