const { logger } = require('../utils/constants');

module.exports = {
    ErrorHandler: function (error, res) {
        let context = "Function ErrorHandler";
        //return new Promise((resolve, reject)=>{

        if (error.auth === false) {

            console.log(`[${context}] [Status 400] Error `, error.message);
            return res.status(400).send(error);

        }
        else {

            if (error.response) {

                console.log(`[${context}] [Status 400] Error `, error.response.data);
                return res.status(400).send(error.response.data);

            }
            else {

                console.log(`[${context}] [Status 500] Error `, error.message);
                return res.status(500).send(error.message);

            };

        };

        //});
    }
};
