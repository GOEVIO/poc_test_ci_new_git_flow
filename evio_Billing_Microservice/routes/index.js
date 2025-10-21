const healthCheckRoutes = require('./healthCheck');

module.exports = (app) => {
  healthCheckRoutes(app);
};
