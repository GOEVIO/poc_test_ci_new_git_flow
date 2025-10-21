const express = require('express');
const router = express.Router({mergeParams:true});
const handlerSession = require('./handlerSession');

router.put('/', (req, res) => {
    handlerSession.startSession(req, res);
});

router.put('/:sessionId', (req, res) => {
    handlerSession.startSession(req, res);
});

router.put('/:country_code/:party_id/:sessionId', (req, res) => {
    handlerSession.startSession(req, res);
});

router.patch('/', (req, res) => {
    handlerSession.updateSession(req, res);
});

router.patch('/:sessionId', (req, res) => {
    handlerSession.updateSession(req, res);
});

router.patch('/:country_code/:party_id/:sessionId', (req, res) => {
    handlerSession.updateSession(req, res);
});

module.exports = router;