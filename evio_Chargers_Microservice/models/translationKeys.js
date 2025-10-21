const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const translationKeysSchema = new Schema(
    {
        translationKey: { type: String },
        key: { type: String },
        value: { type: String },
        active: { type: Boolean, default: true },

    },
    {
        timestamps: true
    }
)


module.exports = mongoose.model('translationKeys', translationKeysSchema);