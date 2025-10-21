const { getCodes } = require('country-list');

function validateCountryCode(countryCodes) {
    return Array.isArray(countryCodes) && countryCodes.every(code => getCodes().includes(code));
}

function validateName(name) {

    return typeof name === 'string' && name.trim() !== '';
}

function validateUserId(userId) {

    return typeof userId === 'string' && userId.trim() !== '';
}

function validateClientName(clientName) {

    return typeof clientName === 'string' && clientName.trim() !== '';
}

function hasValidCoordinates(coordinates) {
    return (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    );
};

module.exports = { validateCountryCode, validateName, validateUserId, validateClientName, hasValidCoordinates }