const validateCountry = require('../../middlewares/validateCountry');

describe('validateCountry middleware - unit test (isValidCountry)', () => {
    const { isValidCountry } = require('../../middlewares/validateCountry');

    it('should return error for country and countryCode with symbols (%%%%, %% respectively)', () => {
        const error = isValidCountry({
            countryName: "Test Invalid Data X",
            country: "%%%%",
            countryCode: "%%"
        });
        expect(error).toBe('"country" must be a valid 3-letter ISO code');
    });

    it('should return error for country and countryCode with exclamation marks (!!!)', () => {
        const error = isValidCountry({
            countryName: "Test Invalid Data Y",
            country: "!!!",
            countryCode: "!!"
        });
        expect(error).toBe('"country" must be a valid 3-letter ISO code');
    });

    it('should return error for country and countryCode with dollar signs ($$$)', () => {
        const error = isValidCountry({
            countryName: "Test Invalid Data Z",
            country: "$$$",
            countryCode: "$$"
        });
        expect(error).toBe('"country" must be a valid 3-letter ISO code');
    });

    it('should return error for numeric country and countryCode ("999", "99")', () => {
        const error = isValidCountry({
            countryName: "Test Invalid Data W",
            country: "999",
            countryCode: "99"
        });
        expect(error).toBe('"country" must be a valid 3-letter ISO code');
    });

    it('should return error when countryName is missing', () => {
        const error = isValidCountry({
            country: "BRA",
            countryCode: "BR"
        });
        expect(error).toBe('"countryName" is required and must be a string');
    });

    it('should return error when countryCode is missing', () => {
        const error = isValidCountry({
            countryName: "Brazil",
            country: "BRA"
        });
        expect(error).toBe('"countryCode" must be a valid 2-letter ISO code');
    });

    it('should return error when country is missing', () => {
        const error = isValidCountry({
            countryName: "Brazil",
            countryCode: "BR"
        });
        expect(error).toBe('"country" must be a valid 3-letter ISO code');
    });

    it('should return null for valid input', () => {
        const error = isValidCountry({
            countryName: "Brazil",
            country: "BRA",
            countryCode: "BR"
        });
        expect(error).toBeNull();
    });
});
