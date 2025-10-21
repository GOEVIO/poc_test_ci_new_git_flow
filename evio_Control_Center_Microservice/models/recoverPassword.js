var mongoose = require('mongoose');
var mongo = require('mongodb');

var PasswordRecoveriesSchema = mongoose.Schema({
  code: {
    type: String,
    index: true,
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
  }
});

PasswordRecoveriesSchema.index({ userId: 1 });

var PasswordRecoveries = module.exports = mongoose.model('PasswordRecoveries', PasswordRecoveriesSchema);

module.exports.createPasswordRecovery = function (newPasswordRecovery) {
  return newPasswordRecovery.save();
}

module.exports.checkIfCodeWasAlreadyUsed = function (code) {
  var query = { code: code, used: true };
  return PasswordRecoveries.findOne(query);
}

module.exports.checkIfCodeBelongsToUserId = function (code, userId) {
  var query = { code: code, userId : userId };
  return PasswordRecoveries.findOne(query);
}

module.exports.markAsUsedById = function (userId) {
  var query = { userId: userId };
  var newvalues = { $set: { used: true } };
  return PasswordRecoveries.updateMany(query, newvalues);
}

module.exports.markAsUsedByCode = function (code) {
  var query = { code: code };
  var newvalues = { $set: { used: true } };
  return PasswordRecoveries.updateOne(query, newvalues);
}

module.exports.getPasswordRecoveryByCode = function (code) {
  var query = { code: code };
  return PasswordRecoveries.findOne(query);
}


