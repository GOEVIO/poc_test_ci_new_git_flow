const ListPaymentMethod = require('../models/listPaymentMethod');

module.exports = {
    getListPaymentMethod: function (userId) {
        const context = "Function getListPaymentMethod";
        return new Promise(async (resolve, reject) => {
            try {

                let listPaymentMethod = await ListPaymentMethod.findOne({ userId: userId });

                resolve(listPaymentMethod);

            } catch (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    }
}