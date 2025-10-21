require("dotenv-safe").load(); 
const express = require('express');
const router = express.Router();
const userCreation = require("../handlers/userCreation");

//////////////////////////////////////////////////////////// 
///////////////////   USERS B2C MODULE   ///////////////////
////////////////////////////////////////////////////////////

router.post('/api/private/controlcenter/userB2C/Create', async (req, res, next) => {
    userCreation.post(req, res);
});

router.post('/api/private/controlcenter/userB2B/Create', async (req, res, next) => {
    userCreation.userB2B(req, res);
});

module.exports = router;