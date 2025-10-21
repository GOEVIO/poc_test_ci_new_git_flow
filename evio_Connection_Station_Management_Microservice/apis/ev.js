const axios = require("axios");
function getEVByEvId(evId) {
    const context = "Function getEVByEvId";
    return new Promise(async (resolve, reject) => {
        let host = process.env.EVsHost + process.env.PathGetEVByEVId;
        let params = { _id: evId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve('-1');
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve('-1');
            });
    });
};

async function isCompanyPaymentResponsibility(evId, userId) {
    const context = "Function getUserPaymentResponsibility";
    try {
        const ev = await getEVByEvId(evId);

        if (ev == -1) {
            console.warn(`[${context}] No EV found for evId: ${evId}`);
            return false;
        }

        const driver = ev.listOfDrivers.find(d => d.userId === userId);

        if (!driver) {
            console.warn(`[${context}] No driver found for evId: ${evId} and userId: ${userId}`);
            return false;
        }

        const isCompanyPaying = driver.paymenteBy === 'myself';

        return isCompanyPaying;
    } catch (error) {
        console.error(`[${context}] Error: `, error);
        return false;
    }
}

module.exports = {
    getEVByEvId,
    isCompanyPaymentResponsibility
};