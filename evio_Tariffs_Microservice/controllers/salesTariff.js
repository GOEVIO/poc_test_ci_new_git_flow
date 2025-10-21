const SalesTariff = require('../models/salesTariff');
const axios = require("axios");
require("dotenv-safe").load();
const { Enums } = require('evio-library-commons').default;
const Constants = require('../utils/constants').default;
const { v4 : uuidv4 } = require('uuid');
const { transformEvioTariffToElements } = require('evio-library-tariffs').default;
module.exports = {
    addSalesTariff: function (req) {
        let context = "Funciton addSalesTariff";
        return new Promise((resolve, reject) => {

            var createUser = req.headers['userid'];
            var salesTariff = new SalesTariff(req.body);
            salesTariff.createUser = createUser;
            salesTariff.elements = transformEvioTariffToElements(salesTariff.tariff, salesTariff.tariffType);
            salesTariff.id = uuidv4();
            salesTariff.status = Enums.SalesTariffs.Status.Active
            salesTariff.type = Enums.OcpiTariffType.Regular;
            validateFields(salesTariff)
                .then(() => {

                    SalesTariff.createSalesTariff(salesTariff, (err, result) => {
                        if (err) {
                            console.error(`[${context}][createSalesTariff] Error `, err.message);
                            reject(err);
                        }
                        else {
                            if (result)
                                resolve(result);
                            else
                                reject({ auth: false, code: 'server_sales_tariff_not_created', message: "Sales tariff not created" });
                        };
                    });

                })
                .catch((error) => {

                    console.log(`[${context}][validateFields] Error `, error.message);
                    reject(error);

                });

        });
    },
    updateSalesTariff: function (req) {
        let context = "Funciton updateSalesTariff";
        return new Promise((resolve, reject) => {

            var userId = req.headers['userid'];
            var salesTariff = req.body;
            salesTariff.modifyUser = userId;

            if (salesTariff.evioCommission != undefined) {
                delete salesTariff.evioCommission;
            };

            var query = {
                _id: salesTariff._id
            };

            salesTariff.elements = transformEvioTariffToElements(salesTariff.tariff, salesTariff.tariffType);
            validateInUse(salesTariff._id)
                .then((value) => {
                    if (value) {
                        reject({ auth: false, code: 'server_tariff_in_use', message: "Tariff in use, cannot be edited" });
                    }
                    else {
                        var newValues = { $set: salesTariff };
                        salesTariffUpdate(query, newValues)
                            .then((result) => {

                                if (result) {
                                    updateTariffOnCharger(salesTariff);
                                    resolve(salesTariff);
                                }
                                else
                                    reject({ auth: false, code: 'server_sales_tariff_not_updated', message: "Sales tariff not updated" });
                            })
                            .catch((error) => {
                                console.error(`[${context}][salesTariffUpdate] Error `, error.message);
                                reject(error);

                            });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][validateInUse] Error `, error.message);
                    reject(error);
                });
        });
    },
    updateEvioCommission: function (req) {
        let context = "Funciton updateEvioCommission";
        return new Promise((resolve, reject) => {

            let received = req.body;

            let query = { createUser: received.userId };
            let newValues = { $set: { evioCommission: received.evioCommission } };

            SalesTariff.updateMany(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err.message);
                }
                else {
                    if (result.n === 0) {
                        resolve(false);
                    }
                    else {
                        updateNewEVIOCommission(received.userId);
                        reject(true);
                    };
                };
            });

        });
    },
    getSalesTariff: function (query) {
        let context = "Funciton getSalesTariff";
        return new Promise((resolve, reject) => {

            salesTariffFind(query)
                .then((tarifsFound) => {
                    resolve(tarifsFound);
                })
                .catch((error) => {
                    console.error(`[${context}][salesTariffFind] Error `, error.message);
                    reject(error);
                });

        });
    },
    getSalesTariffById: function (query) {
        let context = "Funciton getSalesTariffById";
        return new Promise((resolve, reject) => {

            salesTariffFindOne(query)
                .then((tariffFound) => {
                    if (tariffFound)
                        resolve(tariffFound);
                    else {
                        console.log(context, " query ", query)
                        resolve({});
                        //console.log("query", query)
                        //reject({ auth: false, code: 'server_no_sales_tariff', message: "No sales tariff Found" });
                    }
                })
                .catch((error) => {
                    console.log("query", query)
                    console.error(`[${context}][salesTariffFindOne] Error `, error.message);
                    reject(error);
                });

        });
    },
    getSalesTariffUsingFilter: function (req) {
        let context = "Funciton getSalesTariffUsingFilter";
        return new Promise((resolve, reject) => {

            var received = req.query
            var query = {
                $and: [
                    { 'tariff.chargingAmount.value': { $gte: received.min } },
                    { 'tariff.chargingAmount.value': { $lte: received.max } },
                ]
            };
            var fields = {
                _id: 1
            };

            SalesTariff.find(query, fields, (err, tariffsFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err.message);
                }
                else {
                    if (tariffsFound.length === 0) {
                        resolve([])
                    }
                    else {
                        var newListTariff = [];
                        Promise.all(
                            tariffsFound.map(tariff => {
                                return new Promise((resolve) => {
                                    newListTariff.push(tariff._id);
                                    resolve(true);
                                });
                            })
                        ).then(() => {
                            resolve(newListTariff);
                        });
                    };
                };
            });

        });
    },
    deleteSalesTariff: function (req) {
        let context = "Funciton deleteSalesTariff";
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid'];
            let query = req.body;
            validateInUse(query._id)
                .then((value) => {
                    if (value) {
                        reject({ auth: false, code: 'server_tariff_in_use_delete', message: "Tariff in use, cannot be deleted" });
                    }
                    else {

                        /*let data = {
                            userId: userId,
                            tariffId: query._id
                        };
                        removeSalesTariff(data)
                            .then(() => {*/

                        SalesTariff.removeSalesTariff(query, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result) {
                                    let data = {
                                        userId: userId,
                                        tariffId: query._id
                                    };
                                    removeSalesTariff(data);
                                    resolve({ auth: true, code: 'server_successfully_deleted', message: "Tariffs successfully deleted." });
                                }
                                else {
                                    reject({ auth: false, code: 'server_unsuccessfully_deleted', message: "Tariffs unsuccessfully deleted." });
                                }
                            };
                        });

                        /*})
                        .catch((error) => {
                            console.error(`[${context}][validateInUse] Error `, error.message);
                            reject(error);
                        })*/
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][validateInUse] Error `, error.message);
                    reject(error);
                });

        });
    },
    deleteSalesTariffByUser: function (req) {
        let context = "Funciton deleteSalesTariffByUser";
        return new Promise((resolve, reject) => {

            var userId = req.headers['userid'];
            var query = {
                createUser: userId
            };

            salesTariffFind(query)
                .then((tariffsFound) => {
                    if (tariffsFound.length === 0) {
                        resolve([]);
                    }
                    else {
                        Promise.all(
                            tariffsFound.map(tariff => {
                                return new Promise((resolve, reject) => {
                                    var query = {
                                        _id: tariff._id
                                    };
                                    SalesTariff.removeSalesTariff(query, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}] Error `, err.message);
                                            reject(err)
                                        }
                                        else {
                                            if (result) {
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            }
                                        };
                                    });
                                });
                            })
                        ).then((result) => {
                            resolve(result);
                        }).catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error.message);
                        });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][salesTariffFind] Error `, error.message);
                    reject(error.message);
                });

        });
    },
    runFirstTime: function (req) {
        let context = "Funciton runFirstTime";
        return new Promise((resolve, reject) => {

            runFirstTime();
            resolve();

        });
    }
}

//========== FUNCTION ==========
//Function to validate fields received
function validateFields(salesTariff) {
    return new Promise((resolve, reject) => {
        if (!salesTariff)
            reject({ auth: false, code: 'server_salesTariff_data_required', message: "SalesTariff data required" });
        else if (!salesTariff.tariffType)
            reject({ auth: false, code: 'server_tariff_type_required', message: "Tariff type required" });
        else if (salesTariff.tariff === undefined)
            reject({ auth: false, code: 'server_tariff_data_required', message: "Tariff data required" });
        else
            resolve(true);
    });
};

function validateInUse(tariffId) {
    var context = "Function validateInUse";
    return new Promise((resolve, reject) => {
        try {
            var host = Constants.chargers.host + Constants.chargers.paths.chargingSessionValidateTariff;
            var data = {
                tariffId: tariffId,
                $or: [
                    { status: Enums.OcppSessionStatuses.sessionStatusToStart },
                    { status: Enums.OcppSessionStatuses.sessionStatusRunning },
                    { status: Enums.OcppSessionStatuses.sessionStatusToStop }
                ]
            };
            axios.get(host, { data })
                .then((result) => {

                    if (result.data.length == 0) {
                        resolve(false);
                    }
                    else {
                        resolve(true);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error)
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error)
        };
    });
};

//Function to update sales tariff
function salesTariffUpdate(query, newValue) {
    var context = "Function salesTariffFindOne";
    return new Promise((resolve, reject) => {
        SalesTariff.updateSalesTariff(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function updateTariffOnCharger(salesTariff) {
    var context = "Function updateTariffOnCharger";
    try {

        //console.log("salesTariff", salesTariff);
        let data = salesTariff;
        let host = Constants.chargers.host + Constants.chargers.paths.editTariff;

        axios.patch(host, data)
            .then((result) => {

                console.log(`[${context}][${host}] Tariffs Updated`);

            })
            .catch((error) => {

                console.error(`[${context}][${host}] Error `, error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

function updateNewEVIOCommission(userId) {
    var context = "Function updateNewEVIOCommission";
    try {

        let query = { createUser: userId };

        SalesTariff.find(query, (err, salesTariffFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {

                salesTariffFound.map(salesTariff => {
                    updateTariffOnCharger(salesTariff);
                });

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);

    };
};

//Function to find sales tariff
function salesTariffFind(query) {
    var context = "Function salesTariffFind";
    return new Promise((resolve, reject) => {
        SalesTariff.find(query, (err, tariffsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(tariffsFound);
            };
        });
    });
};

//Function to find one sales tariff
function salesTariffFindOne(query) {
    var context = "Function salesTariffFindOne";
    return new Promise((resolve, reject) => {
        SalesTariff.findOne(query, (err, tariffFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(tariffFound);
            };
        });
    });
};

function removeSalesTariff(data) {
    let context = "Function removeSalesTariff";
    /*return new Promise((resolve, reject) => {
        try {*/

    let host = Constants.chargers.host + Constants.chargers.paths.removeTariff;
    axios.patch(host, data)
        .then((result) => {
            if (result.data) {
                console.error(`[${context}] Tariff removed from chargers`);
                //  resolve(true);
            }
            else {
                console.error(`[${context}] Tariff not removed from chargers`);
                // reject({ auth: false, code: 'server_unsuccessfully_deleted_from_chargers', message: "Tariff not removed from chargers" });
            };
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
        });

    /*} catch (error) {
        console.error(`[${context}] Error `, error.message);
        reject(error);
    }
});*/
};

//runFirstTime()
function runFirstTime() {

    SalesTariff.find({})
        .then(result => {
            if (result.length > 0) {
                result.map(tariff => {

                    tariff.tariff.activationFee = 0;
                    tariff.tariff.parkingDuringChargingAmount.uom = 'min';
                    tariff.tariff.parkingDuringChargingAmount.value = 0;

                    SalesTariff.updateSalesTariff({ _id: tariff._id }, { $set: tariff }, (err, result) => {
                        if (err)
                            console.error("Error ", err.message);

                        updateTariffOnCharger(tariff);
                        console.log("Tariff Updated");
                    });

                })
            };
        })
        .catch(error => {
            console.error("Error ", error.message);
        });

};
