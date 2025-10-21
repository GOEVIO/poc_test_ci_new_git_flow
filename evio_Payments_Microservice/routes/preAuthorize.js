require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const PreAuthorizeHandler = require('../handlers/preAuthorize');
const PreAuthorizeRoutines = require('../routines/preAuthorize');


//========== POST ==========

router.post('/api/private/payments/preAuthorize', PreAuthorizeHandler.handleCreate);

router.post('/api/private/payments/preAuthorize/forceJobProcessPreAuthCancel', PreAuthorizeRoutines.forceJobProcessPreAuthCancel);

//========== GET ==========

router.get('/api/private/payments/preAuthorize', PreAuthorizeHandler.handleGet);

//========== PATCH ==========

router.patch('/api/private/payments/preAuthorize', PreAuthorizeHandler.handlePatch);





module.exports = router;
