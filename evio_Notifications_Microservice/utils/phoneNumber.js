/**
 * Masks a phone number by showing only the country code and last 2-4 digits
 * @param internationalPhoneNumber
 * @returns {*|string}
 */
const maskPhoneNumber =(internationalPhoneNumber) => {
    // Remove non-numeric characters
    let digits = internationalPhoneNumber.replace(/\D/g, '');

    // Ensure it's at least 6 digits long for proper masking
    if (digits.length < 6) return internationalPhoneNumber;

    // Show only the country code and last 2-4 digits
    let countryCode = digits.slice(0, digits.length - 6); // Assume first part is country code
    let lastDigits = digits.slice(-4);

    return `${countryCode}****${lastDigits}`;
}

module.exports = { maskPhoneNumber };