const PurchaseTariff = require('../models/purchaseTariff');
const axios = require("axios");
require("dotenv-safe").load();
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
const Constants = require('../utils/constants').default;

module.exports = {
    addPurchaseTariff: function (req) {
        let context = "Funciton addSalesTariff";
        return new Promise((resolve, reject) => {

            var userId = req.headers['userid'];

            if (req.body.weekSchedule.length !== 0) {
                let newWeekSchedule = handleImportedValues(req.body.weekSchedule);
                req.body.weekSchedule = newWeekSchedule;
            }

            var purchaseTariff = new PurchaseTariff(req.body);
            purchaseTariff.userId = userId;

            validateFields(purchaseTariff)
                .then(() => {

                    PurchaseTariff.createPurchaseTariff(purchaseTariff, (err, result) => {
                        if (err) {
                            console.error(`[${context}][createPurchaseTariff] Error `, err.message);
                            reject(err);
                        }
                        else {
                            if (result)
                                resolve(result);
                            else
                                reject({ auth: false, code: 'server_purchase_tariff_not_created', message: "Purchase tariff not created" });
                        };
                    });

                })
                .catch((error) => {

                    console.log(`[${context}][validateFields] Error `, error.message);
                    reject(error);

                });

        });
    },
    getPurchaseTariff: function (query) {
        let context = "Funciton getPurchaseTariff";
        return new Promise((resolve, reject) => {

            purchaseTariffFind(query)
                .then((tarifsFound) => {
                    resolve(tarifsFound);
                })
                .catch((error) => {
                    console.error(`[${context}][purchaseTariffFind] Error `, error.message);
                    reject(error);
                });

        });
    },
    getPurchaseTariffById: function (query) {
        let context = "Funciton getPurchaseTariffById";
        return new Promise((resolve, reject) => {

            purchaseTariffFindOne(query)
                .then((tariffFound) => {
                    if (tariffFound)
                        resolve(tariffFound);
                    else
                        reject({ auth: true, code: 'server_no_purchase_tariff', message: "No purchase tariff found" });
                })
                .catch((error) => {
                    console.error(`[${context}][purchaseTariffFindOne] Error `, error.message);
                    reject(error);
                });

        });
    },
    updatePurchaseTariff: function (req) {
        let context = "Funciton updatePurchaseTariff";
        return new Promise((resolve, reject) => {

            var userId = req.headers['userid'];
            var purchaseTariff = req.body;

            var query = {
                _id: purchaseTariff._id
            };
            var newValues = { $set: purchaseTariff };

            purchaseTariffUpdate(query, newValues)
                .then((result) => {
                    if (result) {
                        updatePurchaseTariffOnCharger(purchaseTariff);
                        resolve(result);
                    }
                    else {
                        reject({ auth: false, code: 'server_purchase_tariff_not_updated', message: "Purchase tariff not updated" });
                    }
                })
                .catch((error) => {
                    console.error(`[${context}][purchaseTariffUpdate] Error `, error.message);
                    reject(error);
                });

        });
    },
    deletePurchaseTariffById: function (req) {
        let context = "Funciton deletePurchaseTariffById";
        return new Promise((resolve, reject) => {

            var purchaseTariff = req.body;

            var query = {
                _id: purchaseTariff._id
            };

            purchaseTariffDelete(query)
                .then((result) => {
                    if (result) {
                        resolve(result);
                    }
                    else {
                        reject({ auth: false, code: 'server_purchase_tariff_not_deleted', message: "Purchase tariff not deleted" });
                    }
                })
                .catch((error) => {
                    console.error(`[${context}][purchaseTariffDelete] Error `, error.message);
                    reject(error);
                });

        });
    },
    runFirstTime: function (req) {
        let context = "Function runFirstTime";
        return new Promise((resolve, reject) => {

            runFirstTime();
            resolve();

        });
    },
    addPurchaseTariffCost: function (req) {
        let context = "Funciton addPurchaseTariffCost";
        return new Promise((resolve, reject) => {

            var userId = req.headers['userid'];
            var purchaseTariffCost = req.body;

            var query = {
                _id: purchaseTariffCost._id
            };

            purchaseTariffFindOne(query)
                .then((tariffFound) => {
                    let tariffWeekSchedule = tariffFound.weekSchedule;
                    let newTariffWeekSchedule = purchaseTariffCost.weekSchedule;

                    newTariffWeekSchedule.forEach(newWeekSchedule => {

                        let weekDay = newWeekSchedule.weekDay;
                        let element = tariffWeekSchedule.find(item => item.weekDay == weekDay);

                        if (element) {
                            let scheduleTime = element.scheduleTime
                            let newScheduleTime = newWeekSchedule.scheduleTime;
                            let addNewCostFlag = true;

                            let promises = [];

                            for (let new_index = 0; new_index < newScheduleTime.length; new_index++) {
                                const newTime = newScheduleTime[new_index];

                                promises.push(new Promise(function (resolve, reject) {

                                    let new_value = newTime.value;
                                    let new_startTime = moment(newTime.startTime, 'HH:mm');
                                    //let new_stopTime = moment(newTime.stopTime, 'HH:mm');

                                    if (newTime.stopTime === '00:00') {
                                        new_stopTime = moment(newTime.stopTime, 'HH:mm').add(1, 'days');
                                    }
                                    else {
                                        //moment(elementUpdateEnd.stopTime, 'HH:mm'))
                                        new_stopTime = moment(newTime.stopTime, 'HH:mm');
                                    }

                                    //Verifica se existem ja 2 elementos no array cujo o startTime e stopTime já existam e , se o valor for igual, cria
                                    //apenas um elemento com o novo range
                                    let elementUpdateStart = scheduleTime.find(item => item.stopTime === newTime.startTime && item.value === new_value);
                                    let elementUpdateEnd = scheduleTime.find(item => item.startTime === newTime.stopTime && item.value === new_value);

                                    if (elementUpdateStart && elementUpdateEnd && checkSameElementDuplicate(elementUpdateStart, elementUpdateEnd)) {

                                        addNewCostFlag = false;

                                        let stopTime;
                                        if (elementUpdateEnd.stopTime === '00:00') {
                                            stopTime = moment(elementUpdateEnd.stopTime, 'HH:mm').add(1, 'days');
                                        }
                                        else {
                                            //moment(elementUpdateEnd.stopTime, 'HH:mm'))
                                            stopTime = moment(elementUpdateEnd.stopTime, 'HH:mm');
                                        }

                                        const new_date_range = moment.range(moment(elementUpdateStart.startTime, 'HH:mm'), stopTime);

                                        let index_elementUpdateStart = element.scheduleTime.indexOf(elementUpdateStart);
                                        let scheduleTimeAux = removeElementFromArray(element.scheduleTime, index_elementUpdateStart);

                                        let index_elementUpdateEnd = scheduleTimeAux.indexOf(elementUpdateEnd);
                                        scheduleTimeAux = removeElementFromArray(scheduleTimeAux, index_elementUpdateEnd);

                                        let elementToRemove = scheduleTime.find(item => item.startTime === newTime.startTime && item.stopTime === newTime.stopTime);
                                        let index_elementToRemove = scheduleTimeAux.indexOf(elementToRemove);
                                        scheduleTimeAux = removeElementFromArray(scheduleTimeAux, index_elementToRemove);

                                        let new_info = {
                                            value: new_value,
                                            startTime: (new_date_range.start).format('HH:mm'),
                                            stopTime: (new_date_range.end).format('HH:mm')
                                        }
                                        scheduleTimeAux.push(new_info);

                                        let tariffUpdated = tariffWeekSchedule.map(item => {
                                            if (item.weekDay === weekDay) {
                                                item.scheduleTime = scheduleTimeAux;
                                                item.scheduleTime.sort(orderWeekScheduleArray);
                                            }
                                            return item;
                                        });

                                        var query = {
                                            _id: tariffFound._id
                                        };

                                        updateTariffWeekSchedule(query, tariffUpdated)
                                            .then(() => {
                                                resolve()
                                            }).catch(() => {
                                                reject();
                                            });

                                    }
                                    else {

                                        //Verifica se já existe um elemento no array com o startTime e stopTime iguais ao que são recebidos
                                        let elementUpdate = scheduleTime.find(item => item.startTime === newTime.startTime && item.stopTime === newTime.stopTime);

                                        if (elementUpdate) {

                                            addNewCostFlag = false;

                                            //Procura no array se existem elementos cujo o startTime e o stopTime coincidem e têm o mesmo valor
                                            let elementUpdateStart = scheduleTime.find(item => item.stopTime === newTime.startTime && item.value == new_value);
                                            let elementUpdateEnd = scheduleTime.find(item => item.startTime === newTime.stopTime && item.value == new_value);

                                            //Existe um elemento no array cujo o stopTime coincide com o startTime recebido e com o mesmo valor
                                            if (elementUpdateStart) {

                                                let stopTime;
                                                if (elementUpdateStart.stopTime === '00:00') {
                                                    stopTime = moment(elementUpdateStart.stopTime, 'HH:mm').add(1, 'days');
                                                }
                                                else {
                                                    //moment(elementUpdateEnd.stopTime, 'HH:mm'))
                                                    stopTime = moment(elementUpdateStart.stopTime, 'HH:mm');
                                                }

                                                const element_range = moment.range(moment(elementUpdateStart.startTime, 'HH:mm'), stopTime);
                                                const new_range = moment.range(moment(new_startTime, 'HH:mm'), moment(new_stopTime, 'HH:mm'));

                                                let new_date_range = element_range.add(new_range, { adjacent: true });

                                                let index_remove = element.scheduleTime.indexOf(elementUpdateStart);
                                                let scheduleTimeAux = removeElementFromArray(element.scheduleTime, index_remove);

                                                let elementToRemove = scheduleTime.find(item => item.startTime === newTime.startTime && item.stopTime === newTime.stopTime);
                                                let index_elementToRemove = scheduleTimeAux.indexOf(elementToRemove);
                                                scheduleTimeAux = removeElementFromArray(scheduleTimeAux, index_elementToRemove);

                                                let new_info = {
                                                    value: new_value,
                                                    startTime: (new_date_range.start).format('HH:mm'),
                                                    stopTime: (new_date_range.end).format('HH:mm')
                                                }
                                                scheduleTimeAux.push(new_info);

                                                let tariffUpdated = tariffWeekSchedule.map(item => {
                                                    if (item.weekDay === weekDay) {
                                                        item.scheduleTime = scheduleTimeAux;
                                                        item.scheduleTime.sort(orderWeekScheduleArray);
                                                    }
                                                    return item;
                                                });

                                                var query = {
                                                    _id: tariffFound._id
                                                };

                                                updateTariffWeekSchedule(query, tariffUpdated)
                                                    .then(() => {
                                                        resolve()
                                                    }).catch(() => {
                                                        reject();
                                                    });

                                            }
                                            else {

                                                //Existe um elemento no array cujo o startTime coincide com o stopTime recebido e com o mesmo valor
                                                if (elementUpdateEnd) {

                                                    let stopTime;
                                                    if (elementUpdateEnd.stopTime === '00:00') {
                                                        stopTime = moment(elementUpdateEnd.stopTime, 'HH:mm').add(1, 'days');
                                                    }
                                                    else {
                                                        //moment(elementUpdateEnd.stopTime, 'HH:mm'))
                                                        stopTime = moment(elementUpdateEnd.stopTime, 'HH:mm');
                                                    }

                                                    const element_range = moment.range(moment(elementUpdateEnd.startTime, 'HH:mm'), stopTime);
                                                    const new_range = moment.range(moment(new_startTime, 'HH:mm'), moment(new_stopTime, 'HH:mm'));

                                                    let new_date_range = element_range.add(new_range, { adjacent: true });

                                                    let index_remove = element.scheduleTime.indexOf(elementUpdateEnd);
                                                    let scheduleTimeAux = removeElementFromArray(element.scheduleTime, index_remove);

                                                    let elementToRemove = scheduleTime.find(item => item.startTime === newTime.startTime && item.stopTime === newTime.stopTime);
                                                    let index_elementToRemove = scheduleTimeAux.indexOf(elementToRemove);
                                                    scheduleTimeAux = removeElementFromArray(scheduleTimeAux, index_elementToRemove);

                                                    let new_info = {
                                                        value: new_value,
                                                        startTime: (new_date_range.start).format('HH:mm'),
                                                        stopTime: (new_date_range.end).format('HH:mm')
                                                    }
                                                    scheduleTimeAux.push(new_info);

                                                    let tariffUpdated = tariffWeekSchedule.map(item => {
                                                        if (item.weekDay === weekDay) {
                                                            item.scheduleTime = scheduleTimeAux;
                                                            item.scheduleTime.sort(orderWeekScheduleArray);
                                                        }
                                                        return item;
                                                    });

                                                    var query = {
                                                        _id: tariffFound._id
                                                    };

                                                    updateTariffWeekSchedule(query, tariffUpdated)
                                                        .then(() => {
                                                            resolve()
                                                        }).catch(() => {
                                                            reject();
                                                        });

                                                }
                                                else {

                                                    //O elemento identificado tem o mesmo startTime e stopTime daquele que é recebido e muda apenas o valor para
                                                    //o novo valor recebido
                                                    let updatedScheduleTime = scheduleTime.map(item => {
                                                        if (item.startTime === newTime.startTime && item.stopTime === newTime.stopTime) {
                                                            item.value = newTime.value;
                                                        }
                                                        return item;
                                                    });

                                                    let tariffUpdated = tariffWeekSchedule.map(item => {
                                                        if (item.weekDay === weekDay) {
                                                            item.scheduleTime = updatedScheduleTime;
                                                            //item.scheduleTime.sort(orderWeekScheduleArray);
                                                        }
                                                        return item;
                                                    });

                                                    var query = {
                                                        _id: tariffFound._id
                                                    };

                                                    updateTariffWeekSchedule(query, tariffUpdated)
                                                        .then(() => {
                                                            resolve()
                                                        }).catch(() => {
                                                            reject();
                                                        });

                                                }
                                            }

                                        }
                                        else {

                                            let promises2 = [];
                                            let scheduleTimeAuxList = scheduleTime.slice();

                                            //Percorre o array existente para identifcar que ação tem de ser realizada
                                            for (let index = 0; index < scheduleTime.length; index++) {

                                                promises2.push(new Promise(function (resolve, reject) {

                                                    const time = scheduleTime[index];

                                                    let value = time.value;
                                                    let startTime = moment(time.startTime, 'HH:mm');
                                                    //let stopTime = moment(time.stopTime, 'HH:mm');

                                                    let stopTime;
                                                    if (time.stopTime === '00:00') {
                                                        stopTime = moment(time.stopTime, 'HH:mm').add(1, 'days');
                                                    }
                                                    else {
                                                        stopTime = moment(time.stopTime, 'HH:mm');
                                                    }

                                                    const new_global_range = moment.range(new_startTime, new_stopTime);

                                                    if (startTime.within(new_global_range) && stopTime.within(new_global_range)) {

                                                        addNewCostFlag = true;

                                                        let element_to_remove = scheduleTimeAuxList.find(item => item.startTime == (startTime).format('HH:mm')
                                                            && item.stopTime == (stopTime).format('HH:mm'));
                                                        let index_to_remove = scheduleTimeAuxList.indexOf(element_to_remove);
                                                        scheduleTimeAuxList = removeElementFromArray(scheduleTimeAuxList, index_to_remove);
                                                        let scheduleTimeAux = scheduleTimeAuxList;

                                                        let tariffUpdated = tariffWeekSchedule.map(item => {
                                                            if (item.weekDay === weekDay) {
                                                                item.scheduleTime = scheduleTimeAux;
                                                                //console.log(scheduleTimeAux);
                                                                item.scheduleTime.sort(orderWeekScheduleArray);
                                                            }
                                                            return item;
                                                        });

                                                        var query = {
                                                            _id: tariffFound._id
                                                        };

                                                        updateTariffWeekSchedule(query, tariffUpdated)
                                                            .then(() => {
                                                                resolve()
                                                            }).catch(() => {
                                                                reject();
                                                            });

                                                    }
                                                    else {

                                                        if (startTime.within(new_global_range) || stopTime.within(new_global_range)) {

                                                            addNewCostFlag = true;

                                                            const range = moment.range(startTime, stopTime);
                                                            let new_date_range = range.subtract(new_global_range);

                                                            let element_to_remove = scheduleTimeAuxList.find(item => item.startTime == (startTime).format('HH:mm')
                                                                && item.stopTime == (stopTime).format('HH:mm'));
                                                            let index_to_remove = scheduleTimeAuxList.indexOf(element_to_remove);
                                                            scheduleTimeAuxList = removeElementFromArray(scheduleTimeAuxList, index_to_remove);
                                                            let scheduleTimeAux = scheduleTimeAuxList;

                                                            new_date_range.forEach(new_date => {
                                                                let old_info = {
                                                                    value: value,
                                                                    startTime: (new_date.start).format('HH:mm'),
                                                                    stopTime: (new_date.end).format('HH:mm')
                                                                }
                                                                scheduleTimeAux.push(old_info);
                                                            });

                                                            let tariffUpdated = tariffWeekSchedule.map(item => {
                                                                if (item.weekDay === weekDay) {
                                                                    item.scheduleTime = scheduleTimeAux;
                                                                    //console.log(scheduleTimeAux);
                                                                    item.scheduleTime.sort(orderWeekScheduleArray);
                                                                }
                                                                return item;
                                                            });

                                                            var query = {
                                                                _id: tariffFound._id
                                                            };

                                                            updateTariffWeekSchedule(query, tariffUpdated)
                                                                .then(() => {
                                                                    resolve();
                                                                }).catch(() => {
                                                                    reject();
                                                                });

                                                        }
                                                        else {

                                                            const range = moment.range(startTime, stopTime);

                                                            //Verifica se o time range recebido esta incluido em algum dos elementos do array e com um valor diferente
                                                            //Se tiver, então faz a subtração do time range e separa os elementos por valor
                                                            if (range.contains(new_startTime) && range.contains(new_stopTime) && value !== new_value) {

                                                                addNewCostFlag = false;

                                                                const new_range = moment.range(new_startTime, new_stopTime);
                                                                let new_date_range = range.subtract(new_range);
                                                                let scheduleTimeAux = removeElementFromArray(element.scheduleTime, index);

                                                                new_date_range.forEach(new_date => {
                                                                    let old_info = {
                                                                        value: value,
                                                                        startTime: (new_date.start).format('HH:mm'),
                                                                        stopTime: (new_date.end).format('HH:mm')
                                                                    }
                                                                    scheduleTimeAux.push(old_info);
                                                                });

                                                                let new_info = {
                                                                    value: new_value,
                                                                    startTime: (new_startTime).format('HH:mm'),
                                                                    stopTime: (new_stopTime).format('HH:mm')
                                                                }
                                                                scheduleTimeAux.push(new_info);

                                                                let tariffUpdated = tariffWeekSchedule.map(item => {
                                                                    if (item.weekDay === weekDay) {
                                                                        item.scheduleTime = scheduleTimeAux;
                                                                        item.scheduleTime.sort(orderWeekScheduleArray);
                                                                    }
                                                                    return item;
                                                                });

                                                                var query = {
                                                                    _id: tariffFound._id
                                                                };

                                                                updateTariffWeekSchedule(query, tariffUpdated)
                                                                    .then(() => {
                                                                        resolve()
                                                                    }).catch(() => {
                                                                        reject();
                                                                    });

                                                            }
                                                            else {

                                                                //Verifica se algum do startTime ou stopTime recebidos esta incluido no time range do elemento
                                                                //Se tiver, entao faz a adição do time range e cria apenas um elemento
                                                                if ((range.contains(new_startTime) || range.contains(new_stopTime)) && value === new_value) {

                                                                    addNewCostFlag = false;

                                                                    const new_range = moment.range(new_startTime, new_stopTime);

                                                                    let new_date_range = range.add(new_range, { adjacent: true });
                                                                    let scheduleTimeAux = removeElementFromArray(element.scheduleTime, index);

                                                                    let new_info = {
                                                                        value: value,
                                                                        startTime: (new_date_range.start).format('HH:mm'),
                                                                        stopTime: (new_date_range.end).format('HH:mm')
                                                                    }
                                                                    scheduleTimeAux.push(new_info);

                                                                    let tariffUpdated = tariffWeekSchedule.map(item => {
                                                                        if (item.weekDay === weekDay) {
                                                                            item.scheduleTime = scheduleTimeAux;
                                                                            item.scheduleTime.sort(orderWeekScheduleArray);
                                                                        }
                                                                        return item;
                                                                    });

                                                                    var query = {
                                                                        _id: tariffFound._id
                                                                    };

                                                                    updateTariffWeekSchedule(query, tariffUpdated)
                                                                        .then(() => {
                                                                            resolve()
                                                                        }).catch(() => {
                                                                            reject();
                                                                        });

                                                                }
                                                                else {
                                                                    resolve(true);
                                                                }

                                                            }

                                                        }

                                                    }

                                                }));

                                            }

                                            Promise.all(promises2)
                                                .then(() => {

                                                    if (new_index + 1 === newScheduleTime.length) {

                                                        //Verifica se alguma das operações acima foi realizada
                                                        //Caso nao tenham sido, entao este é um novo elemento para ser adicionado ao array
                                                        if (addNewCostFlag) {

                                                            let new_cost = {
                                                                value: newTime.value,
                                                                startTime: newTime.startTime,
                                                                stopTime: newTime.stopTime
                                                            }
                                                            let scheduleTimeAux = element.scheduleTime.push(new_cost);

                                                            scheduleTimeAux = checkConnections(element.scheduleTime);

                                                            tariffUpdated = tariffWeekSchedule.map(item => {
                                                                if (item.weekDay === weekDay) {
                                                                    item.scheduleTime = scheduleTimeAux;
                                                                    item.scheduleTime.sort(orderWeekScheduleArray);
                                                                }
                                                                return item;
                                                            });

                                                            var query = {
                                                                _id: tariffFound._id
                                                            };

                                                            updateTariffWeekSchedule(query, tariffUpdated)
                                                                .then(() => {
                                                                    resolve()
                                                                }).catch(() => {
                                                                    reject();
                                                                });

                                                        }
                                                        else {

                                                            let scheduleTimeAux = checkConnections(element.scheduleTime);

                                                            tariffUpdated = tariffWeekSchedule.map(item => {
                                                                if (item.weekDay === weekDay) {
                                                                    item.scheduleTime = scheduleTimeAux;
                                                                    item.scheduleTime.sort(orderWeekScheduleArray);
                                                                }
                                                                return item;
                                                            });

                                                            var query = {
                                                                _id: tariffFound._id
                                                            };

                                                            updateTariffWeekSchedule(query, tariffUpdated)
                                                                .then(() => {
                                                                    resolve()
                                                                }).catch(() => {
                                                                    reject();
                                                                });

                                                        }
                                                    }

                                                })
                                                .catch(() => {
                                                    reject();
                                                });

                                        }

                                    }

                                }));

                            }

                            Promise.all(promises)
                                .then(() => {

                                    let query = {
                                        _id: purchaseTariffCost._id
                                    };

                                    purchaseTariffFindOne(query)
                                        .then((tariffFound) => {
                                            console.log("Cost Tariff updated with success");
                                            updatePurchaseTariffOnCharger(tariffFound);
                                            resolve(tariffFound);
                                        });

                                })
                                .catch(() => {
                                    console.error(`[${context}][purchaseTariffUpdate] Error `, 'Failed to update cost');
                                    reject('Failed to update cost');
                                });

                        }
                        else {
                            tariffFound.weekSchedule.push(newWeekSchedule);

                            var query = {
                                _id: tariffFound._id
                            };
                            var newValues = { $set: tariffFound };

                            purchaseTariffUpdate(query, newValues)
                                .then((result) => {
                                    if (result) {
                                        updatePurchaseTariffOnCharger(tariffFound);
                                        resolve(result);
                                    }
                                    else {
                                        reject({ auth: false, code: 'server_purchase_tariff_not_updated', message: "Purchase tariff not updated" });
                                    }
                                })
                                .catch((error) => {
                                    console.error(`[${context}][purchaseTariffUpdate] Error `, error.message);
                                    reject(error);
                                });
                        }

                    });

                })
                .catch((error) => {
                    console.error(`[${context}][purchaseTariffFind] Error `, error.message);
                    reject(error);
                });

        });
    }
}

