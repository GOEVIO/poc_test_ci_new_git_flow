const { Router } = require('express'); 
const router = Router();
const {remoteStart} = require('../controllers/remote-start.controller')

router.post('/ocpi/start', remoteStart);

module.exports = router;