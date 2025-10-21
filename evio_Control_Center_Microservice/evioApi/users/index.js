const express = require('express');
const router = express.Router();
const users = require('./users')

router.patch('/updateUserPermissionModules', (req, res) => {
    users.updateUserPermissionModules(req,res) 
});

router.patch('/updateAllDefaultPermissionModules', (req, res) => {
    users.updateAllDefaultPermissionModules(req,res) 
});

router.patch('/defaultCpoDetails', (req, res) => {
    users.updateDefaultCpoDetails(req,res) 
});

router.patch('/partyId', (req, res) => {
    users.updateNetworkPartyId(req,res) 
});

router.patch('/operatorId', (req, res) => {
    users.updateOperatorIdIdentity(req,res) 
});

router.patch('/addExistingClients', (req, res) => {
    users.addExistingClients(req,res) 
});
module.exports = router;
