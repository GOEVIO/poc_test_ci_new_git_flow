const express = require('express');
const router = express.Router();
var User = require('../models/user');
const Ldap = require('../ldap');
const MongoDb = require('../mongo');
require("dotenv-safe").load();


module.exports = router;