const Utils = require('../utils');

module.exports.test = () => {
    console.log('test');
    const calculateAmountToPreAuth = Utils.FormulaToCalculateAmountToPreAuth(30, 13.06, 120, 0.34);
    console.log(calculateAmountToPreAuth);
}

