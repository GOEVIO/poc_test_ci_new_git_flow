const mongoose = require('mongoose');

const PasswordRecoveriesSchema = mongoose.Schema({
    code: {
        type: String,
        require: true
    },
    userId: {
        type: String,
        require: true
    },
    token: {
        type: String,
        require: true
    },
    used: {
        type: Boolean,
        require: true
    },
    createDate: {
        type: Date,
        default: Date.now
    },
    clientName: { type: String, default: 'EVIO' },
});

PasswordRecoveriesSchema.index({ userId: 1 }, { background: true });
PasswordRecoveriesSchema.index({ code: 1 }, { background: true });

const PasswordRecoveries = module.exports = mongoose.model('PasswordRecoveries', PasswordRecoveriesSchema);

module.exports.createPasswordRecovery = function (newPasswordRecovery, callback) {
    newPasswordRecovery.save(callback);
};

module.exports.checkIfCodeWasAlreadyUsed = function (code, userId, callback) {
    const query = { code, userId, used: true };
    PasswordRecoveries.findOne(query, callback);
};

module.exports.getCodeByUser = function (code, userId) {
    const query = { code, userId };
    const project = { _id: 1, used: 1, token: 1 };
    const sort = { createDate: -1 };
    return PasswordRecoveries.findOne(query, project, sort);
};

module.exports.checkIfCodeBelongsToUserId = function (code, userId, callback) {
    const query = { code, userId };
    PasswordRecoveries.findOne(query, callback);
};

module.exports.markAsUsedById = function (userId, callback) {
    const query = { userId };
    const newvalues = { $set: { used: true } };
    return PasswordRecoveries.updateMany(query, newvalues, callback);
};

module.exports.markAsUsedByCode = function (code, callback) {
    const query = { code };
    const newvalues = { $set: { used: true } };
    PasswordRecoveries.updateOne(query, newvalues, callback);
};

module.exports.getPasswordRecoveryByCode = function (code, callback) {
    const query = { code };
    PasswordRecoveries.findOne(query, callback);
};
