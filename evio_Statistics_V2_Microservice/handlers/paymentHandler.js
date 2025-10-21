const axios = require("axios");

module.exports = {
    getPayment: function (paymentId) {
        let context = "Function getPayment";
        return new Promise(async (resolve) => {
            try {

                let params = {
                    _id: paymentId
                };

                let host = process.env.HostPayments + process.env.PathGetPaymentByID;

                let payment = await axios.get(host, { params })

                resolve(payment.data);

            } catch (error) {

                console.error(`[${context}] Error`, error.message);

                resolve(false);

            }
        });
    }
};
