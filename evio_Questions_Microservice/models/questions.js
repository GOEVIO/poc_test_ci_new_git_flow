const mongoose = require('mongoose');
require("dotenv-safe").load();
const { Schema } = mongoose;

const answersModel = new Schema({
    answer: { type: String },
    active: { type: Boolean, default: true }
});

const questionsModel = new Schema(
    {
        id: { type: String, index: true },
        questionCode: { type: String },
        type: { type: String },
        active: { type: Boolean, default: true },
        answers: {
            type: [answersModel]
        },
        createUser: { type: String },
        modifyUser: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

questionsModel.index({ type: 1 });

var Questions = module.exports = mongoose.model('Questions', questionsModel);

module.exports.createQuestions = function (newQuestions, callback) {
    newQuestions.save(callback);
};

module.exports.updateQuestions = function (query, values, callback) {
    Questions.findOneAndUpdate(query, values, callback);
};