const healthCheckRoutes = require('./healthCheck');
const countriesRoutes = require('./countries');

module.exports = (app) => {
  healthCheckRoutes(app);
  app.use(countriesRoutes);
};
