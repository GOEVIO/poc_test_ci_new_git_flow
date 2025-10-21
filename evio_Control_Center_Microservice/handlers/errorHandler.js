require("dotenv-safe").load();
module.exports = {
    ErrorHandler: function (error, res) {
        let context = "Function ErrorHandler";
        //return new Promise((resolve, reject)=>{

        if (error.auth === false) {

            console.error(`[${context}] [Status 400] Error `, error.message);
            return res.status(400).send(error);

        }
        else {

            if (error.response) {

                console.error(`[${context}] [Status 400] Error `, error.response.data);
                return res.status(400).send(error.response.data);

            }
            else {

                console.error(`[${context}] [Status 500] Error `, error.message);
                return res.status(500).send(error.message);

            };

        };

        //});
    }
};

//========== FUNCTION ==========