//========== FUNCTION ==========
//runFirstTime()
function runFirstTime() {
    console.log("Nothing to proccess");
};

//Function to validate fields received
function validateFields(purchaseTariff) {
    return new Promise((resolve, reject) => {
        if (!purchaseTariff)
            reject({ auth: false, code: 'server_purchaseTariff_data_required', message: "PurchaseTariff data required" });
        else if (!purchaseTariff.name)
            reject({ auth: false, code: 'server_purchaseTariff_name_required', message: "PurchaseTariff name required" });
        /*else if (!purchaseTariff.description)
             reject({ auth: false, code: 'server_purchaseTariff_description_required', message: "PurchaseTariff description required" });*/
        else if (!purchaseTariff.tariffType)
            reject({ auth: false, code: 'server_purchaseTariff_type_required', message: "PurchaseTariff type required" });
        else
            resolve(true);
    });
};

//Function to find purchase tariff
function purchaseTariffFind(query) {
    var context = "Function purchaseTariffFind";
    return new Promise((resolve, reject) => {
        PurchaseTariff.find(query, (err, tariffsFound) => {
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

//Function to find one purchase tariff
function purchaseTariffFindOne(query) {
    var context = "Function purchaseTariffFindOne";
    return new Promise((resolve, reject) => {
        PurchaseTariff.findOne(query, (err, tariffFound) => {
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

//Function to update purchase tariff
function purchaseTariffUpdate(query, newValue) {
    var context = "Function purchaseTariffUpdate";
    return new Promise((resolve, reject) => {
        PurchaseTariff.updatePurchaseTariff(query, newValue, { new: true }, (err, result) => {
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

//Function to update purchase tariff
function purchaseTariffDelete(query) {
    var context = "Function purchaseTariffDelete";
    return new Promise((resolve, reject) => {
        PurchaseTariff.removePurchaseTariff(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {

                if (result.deletedCount === 0) {
                    reject({
                        code: "400",
                        message: "Purchase tariff not deleted"
                    });
                }
                else {
                    resolve({
                        code: "200",
                        message: "Purchase tariff removed with success"
                    });
                }

            }
        });
    });
};

//Function to upda purchase tariff on chargers
function updatePurchaseTariffOnCharger(purchaseTariff) {
    var context = "Function updatePurchaseTariffOnCharger";

    let data = purchaseTariff;
    let host = Constants.chargers.host + Constants.chargers.paths.updatePurchaseTariff;

    axios.patch(host, data)
        .then(response => {
            console.log("Tariff updated!")
        })
        .catch(error => {
            console.error(`[${context}] Error `, error.message);
        })
}

function removeElementFromArray(array, index) {
    let array_aux = array.slice();;
    if (index > -1) {
        array_aux.splice(index, 1);
    }
    return array_aux;
}

function orderWeekScheduleArray(e1, e2) {
    return new moment(e1.startTime, 'HH:mm').valueOf() - moment(e2.startTime, 'HH:mm').valueOf();
}

function checkConnections(array) {
    let aux = [];

    for (let index = 0; index < array.length; index++) {
        const element = array[index];

        let new_element = aux.find(new_element =>
            (element.startTime === new_element.stopTime && element.value === new_element.value) ||
            (element.stopTime === new_element.startTime && element.value === new_element.value)
        );

        //console.log(element);

        if (new_element !== undefined) {

            let index_new_element = aux.indexOf(new_element);

            //console.log(index_new_element);

            if (index_new_element > -1) {

                let element_stopTime;
                if (element.stopTime === '00:00') {
                    element_stopTime = moment(element.stopTime, 'HH:mm').add(1, 'days');
                    //element_stopTime = moment(element.stopTime, 'HH:mm');
                }
                else {
                    element_stopTime = moment(element.stopTime, 'HH:mm');
                }

                let new_element_stopTime;
                if (new_element.stopTime === '00:00') {
                    new_element_stopTime = moment(new_element.stopTime, 'HH:mm').add(1, 'days');
                    //new_element_stopTime = moment(new_element.stopTime, 'HH:mm');
                }
                else {
                    new_element_stopTime = moment(new_element.stopTime, 'HH:mm');
                }

                let element_range = moment.range(moment(element.startTime, 'HH:mm'), element_stopTime);
                let element_start = moment.range(moment(new_element.startTime, 'HH:mm'), new_element_stopTime);
                let new_date_range = element_range.add(element_start, { adjacent: true });

                if (new_date_range !== undefined && new_date_range !== null) {
                    let new_info = {
                        value: new_element.value,
                        startTime: (new_date_range.start).format('HH:mm'),
                        stopTime: (new_date_range.end).format('HH:mm')
                    }
                    aux[index_new_element] = new_info;
                }
                else {
                    aux.push(element);
                }

            }

        }
        else {
            aux.push(element);
        }

    }
    return aux;
}

function handleImportedValues(array) {

    for (let index = 0; index < array.length; index++) {
        const element = array[index];
        let fixed_values = checkConnections(element.scheduleTime);
        array[index].scheduleTime = fixed_values;
    }

    return array;

}

function updateTariffWeekSchedule(query, tariffUpdated) {
    return new Promise((resolve, reject) => {

        var newValues = { $set: { weekSchedule: tariffUpdated } };

        purchaseTariffUpdate(query, newValues)
            .then((result) => {
                if (result) {
                    resolve(result);
                }
                else {
                    reject({ auth: false, code: 'server_purchase_tariff_not_updated', message: "Purchase tariff not updated" });
                }
            })
            .catch((error) => {
                console.error(`[${context}][purchaseTariffUpdate] Error `, error.message);
                reject(error);
            });

    })
}

function checkSameElementDuplicate(elementUpdateStart, elementUpdateEnd) {

    if (elementUpdateStart.startTime === elementUpdateEnd.startTime &&
        elementUpdateStart.stopTime === elementUpdateEnd.stopTime) {
        return false;
    }

    return true;
}
