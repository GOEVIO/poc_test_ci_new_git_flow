const mongoose = require('mongoose');
require('dotenv-safe').load();
const { CollectionNames } = require('evio-library-commons');
const { historyModel } = require('evio-library-statistics');

// Commons indexes 
historyModel.index({ 'startDate': 1 });
historyModel.index({ 'hwId': 1 });
historyModel.index({ 'paymentId': 1 });
historyModel.index({ 'sessionId': 1 });
historyModel.index({ 'invoiceId': 1 });
historyModel.index({ 'infrastructure._id': 1 });
historyModel.index({ 'ev._id': 1 });
historyModel.index({ 'fleet._id': 1 });
historyModel.index({ 'ev.licensePlate': 1 });

// Compound indexes
historyModel.index({ 'stopDate': 1, 'evOwner': 1, 'chargerOwner': 1, 'userId': 1, 'startDate': 1, 'evId': 1, 'hwId': 1, 'network': 1, 'fleet._id': 1, 'infrastructure._id': 1 });
historyModel.index({ 'evOwner': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'userIdWillPay': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'userId': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'chargerOwner': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'chargerOwner': 1, 'ev.fleet': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'clientName': 1, 'startDate': 1 });
historyModel.index({ 'network': 1, 'createdAt': 1 });
historyModel.index({ 'chargerOwner': 1, 'groupCSUsers.groupId': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'evOwner': 1, 'userId': 1, 'startDate': 1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'evId': 1, 'userId': 1, 'startDate': 1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'charger.infrastructure': 1, 'chargerOwner': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'chargerOwner': 1, 'startDate': -1, 'status': 1 });
historyModel.index({ 'cdrId': 1, 'cdr._id': 1 });
historyModel.index({ 'charger._id': 1, 'infrastructure._id': 1 });
historyModel.index({ 'evOwner': 1, 'network': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'evOwner': 1, 'network': 1, 'startDate': -1, 'chargerOwner': 1, 'status': 1, 'stopDate': 1 });

// indexes with one field different
historyModel.index({ 'ev.fleet': 1, 'userIdWillPay': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'ev.fleet': 1, 'evOwner': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'ev.fleet': 1, 'userId': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
//-----------------------------//

// indexes with one field different
historyModel.index({ 'chargerOwner': 1, 'user._id': 1, 'startDate': 1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'chargerOwner': 1, 'infrastructure._id': 1, 'startDate': 1, 'status': 1, 'stopDate': 1 });
//-----------------------------//

// indexes with one field different
historyModel.index({ 'network': 1, 'userId': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'network': 1, 'userIdWillPay': 1, 'startDate': -1, 'status': 1, 'stopDate': 1 });
//-----------------------------//

// indexes with one field different
historyModel.index({ 'evOwner': 1, 'evId': 1, 'startDate': 1, 'status': 1, 'stopDate': 1 });
historyModel.index({ 'userId': 1, 'evId': 1, 'startDate': 1, 'status': 1, 'stopDate': 1 });
//-----------------------------//

const History = mongoose.model(
  CollectionNames.Statistics.HistoriesV2,
  historyModel,
);

History.updateHistory = (query, values, callback) => {
  History.findOneAndUpdate(query, values, callback);
};

History.removeHistory = (query, callback) => {
  History.findOneAndRemove(query, callback);
};

module.exports = History;
