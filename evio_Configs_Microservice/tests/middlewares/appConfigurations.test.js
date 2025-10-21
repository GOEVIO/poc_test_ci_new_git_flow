const { validateUpdates } = require('../../middlewares/appConfigurations');

describe('validateUpdates', () => {
  it('should return invalid when no updates provided', () => {
    expect(validateUpdates({})).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_updates',
      message: 'Invalid or missing updates'
    });
  });

  it('should return invalid when mapsConfiguration is not provided', () => {
    expect(validateUpdates({})).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_updates',
      message: 'Invalid or missing updates'
    });
  });

  it('should return invalid when maxMap is not provided', () => {
    expect(validateUpdates({ mapsConfiguration: {maxRankings: 100} })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_updates',
      message: 'Invalid or missing updates'
    });
  });

  it('should return invalid when maxRankings is not provided', () => {
    expect(validateUpdates({ mapsConfiguration: { maxMap: 100 } })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_updates',
      message: 'Invalid or missing updates'
    });
  });

  it('should return invalid when both maxMap and maxRankings are not provided', () => {
    expect(validateUpdates({ mapsConfiguration: {} })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_updates',
      message: 'Invalid or missing updates'
    });
  });

  it('should return invalid when maxMap is not a positive integer', () => {
    expect(validateUpdates({ mapsConfiguration: { maxMap: 'not a number', maxRankings: 100 } })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_maps_configuration',
      message: 'maxMap and maxRankings must be positive integers'
    });
  });

  it('should return invalid when maxRankings is not a positive integer', () => {
    expect(validateUpdates({ mapsConfiguration: {maxMap: 100, maxRankings: 'not a number' } })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_maps_configuration',
      message: 'maxMap and maxRankings must be positive integers'
    });
  });

  it('should return invalid when maxMap is less than or equal to zero', () => {
    expect(validateUpdates({ mapsConfiguration: { maxMap: 0 , maxRankings: 50} })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_maps_configuration',
      message: 'maxMap and maxRankings must be positive integers'
    });
  });

  it('should return invalid when maxRankings is less than or equal to zero', () => {
    expect(validateUpdates({ mapsConfiguration: { maxMap: 100, maxRankings: 0 } })).toEqual({
      invalid: true,
      statusCode: 400,
      code: 'invalid_maps_configuration',
      message: 'maxMap and maxRankings must be positive integers'
    });
  });

  it('should return valid when all conditions are met', () => {
    const result = validateUpdates({
      mapsConfiguration: {
        maxMap: 100,
        maxRankings: 50
      }
    });
    expect(result).toEqual({ valid: true });
  });
});