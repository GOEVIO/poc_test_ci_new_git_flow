const DataPlugStatusChange = require('../models/dataPlugStatusChange')
const StatusMapping = require('../utils/statusPlugMapping.json')

module.exports = {
    saveDataPlugStatusChange: (req) => {
        let context = "Function EVIO saveDataPlugStatusChange";
        return new Promise(async (resolve, reject) => {
            try {

                let status = req.body.status;
                let dataPlugStatusChange = new DataPlugStatusChange(req.body);

                dataPlugStatusChange.status = StatusMapping[status];
                DataPlugStatusChange.createDataPlugStatusChangeModel(dataPlugStatusChange, (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err);
                    }

                    resolve(result)
                })

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    }
}