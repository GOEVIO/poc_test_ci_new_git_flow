const ManagementPOIs = require('../models/managementPOIs');
require("dotenv-safe").load();

module.exports = {
    addManagementPOIs: function (req) {
        let context = "Funciton addManagementPOIs";
        return new Promise((resolve, reject) => {

            var managementPOIs = new ManagementPOIs(req.body);
            var userId = req.headers['userid'];
            managementPOIs.userId = userId;

            ManagementPOIs.disableAllConfigs((err, result) => {
                if (err) {

                    console.log(`[${context}][disableAllConfigs] Error `, err.message);
                    reject(err);

                }
                else {

                    ManagementPOIs.createManagementPOIs(managementPOIs, (err, result) => {
                        if (err) {

                            console.log(`[${context}][createManagementPOIs] Error `, err.message);
                            reject(err);

                        }
                        else {

                            resolve(result);

                        };

                    });

                };
            });

        });
    },
    getManagementPOIs: function (req) {
        let context = "Funciton getManagementPOIs";
        return new Promise((resolve, reject) => {

            var query = { active: true };

            ManagementPOIs.find(query, (err, result) => {
    
                if (err) {
    
                    console.log(`[${context}][ManagementPOIs.find] Error `, err.message);
                    reject(err);
    
                }
                else {
    
                    resolve(result);
    
                };
                
            });

        });
    }
}