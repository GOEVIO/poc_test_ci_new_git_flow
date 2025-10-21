const axios = require("axios");

module.exports = {
    getInvoice: function (invoiceId) {
        let context = "Function getInvoice";
        let host = process.env.HostBilling + process.env.PathGetInvoiceByID;
        return new Promise(async (resolve) => {
            try {

                let params = {
                    invoiceId: invoiceId
                };

                let invoice = await axios.get(host, { params })

                resolve(invoice.data);

            } catch (error) {

                console.error(`[${context}][${host}] Error`, error.message);

                resolve(false);

            }
        });
    }
};