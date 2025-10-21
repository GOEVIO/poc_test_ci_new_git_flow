// validationUtils.test.js

const { validatePlugCapabilities } = require('../../utils/validationUtils');
const { plugCapabilities } = require('../../utils/enums/enumPlugs');
const httpMocks = require('node-mocks-http');


describe('validatePlugCapabilities', () => {
    it('should return true if plug capabilities exist and include REMOTE_START_STOP_CAPABLE', () => {
        const plug = {
            capabilities: [plugCapabilities.REMOTE_START_STOP_CAPABLE],
        };
        const mockResponse = httpMocks.createResponse();
        expect(validatePlugCapabilities(plug, mockResponse)).toBe(true);
    });

    it('should return false if plug capabilities do not include REMOTE_START_STOP_CAPABLE', () => {
        const plug = {
            capabilities: ['Other'],
        };
        const mockResponse = httpMocks.createResponse();
        expect(validatePlugCapabilities(plug, mockResponse)).toBe(false);
    });

    it('should return true if plug capabilities array is empty', () => {
        const plug = {
            capabilities: [],
        };
        const mockResponse = httpMocks.createResponse();
        expect(validatePlugCapabilities(plug, mockResponse)).toBe(true);
    });

    it('should return true if plug capabilities array is undefined', () => {
        const plug = {
            capabilities: undefined,
        };
        const mockResponse = httpMocks.createResponse();
        expect(validatePlugCapabilities(plug, mockResponse)).toBe(true);
    });
});
