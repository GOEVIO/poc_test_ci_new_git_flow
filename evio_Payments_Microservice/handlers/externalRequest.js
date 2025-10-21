const AxiosHandler = require("../services/axios");

module.exports = {
    verifyBlockedRFID: async (userId) => {
        const context = "Function verifyBlockedRFID";
        try {
            let host = process.env.HostUser + process.env.PathUnblockRfidCard;
            let data = {
                userId: userId
            };

            let rfidBlocked = await AxiosHandler.axiosPatchBody(host, data);

            console.log("Unblocked RFID ", rfidBlocked)
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
        };
    },
    verifyUnblockedRFID: async (userId) => {
        const context = "Function verifyUnblockedRFID";
        try {
            let host = process.env.HostUser + process.env.PathBlockRfidCard;
            let data = {
                userId: userId
            };

            let rfidBlocked = await AxiosHandler.axiosPatchBody(host, data);

            console.log("Blocked RFID ", rfidBlocked)
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
        };
    }
}
