const express = require('express');

const router = express.Router();
const controller = require('../controllers/healthCheck');

module.exports = (app) => {
  router.get('/api/private/healthCheck', controller.checkHealth);

  app.use(router);
};
