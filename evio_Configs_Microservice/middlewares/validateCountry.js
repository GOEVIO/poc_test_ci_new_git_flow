const countryCodeRegex = /^[A-Z]{2}$/;
const countryRegex = /^[A-Z]{3}$/;

function isValidCountry(countryObj) {
    const { countryCode, country, countryName } = countryObj;

    if (!countryName || typeof countryName !== 'string') {
        return '"countryName" is required and must be a string';
    }

    if (!country || !countryRegex.test(country)) {
        return '"country" must be a valid 3-letter ISO code';
    }

    if (!countryCode || !countryCodeRegex.test(countryCode)) {
        return '"countryCode" must be a valid 2-letter ISO code';
    }

    return null;
}

function validateCountry(req, res, next) {
    const body = req.body;

    if (Array.isArray(body)) {
        for (let item of body) {
            const error = isValidCountry(item);
            if (error) return res.status(400).json({ error });
        }
    } else {
        const error = isValidCountry(body);
        if (error) return res.status(400).json({ error });
    }

    next();
}

module.exports = {
    validateCountry,
    isValidCountry
};
