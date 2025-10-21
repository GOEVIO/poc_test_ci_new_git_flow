const Notification = require('../models/notifications');

module.exports = {
    handle: async function (req, res, wss, eventEmitter) {
        const context = "Get Logs";

        try {
            const { hwId , startDate , stopDate , type , plugId , success} = req.body
            let query = {
                $and : [
                    hwId ? {hwId} : {},
                    startDate ? { timestamp: { $gte: startDate } } : {},
                    stopDate ? { timestamp: { $lte: stopDate } } : {},
                    type ? {type} : {},
                    plugId ? {plugId} : {},
                    success !== null && success !== undefined ? {success : success === "true"} : {},
                ]
            }

            let logs = await Notification.find(query, {__v : 0 , createdAt : 0 , updatedAt : 0 , hwId : 0 , unread : 0 , _id : 0}).lean()
            return res.status(200).send(logs);
        
        } catch (error) {
            console.error(`[${context}] Error ${error.message}` )
            return res.status(500).send(error.message);
            
        }
    }
}
