const CEMETariff = require('../models/cemeTariff');

module.exports = {
    cemeTariffFindOne: (query) => {
        var context = "Function cemeTariffFindOne";
        return new Promise((resolve, reject) => {
            CEMETariff.findOne(query, (err, cemeTariffFound) => {
                if (err) {
                    console.log(`[${context}][findone] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(cemeTariffFound);
                };
            });
        });
    }

}