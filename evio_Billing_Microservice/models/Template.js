const mongoose = require('mongoose');
const { Schema } = mongoose;

const templateModel = new Schema(
    {
        id: { type: String, index: true },
        name: { type: Number },
        clientName: { type: String, default: "EVIO" },
        ceme: { type: String },
        environment: { type: String },
        email: { type: String },
        token: { type: String },
        senderEmail: { type: String },
        senderPassword: { type: String },
        senderHost: { type: String },
        senderPort: { type: Number },
        taxId: { type: String },
        sourceInfo: { type: String },
        fromInfo: { type: String }
    },
    { timestamps: true }
);

//templateModel.index({ _id: 1 });

var template = (module.exports = mongoose.model("template", templateModel));

module.exports.createTemplate = function (newTemplate, callback) {
    newTemplate.save(callback);
};

module.exports.updateTemplate = function (query, values, callback) {
    template.findOneAndUpdate(query, values, callback);
};
