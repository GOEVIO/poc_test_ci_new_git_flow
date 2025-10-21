
/**
 * Validates and returns user coordinates if they are valid.
 * @param {string|number} body.userCoordinates.latitude - Latitude provided in the request body.
 * @param {string|number} body.userCoordinates.longitude - Longitude provided in the request body.
 * @returns {{ latitude: { value: number }, longitude: { value: number }} | null}
 * Returns the formatted coordinates or null if they are invalid.
 */
function getUserCoordinates(body) {
  return  {
    type: 'Point',
    coordinates: [
      parseFloat(body?.userCoordinates?.longitude) || 0, 
      parseFloat(body?.userCoordinates?.latitude) || 0
    ],
  };
}

module.exports = {
  getUserCoordinates
}