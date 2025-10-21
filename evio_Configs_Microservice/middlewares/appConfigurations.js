function validateUpdates(updates) {
    const validFields = ['mapsConfiguration'];

    if (!updates?.mapsConfiguration || updates?.mapsConfiguration?.maxMap === undefined || updates?.mapsConfiguration?.maxRankings === undefined) {
        return {
          invalid: true,
          statusCode: 400,
          code: 'invalid_updates',
          message: 'Invalid or missing updates'
        };
      }
    const invalidUpdates = Object.keys(updates).filter(field => !validFields.includes(field));
  
    if (invalidUpdates.length > 0) {
      return {
        invalid: true,
        statusCode: 400,
        code: 'invalid_updates',
        message: `Invalid fields in updates: ${invalidUpdates.join(', ')}`,
      };
    }
  

  
    if (typeof updates.mapsConfiguration.maxMap !== 'number' || typeof updates.mapsConfiguration.maxRankings !== 'number' || 
        updates.mapsConfiguration.maxMap <= 0 || updates.mapsConfiguration.maxRankings <= 0) {
      return {
        invalid: true,
        statusCode: 400,
        code: 'invalid_maps_configuration',
        message: 'maxMap and maxRankings must be positive integers'
      };
    }
  
    return { valid: true };
  }

module.exports = {
    validateUpdates
};