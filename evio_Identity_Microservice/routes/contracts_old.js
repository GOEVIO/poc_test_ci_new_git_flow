const express = require('express');
const router = express.Router();
const axios = require("axios");
var User = require('../models/user');
var Contract = require('../models/contracts');
var GroupCSUsers = require('../models/groupCSUsers');
var fs = require('fs');
require("dotenv-safe").load();
const { logger } = require('../utils/constants');

//========== POST ==========
//Endpoint to create a new contract
//DONE Passou para CEME Tariff
router.post('/api/private/contracts', (req, res, next) => {
    var context = "POST /api/private/contracts";
    try {
        var userId = req.headers['userid'];
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        else {
            var contract = new Contract(req.body);
            contract.userId = userId;

            validateFields(contract)
                .then(() => {

                    Contract.createContract(contract, (err, result) => {
                        if (err) {
                            console.log(`[${context}][createContract] Error `, err);
                            return res.status(500).send(err);
                        }
                        else {
                            if (result) {
                                result = JSON.parse(JSON.stringify(result));
                                if (result.tariff != undefined) {
                                    var params = {
                                        _id: result.tariff.planId
                                    };
                                    getTariffCEME(params)
                                        .then((tariffInfo) => {
                                            tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                return tariff.power === result.tariff.power
                                            });
                                            result.tariffInfo = tariffInfo;
                                            return res.status(200).send(result);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getTariffCEME] Error `, error);
                                            return res.status(500).send(error.message);
                                        });
                                }
                                else {
                                    return res.status(200).send(result);
                                };
                                //return res.status(200).send(result);
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_contract_not_created', message: "Contract not created" });
                            }
                        };
                    });

                })
                .catch((error) => {

                    return res.status(400).send(error);

                });

        };
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Endpoint to check if given idTag is valid  - internal endpoint
//DONE
router.get('/api/private/contracts/idTag', (req, res, next) => {
    var context = "GET /api/private/contracts/idTag";
    try {
        var userId = req.query.userId;
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });

        var idTag = req.query.idTag;
        if (!idTag)
            return res.status(400).send({ auth: false, code: 'server_id_tag_required', message: 'Id tag is required' });

        var query = {
            $and: [
                { userId: userId },
                {
                    cards: {
                        $elemMatch: {
                            idTag: idTag
                        }
                    }
                },
                { active: true }
            ]
        };

        Contract.findOne(query, (err, contract) => {
            if (err) {
                console.log(`[${context}] Error `, err);
                return res.status(500).send(err);
            }
            else {
                if (contract)
                    return res.status(200).send({ contract });
                else
                    return res.status(200).send(null);
            };
        });


    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get cards of specific contract
//TODO Verificar se ainda é necessário
router.get('/api/private/contracts/card', (req, res, next) => {
    var context = "GET /api/private/contracts/card";
    try {
        var userId = req.headers['userid'];
        var query = req.query;
        query.active = true;
        contractsFindOne(query)
            .then((contractsFound) => {
                if (contractsFound) {
                    contractsFound.cards = contractsFound.cards.filter(card => {
                        return card.active == true;
                    });
                    if (contract.tariff !== undefined) {
                        var params = {
                            _id: contractsFound.tariff.planId
                        };
                        contractsFound = JSON.parse(JSON.stringify(contractsFound));
                        getTariffCEME(params)
                            .then((tariffInfo) => {
                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                    return tariff.power = contractsFound.tariff.power
                                });
                                contractsFound.tariffInfo = tariffInfo;
                                return res.status(200).send(contractsFound);
                            })
                            .catch((error) => {
                                console.log(`[${context}][getTariffCEME] Error `, error);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        contract.tariffInfo = {};
                        resolve(true);
                    }
                }
                else
                    return res.status(200).send(null);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoint to get all contracts of given user
//DONE Passou para CEME Tariff
router.get('/api/private/contracts', (req, res, next) => {
    var context = "GET /api/private/contracts";
    try {
        var userId = req.headers['userid'];
        var query = {
            userId: userId,
            active: true
        };
        contractsFind(query)
            .then((contractsFound) => {
                if (contractsFound.length == 0)
                    return res.status(200).send(contractsFound);
                else {
                    contractsFound = JSON.parse(JSON.stringify(contractsFound));
                    Promise.all(
                        contractsFound.map(contract => {
                            return new Promise((resolve, reject) => {
                                contract.cards = contract.cards.filter(card => {
                                    return card.active == true;
                                });
                                if (contract.tariff !== undefined) {
                                    var params = {
                                        _id: contract.tariff.planId
                                    };
                                    getTariffCEME(params)
                                        .then((tariffInfo) => {
                                            if (Object.keys(tariffInfo).length != 0) {
                                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                    return tariff.power === contract.tariff.power
                                                });
                                                contract.tariffInfo = tariffInfo;
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            };
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getTariffCEME] Error `, error);
                                            reject(error);
                                        });
                                }
                                else {
                                    contract.tariffInfo = {};
                                    resolve(true);
                                }
                            });
                        })
                    ).then(() => {
                        return res.status(200).send(contractsFound);
                    });
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Get contract find one by idtag
//DONE
router.get('/api/private/contracts/byIdTag', (req, res, next) => {
    var context = "GET /api/private/contracts/byIdTag";
    try {
        var query = req.body;
        query.active = true;
        contractsFindOne(query)
            .then((contractsFound) => {
                if (contractsFound) {
                    contractsFound.cards = contractsFound.cards.filter(card => {
                        return card.active == true;
                    });
                    if (contractsFound.tariff !== undefined) {
                        var params = {
                            _id: contractsFound.tariff.planId
                        };
                        contractsFound = JSON.parse(JSON.stringify(contractsFound));
                        getTariffCEME(params)
                            .then((tariffInfo) => {
                                if (Object.keys(tariffInfo).length !== 0) {

                                    if (contractsFound.tariff != undefined) {
                                        tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                            return tariff.power = contractsFound.tariff.power
                                        });
                                    }
                                    contractsFound.tariffInfo = tariffInfo;
                                    return res.status(200).send(contractsFound);
                                }
                                else {
                                    contractsFound.tariffInfo = {};
                                    return res.status(200).send(contractsFound);
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][getTariffCEME] Error `, error);
                                return res.status(500).send(error.message);
                            });
                    } else {
                        contractsFound.tariffInfo = {};
                        return res.status(200).send(contractsFound);
                    };
                }
                else {
                    return res.status(200).send(contractsFound);
                };

            })
            .catch((error) => {
                console.log(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoint to check if given idTag is valid  - internal endpoint
//DONE
router.get('/api/private/contracts/checkIdTag', async (req, res, next) => {
    var context = "GET /api/private/contracts/checkIdTag";
    try {
        var idTag = req.query.idTag;
        var hwId = req.query.hwId;
        if (!idTag)
            return res.status(400).send({ auth: false, code: 'server_id_tag_required', message: 'Id tag is required' });

        var query = {
            cards: {
                $elemMatch: {
                    idTag: idTag
                }
            },
            active: true
        };

        var params = {
            hwId: hwId,
            hasInfrastructure: true,
            active: true
        };

        var host = process.env.HostCharger + process.env.PathGetCharger;

        let result = await axios.get(host, { params });
        var chargerFound = result.data;

        Contract.findOne(query, async (err, contract) => {
            if (err) {
                console.log(`[${context}] Error `, err);
                return res.status(500).send(err);
            }
            else {
                if (contract) {
                    //return res.status(200).send({ contract });                    
                    if (chargerFound) {
                        switch (chargerFound.accessType) {

                            case process.env.ChargerAccessPublic:

                                return res.status(200).send({ contract });

                            case process.env.ChargerAccessRestrict:

                                var query = {
                                    listOfUsers: {
                                        $elemMatch: {
                                            userId: contract.userId
                                        }
                                    }
                                };
                                let groupsCsUsers = await groupCSUsersFind(query);
                                if (groupsCsUsers.length == 0) {

                                    //return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                    return res.status(200).send(null);
                                }
                                else {

                                    Promise.all(
                                        groupsCsUsers.map(groupUsers => {
                                            return new Promise((resolve, reject) => {

                                                var found = chargerFound.listOfGroups.indexOf(chargerFound.listOfGroups.find(group => {
                                                    return group.groupId == groupUsers._id;
                                                }));

                                                if (found >= 0) {
                                                    return res.status(200).send({ contract });
                                                }
                                                else {
                                                    resolve(true);
                                                };
                                            });
                                        })
                                    ).then((result) => {
                                        //return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                        return res.status(200).send(null);
                                    }).catch((error) => {
                                        console.log(`[${context}] Error `, error);
                                        return res.status(500).send(error.message);
                                    });

                                };

                                break;

                            case process.env.ChargerAccessPrivate:

                                if (chargerFound.createUser === contract.userId) {

                                    return res.status(200).send({ contract });

                                }
                                else {

                                    //return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                    return res.status(200).send(null);
                                };

                            default:

                                //return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                return res.status(200).send(null);

                        }

                    }
                    else {
                        //return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                        return res.status(200).send(null);
                    };
                    
                }
                else
                    return res.status(200).send(null);
            };
        });


    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoit to get all cards of a particular user
//TODO Verificar se ainda é necessário
router.get('/api/private/contracts/cards', (req, res, next) => {
    var context = "GET /api/private/contracts/cards";
    try {
        var userId = req.headers['userid'];
        var query = {
            userId: userId,
            active: true
        };
        var listCards = [];
        contractsFind(query)
            .then((contractsFound) => {
                if (contractsFound) {
                    Promise.all(contractsFound.map(contract => {
                        return new Promise(async (resolve, reject) => {
                            let cards = await contract.cards.filter(card => {
                                return card.active == true;
                            });
                            listCards = listCards.concat(cards);
                            resolve(true);
                        });
                    })).then(() => {
                        return res.status(200).send(listCards);
                    });
                }
                else
                    return res.status(200).send([]);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========
//Endpoint to add new card to existing contract
//TODO Verificar se ainda é necessário
router.put('/api/private/contracts/card', (req, res, next) => {
    var context = "PUT /api/private/contracts/card";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var card = received.card;
        card.active = true;
        var query = {
            _id: received._id
        };
        contractsFindOne(query)
            .then((contractFound) => {
                if (contractFound) {
                    var found = contractFound.cards.find(cards => {
                        return cards.idTag === card.idTag;
                    });
                    if (found) {
                        return res.status(400).send({ auth: false, code: 'server_card_already_exists', message: 'Card already exists' });
                    }
                    else {
                        contractFound.cards.push(card);
                        var newValue = { $set: contractFound };
                        contractUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    return res.status(200).send(contractFound);
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}] Error `, error);
                                return res.status(500).send(error.message);
                            });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Endpoint to edit a card
//TODO Verificar se ainda é necessário
router.patch('/api/private/contracts/card', (req, res, next) => {
    var context = "PATCH /api/private/contracts/card";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };
        contractsFindOne(query)
            .then((contractFound) => {
                if (contractFound) {
                    var found = contractFound.cards.indexOf(contractFound.cards.find(cards => {
                        return cards._id == received.card._id;
                    }));
                    if (found >= 0) {
                        contractFound.cards[found].name = received.card.name;
                        contractFound.cards[found].idTag = received.card.idTag;
                        contractFound.cards[found].imageCard = received.card.imageCard;
                        contractFound.cards[found].licensePlate = received.card.licensePlate;
                        var newValue = { $set: contractFound };
                        contractUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    return res.status(200).send(contractFound);
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][contractUpdate] Error `, error);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_card_not_found', message: 'Card not found for given parameters' });
                    };
                }
                else
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoint to edit a contract
//DONE Passou para CEME Tariff
router.patch('/api/private/contracts', (req, res, next) => {
    var context = "PATCH /api/private/contracts";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };
        var newValue = { $set: received };
        /*contractsFindOne(query)
            .then((contractFound) => {
                if (contractFound) {
                    contractFound.name = received.name;
                    contractFound.CEME = received.CEME;
                    contractFound.cards = received.cards;
                    var newValue = { $set: contractFound };
                    */
        contractUpdate(query, newValue)
            .then((result) => {
                if (result) {
                    contractsFindOne(query)
                        .then((received) => {
                            var params = {
                                _id: received.tariff.planId
                            };
                            getTariffCEME(params)
                                .then((tariffInfo) => {
                                    tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                        return tariff.power === received.tariff.power
                                    });
                                    received.tariffInfo = tariffInfo;
                                    return res.status(200).send(received);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getTariffCEME] Error `, error);
                                    return res.status(500).send(error.message);
                                });
                        })
                        .catch((error) => {
                            console.log(`[${context}][getTariffCEME] Error `, error);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][contractUpdate] Error `, error);
                return res.status(500).send(error.message);
            });
        /*}
        else
            return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
    })
    .catch((error) => {
        console.log(`[${context}][contractsFindOne] Error `, error);
        return res.status(500).send(error.message);
    });
    */
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Set Default contract
//Criado um endpoit em CEME TARIFF
//DONE
router.patch('/api/private/contracts/setDefault', (req, res, next) => {
    var context = "PATCH /api/private/contracts/setDefault";
    try {

        var contractId = req.body._id;
        var userId = req.headers['userid'];

        Contract.markAllAsNotDefault(userId, (err, result) => {
            if (err) {
                console.log(`[${context}][markAllAsNotDefault] Error `, err);
                return res.status(500).send(err);
            }
            else {
                Contract.markAsDefaultContract(contractId, userId, (err, result) => {
                    if (err) {
                        console.log(`[${context}][markAsDefaultContract] Error `, err);
                        return res.status(500).send(err);
                    }
                    else {
                        if (result)
                            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                        else
                            return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                    };
                });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== Delete ==========
//Endpoint to remove a contract - Encript data and active = false
//DONE Passou para CEME Tariff
router.delete('/api/private/contracts', (req, res, next) => {
    var context = "PATCH /api/private/contracts/card";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };
        contractsFindOne(query)
            .then((contractFound) => {
                if (contractFound) {
                    if (contractFound.CEME != process.env.CemeEVIO) {
                        contractFound.active = false;
                        var newValue = { $set: contractFound };
                        //contractUpdate(query, newValue)
                        contracDelete(query)
                            .then((result) => {
                                if (result) {
                                    return res.status(200).send({ auth: true, code: 'server_contract_removed', message: "Contract successfully removed" });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_contract_not_removed', message: "Contract unsuccessfully removed" });
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][contracDelete] Error `, error);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        var newQuery = {
                            CEME: process.env.CemeEVIO,
                            userId: userId,
                            active: true
                        };
                        contractsFind(newQuery)
                            .then((contractsFound) => {
                                if (contractsFound.length > 1) {
                                    if (contractsFound.default === true) {
                                        return res.status(400).send({ auth: false, code: 'server_cant_remove_evio', message: "EVIO contract, Cannot be removed" });
                                    }
                                    else {
                                        //contractUpdate(query, newValue)
                                        contracDelete(query)
                                            .then((result) => {
                                                if (result) {
                                                    return res.status(200).send({ auth: true, code: 'server_contract_removed', message: "Contract successfully removed" });
                                                }
                                                else {
                                                    return res.status(400).send({ auth: false, code: 'server_contract_not_removed', message: "Contract unsuccessfully removed" });
                                                };
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][contracDelete] Error `, error);
                                                return res.status(500).send(error.message);
                                            });
                                    };
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_cant_remove_evio', message: "EVIO contract, Cannot be removed" });
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][contractsFind] Error `, error);
                                return res.status(500).send(error.message);

                            });
                    };
                }
                else
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Endpoint to remove a card - Encript data and active = false
//TODO Verificar se ainda é necessário
router.delete('/api/private/contracts/card', (req, res, next) => {
    var context = "PATCH /api/private/contracts/card";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };
        contractsFindOne(query)
            .then((contractFound) => {
                if (contractFound) {
                    if (contractFound.cards.length == 1 || contractFound.cards.length == 0) {
                        Contract.removeContracts(query, (err, result) => {
                            if (err) {
                                console.log(`[${context}][removeContracts] Error `, err);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    return res.status(200).send({ auth: true, code: 'server_card_removed', message: "Card successfully removed" });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_card_not_removed', message: "Card unsuccessfully removed" });
                                };
                            };
                        });
                    }
                    else {
                        var found = contractFound.cards.indexOf(contractFound.cards.find(card => {
                            return card.idTag == received.idTag;
                        }));
                        if (found >= 0) {
                            contractFound.cards[found].active = false;
                            var newValue = { $set: contractFound };
                            contractUpdate(query, newValue)
                                .then((result) => {
                                    if (result) {
                                        return res.status(200).send({ auth: true, code: 'server_card_removed', message: "Card successfully removed" });
                                    }
                                    else {
                                        return res.status(400).send({ auth: false, code: 'server_card_not_removed', message: "Card unsuccessfully removed" });
                                    };
                                })
                                .catch((error) => {
                                    console.log(`[${context}][contractUpdate] Error `, error);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            return res.status(400).send({ auth: false, code: 'server_card_not_found', message: 'Card not found for given parameters' });
                        };
                    };
                }
                else
                    return res.status(400).send({ auth: false, code: 'server_contract_not_found', message: 'Contract not found for given parameters' });
            })
            .catch((error) => {
                console.log(`[${context}][contractsFindOne] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
function validateFields(contract) {
    var context = "Function validateFields";
    return new Promise((resolve, reject) => {
        if (!contract)
            reject({ auth: false, code: 'server_contract_required', message: 'Contract data is required' });

        else if (!contract.CEME)
            reject({ auth: false, code: 'server_CEME_required', message: 'CEME name is required' });

        else if (contract.cards.length === 0)
            reject({ auth: false, code: 'server_card_required', message: 'Card data is required' });

        else if (contract.cards.length > 1)
            reject({ auth: false, code: 'server_only_on_card_required', message: 'Only one card is required' });

        else if (Object.keys(contract.tariff).length == 0)
            reject({ auth: false, code: 'server_tariff_required', message: 'Tariff is required' });

        else if (!contract.tariff.planId)
            reject({ auth: false, code: 'server_planId_required', message: 'PlanId is required' });

        else if (!contract.tariff.power)
            reject({ auth: false, code: 'server_power_required', message: 'Power is required' });

        else if (!contract.cards[0].idTag)
            reject({ auth: false, code: 'server_idTag_required', message: 'IdTag is required' });

        else if (!contract.cards[0].imageCard)
            reject({ auth: false, code: 'server_imageCard_required', message: 'Image Card is required' });

        else if (!contract.cards[0].licensePlate)
            reject({ auth: false, code: 'server_licensePlate_required', message: 'License Plate is required' });

        else if (!contract.cards[0].name)
            reject({ auth: false, code: 'server_name_required', message: 'Name is required' });

        else
            resolve(true);
    });
};

function contractsFindOne(query) {
    var context = "Function contractsFindOne";
    return new Promise((resolve, reject) => {
        Contract.findOne(query, (err, contractFound) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err);
                reject(err);
            }
            else {
                resolve(contractFound);
            };
        });
    });
};

function contractsFind(query) {
    var context = "Function contractsFind";
    return new Promise((resolve, reject) => {
        Contract.find(query, (err, contractsFound) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err);
                reject(err);
            }
            else {
                resolve(contractsFound);
            };
        });
    });
};

function contractUpdate(query, newValue) {
    var context = "Function contractUpdate";
    return new Promise((resolve, reject) => {
        Contract.updateContract(query, newValue, (err, result) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function saveImageContent(contract) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {
            var path = '/usr/src/app/img/contract/' + contract._id + '.jpg';
            var pathImage = '';
            var base64Image = contract.imageContent.split(';base64,').pop();
            if (process.env.NODE_ENV === 'production') {
                pathImage = process.env.HostProd + contract._id + '.jpg'; // For PROD server
            } else {
                //pathImage = process.env.HostLocal + contract._id + '.jpg'; // For local host
                pathImage = process.env.HostQA + contract._id + '.jpg'; // For QA server
            };
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.log(`[${context}] Error `, err);
                    reject(err)
                }
                else {
                    contract.imageContent = pathImage;
                    resolve(contract);
                };
            });
        }
        catch (error) {
            console.log(`[${context}] Error `, error);
            reject(error);
        };
    });
};

//Function to get all all groups of charger station users by query
function groupCSUsersFind(query) {
    var context = "Function groupCSUsersFind";
    return new Promise((resolve, reject) => {
        GroupCSUsers.find(query, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err);
                reject(err);
            }
            else {
                resolve(groupCSUsersFound);
            };
        });
    });
};

function getTariffCEME(params) {
    var context = "Function getTariffCEME";
    return new Promise((resolve, reject) => {
        var host = process.env.HostTariffCEME + process.env.PathTariffCEME;
        axios.get(host, { params })
            .then((result) => {

                if (Object.keys(result.data).length != 0 && result.data.schedule.tariffType === process.env.TariffTypeBiHour) {
                    //Remove out of empty schedules
                    result.data = JSON.parse(JSON.stringify(result.data));
                    result.data.schedule.schedules = result.data.schedule.schedules.filter(schedule => {
                        return schedule.tariffType === process.env.TariffEmpty;
                    });
                    resolve(result.data);
                }
                else {
                    resolve(result.data);
                }
                // resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}] Error`, error);
                reject(error);
            });
    });
};

function contracDelete(query) {
    var context = "Function contracDelete";
    return new Promise((resolve, reject) => {
        Contract.removeContracts(query, (err, result) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

/*
var query = {
    CEME: "EVIO",
    active: true
};
contractsFind(query)
    .then((contractsFound) => {
        if (contractsFound.length > 0) {
            contractsFound.map(contract => {

                var params = {
                    CEME: contract.CEME
                };
                var host = process.env.HostTariffCEME + process.env.PathTariffCEMEbyCEME;
                axios.get(host, { params })
                    .then((result) => {
                        var plan = result.data[0];
                        //console.log("result", plan);
                        var tariff = {
                            planId: plan.plan._id,
                            power: 'all'
                        }
                        contract.tariff = tariff;
                        var query = {
                            _id: contract._id
                        };
                        var newValue = { $set: contract };
                        contractUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    //console.log(`[] Updated `);
                                    Contract.markAsDefaultContract(query, contract.userId, (err, result) => {
                                        if (err) {
                                            console.error(`[] Error `, error);
                                        }
                                        else {
                                            console.log(`[] Result`);
                                        }
                                    });
                                }
                                else {
                                    console.log(`[] Not Updated `);
                                }

                            })
                            .catch((error) => {
                                console.error(`[] Error `, error);
                            });
                    })
                    .catch((error) => {
                        console.error(`[] Error `, error.response.message);
                    });

            })
        }
    })
    .catch((error) => {
        console.error(`[] Error `, error);
    });

*/
module.exports = router;