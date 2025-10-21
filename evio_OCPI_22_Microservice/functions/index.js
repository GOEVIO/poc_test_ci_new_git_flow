const express = require('express');
const router = express.Router();
var generateToken = require('./generateToken');

router.post('/token', (req, res) => {
    generateToken.handle(req, res);
});

module.exports = router;