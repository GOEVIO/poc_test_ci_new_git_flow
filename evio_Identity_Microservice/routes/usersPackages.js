const express = require('express');
const router = express.Router();
const UsersPackages = require('../models/usersPackages');
require("dotenv-safe").load();
const { logger } = require('../utils/constants');

//========== POST ==========
//Create a new Users packages
router.post('/api/private/usersPackages', (req, res, next) => {
    var context = "POST /api/private/usersPackages";
    try {
        var userId = req.headers['userid'];

        var usersPackages = new UsersPackages(req.body);

        validateFields(usersPackages)
            .then(() => {

                UsersPackages.createUsersPackages(usersPackages, (err, result) => {
                    if (err) {
                        console.log(`[${context}][createUsersPackages] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (result)
                            return res.status(200).send(result);
                        else
                            return res.status(400).send({ auth: false, code: 'server_usersPackages_not_created', message: "Users packages not created" });
                    };
                });

            })
            .catch(error => {
                return res.status(400).send(error);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Edit users packages
router.patch('/api/private/usersPackages', (req, res, next) => {
    var context = "PATCH /api/private/usersPackages";
    try {
        var userId = req.headers['userid'];

        var usersPackages = req.body;
        //TODO
        validateFieldsUsersPackages(usersPackages)
            .then(() => {

                let query = { _id: usersPackages.packageId };

                UsersPackages.updateUsersPackagesFilter(query, { $set: usersPackages }, { new: true }, (err, result) => {
                    if (err) {
                        console.log(`[${context}][updateUsersPackagesFilter] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        return res.status(200).send(result);
                    };
                });

            })
            .catch(error => {
                return res.status(400).send(error);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//========== PUT ==========

//========== GET ==========
//Get all users packages
router.get('/api/private/usersPackages', (req, res, next) => {
    var context = "GET /api/private/usersPackages";
    try {

        UsersPackages.find({}, (err, usersPackagesFound) => {
            if (err) {
                console.log(`[${context}][UsersPackages.find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                return res.status(200).send(usersPackagesFound);

            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get users packages by id
router.get('/api/private/usersPackages/byId', (req, res, next) => {
    var context = "GET /api/private/usersPackages/byId";
    try {

        let usersPackagesId = req.query._id;

        if (!usersPackagesId) {
            return res.status(400).send({ auth: false, code: 'server_usersPackagesId_required', message: 'Users packages id is required' });
        };

        let query = { _id: usersPackagesId }

        UsersPackages.findOne(query, (err, usersPackagesFound) => {
            if (err) {
                console.log(`[${context}][UsersPackages.findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                return res.status(200).send(usersPackagesFound);

            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete users packages by id
router.delete('/api/private/usersPackages', (req, res, next) => {
    var context = "DELETE /api/private/usersPackages";
    try {

        let usersPackagesId = req.body._id;

        if (!usersPackagesId) {
            return res.status(400).send({ auth: false, code: 'server_usersPackagesId_required', message: 'Users packages id is required' });
        };

        let query = { _id: usersPackagesId }

        //TODO remove from users accounts
        UsersPackages.removeUserAccess(query, (err, result) => {
            if (err) {
                console.log(`[${context}][UsersPackages.removeUserAccess] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                if (result) {
                    UsersPackages.find({}, (err, usersPackagesFound) => {
                        if (err) {
                            console.log(`[${context}][UsersPackages.find] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {

                            return res.status(200).send(usersPackagesFound);

                        };
                    });
                }
                else
                    return res.status(400).send({ auth: false, code: 'server_usersPackagesId_not_removed', message: 'Users packages not removed' });

            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
function validateFields(usersPackages) {
    return new Promise((resolve, reject) => {

        if (!usersPackages)
            reject({ auth: false, code: 'server_usersPackages_required', message: 'Users packages data is required' });

        else if (!usersPackages.packageName)
            reject({ auth: false, code: 'server_packageName_required', message: 'Package name is required' });

        else if (!usersPackages.packageType)
            reject({ auth: false, code: 'server_packageType_required', message: 'Package type is required' });

        else if (!usersPackages.rfidCardsLimit)
            reject({ auth: false, code: 'server_rfidCardsLimit_required', message: 'RFID Cards Limit is required' });

        else if (!usersPackages.fleetsLimit)
            reject({ auth: false, code: 'server_fleetsLimit_required', message: 'Fleets limit is required' });

        else if (!usersPackages.evsLimit)
            reject({ auth: false, code: 'server_evsLimit_required', message: 'EVs limit is required' });

        else if (!usersPackages.driversLimit)
            reject({ auth: false, code: 'server_driversLimit_required', message: 'Drivers limit is required' });

        else if (!usersPackages.groupOfDriversLimit)
            reject({ auth: false, code: 'server_groupOfDriversLimit_required', message: 'Group of drivers limit is required' });

        else if (!usersPackages.driversInGroupDriversLimit)
            reject({ auth: false, code: 'server_driversInGroupDriversLimit_required', message: 'Drivers in group drivers limit is required' });

        else if (!usersPackages.chargingAreasLimit)
            reject({ auth: false, code: 'server_chargingAreasLimit_required', message: 'Charging areas limit is required' });

        else if (!usersPackages.evioBoxLimit)
            reject({ auth: false, code: 'server_evioBoxLimit_required', message: 'EVIO Box limit is required' });

        else if (!usersPackages.chargersLimit)
            reject({ auth: false, code: 'server_chargersLimit_required', message: 'Chargers limit is required' });

        else if (!usersPackages.tariffsLimit)
            reject({ auth: false, code: 'server_tariffsLimit_required', message: 'Tariffs limit is required' });

        else if (!usersPackages.chargersGroupsLimit)
            reject({ auth: false, code: 'server_chargersGroupsLimit_required', message: 'Chargers groups limit is required' });

        else if (!usersPackages.userInChargerGroupsLimit)
            reject({ auth: false, code: 'server_userInChargerGroupsLimit_required', message: 'User in charger groups limit is required' });

        else if (!usersPackages.searchLocationsLimit)
            reject({ auth: false, code: 'server_searchLocationsLimit_required', message: 'Search locations limit is required' });

        else if (!usersPackages.searchChargersLimit)
            reject({ auth: false, code: 'server_searchChargersLimit_required', message: 'Search chargers limit is required' });

        else if (!usersPackages.comparatorLimit)
            reject({ auth: false, code: 'server_comparatorLimit_required', message: 'Comparator limit is required' });

        else if (!usersPackages.routerLimit)
            reject({ auth: false, code: 'server_routerLimit_required', message: 'Router limit is required' });

        else
            resolve(true);
    });
};

function validateFieldsUsersPackages(usersPackages) {
    return new Promise((resolve, reject) => {

        if (!usersPackages)
            reject({ auth: false, code: 'server_usersPackages_required', message: 'Users packages data is required' });

        else if (!usersPackages.packageId)
            reject({ auth: false, code: 'server_packageId_required', message: 'Package id is required' });

        else if (!usersPackages.packageName)
            reject({ auth: false, code: 'server_packageName_required', message: 'Package name is required' });

        else if (!usersPackages.packageType)
            reject({ auth: false, code: 'server_packageType_required', message: 'Package type is required' });

        else if (!usersPackages.rfidCardsLimit)
            reject({ auth: false, code: 'server_rfidCardsLimit_required', message: 'RFID Cards Limit is required' });

        else if (!usersPackages.fleetsLimit)
            reject({ auth: false, code: 'server_fleetsLimit_required', message: 'Fleets limit is required' });

        else if (!usersPackages.evsLimit)
            reject({ auth: false, code: 'server_evsLimit_required', message: 'EVs limit is required' });

        else if (!usersPackages.driversLimit)
            reject({ auth: false, code: 'server_driversLimit_required', message: 'Drivers limit is required' });

        else if (!usersPackages.groupOfDriversLimit)
            reject({ auth: false, code: 'server_groupOfDriversLimit_required', message: 'Group of drivers limit is required' });

        else if (!usersPackages.driversInGroupDriversLimit)
            reject({ auth: false, code: 'server_driversInGroupDriversLimit_required', message: 'Drivers in group drivers limit is required' });

        else if (!usersPackages.chargingAreasLimit)
            reject({ auth: false, code: 'server_chargingAreasLimit_required', message: 'Charging areas limit is required' });

        else if (!usersPackages.evioBoxLimit)
            reject({ auth: false, code: 'server_evioBoxLimit_required', message: 'EVIO Box limit is required' });

        else if (!usersPackages.chargersLimit)
            reject({ auth: false, code: 'server_chargersLimit_required', message: 'Chargers limit is required' });

        else if (!usersPackages.tariffsLimit)
            reject({ auth: false, code: 'server_tariffsLimit_required', message: 'Tariffs limit is required' });

        else if (!usersPackages.chargersGroupsLimit)
            reject({ auth: false, code: 'server_chargersGroupsLimit_required', message: 'Chargers groups limit is required' });

        else if (!usersPackages.userInChargerGroupsLimit)
            reject({ auth: false, code: 'server_userInChargerGroupsLimit_required', message: 'User in charger groups limit is required' });

        else if (!usersPackages.searchLocationsLimit)
            reject({ auth: false, code: 'server_searchLocationsLimit_required', message: 'Search locations limit is required' });

        else if (!usersPackages.searchChargersLimit)
            reject({ auth: false, code: 'server_searchChargersLimit_required', message: 'Search chargers limit is required' });

        else if (!usersPackages.comparatorLimit)
            reject({ auth: false, code: 'server_comparatorLimit_required', message: 'Comparator limit is required' });

        else if (!usersPackages.routerLimit)
            reject({ auth: false, code: 'server_routerLimit_required', message: 'Router limit is required' });

        else
            resolve(true);
    });
};

module.exports = router;