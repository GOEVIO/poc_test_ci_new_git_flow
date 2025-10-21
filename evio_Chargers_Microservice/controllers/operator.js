const Operator = require('../models/operator');

module.exports = {
    addOperator: (req) => {
        let context = "Function addOperator";
        return new Promise((resolve, reject) => {

            let operator = req.body;

            valigateOperato(operator)
                .then(async () => {

                    let query = {
                        network: operator.network
                    };

                    let operatorFound = await Operator.findOne(query);

                    if (operatorFound) {

                        let operatorUpdated = await Operator.findOneAndUpdate(query, { $set: operator }, { new: true })

                        resolve(operatorUpdated);


                    } else {

                        let newOperator = new Operator(operator);

                        Operator.createOperator(newOperator, (err, operatorCreated) => {

                            if (err) {
                                console.error(`[${context}][createCharger] Error `, err.message);
                                reject(err)
                            };

                            resolve(operatorCreated);

                        })

                    }

                })
                .catch(error => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                })

        })
    },
    getOperator: (req) => {
        let context = "Function getOperator";
        return new Promise(async (resolve, reject) => {
            try {

                let query = req.query;
                let operatorsFound;

                if (query) {
                    operatorsFound = await Operator.find(query)
                } else {
                    operatorsFound = await Operator.find({})
                }

                resolve(operatorsFound);

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        })

    },
    updateOperator: (req) => {
        let context = "Function updateOperator";
        return new Promise(async (resolve, reject) => {
            try {

                let operator = req.body;
                let query = {
                    _id: operator._id
                };

                let operatorUpdated = await Operator.findOneAndUpdate(query, { $set: operator }, { new: true })

                resolve(operatorUpdated);

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        })

    },
    deleteOperator: (req) => {
        let context = "Function deleteOperator";
        return new Promise(async (resolve, reject) => {
            try {

                let operator = req.body;

                let query = {
                    _id: operator._id
                };
                Operator.removeOperator(query, (err, result) => {
                    if (err) {
                        console.error(`[${context}][createCharger] Error `, err.message);
                        reject(err)
                    };
                    if (result) {

                        resolve({ auth: true, code: 'server_operator_successfully_removed', message: "Operator successfully removed" });

                    }
                    else {

                        reject({ auth: false, code: 'server_operator_unsuccessfully_removed', message: "Operator unsuccessfully removed" });

                    };

                })



            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        })

    }
}


function valigateOperato(operator) {
    let context = "Function addOperator";
    return new Promise(async (resolve, reject) => {

        if (!operator)
            reject({ auth: false, code: 'server_operator_data_required', message: 'Operator data required' });

        if (!operator.operator)
            reject({ auth: false, code: 'server_operator_required', message: 'Operator is required' });

        if (!operator.partyId)
            reject({ auth: false, code: 'server_partyId_required', message: 'Operator partyId is required' });

        if (!operator.network)
            reject({ auth: false, code: 'server_network_required', message: 'Network is required' });

        else
            resolve(true);
    })
}