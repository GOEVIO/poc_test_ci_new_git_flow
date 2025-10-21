const { isInputKmValid } = require('../../utils/validationUtils.js');
const Constants = require('../../utils/constants.js');
jest.mock('dotenv-safe', () => ({
    load: jest.fn(),
  }));
describe('isInputKmValid', () => {
    let validRequestData;

    beforeAll(() => {
        validRequestData = {
            kms: Constants.minKms + 1,
            evID: 'validEvId',
            chargerType: Constants.listOfChargerTypes[0],
            sessionID: 'validSessionId',
            userID: 'validUserId'
        };
    }); 


    test('should return true for valid input', () => {
        expect(isInputKmValid(validRequestData)).toBe(true);
    });

    test('should return false for invalid kms under minimum value', () => {
        const requestData = { ...validRequestData, kms: Constants.minKms - 1 };
        expect(isInputKmValid(requestData)).toBe(false);
    });
    test('should return false for invalid kms over maximum value', () => {
        const requestData = { ...validRequestData, kms: Constants.maxKms + 1 };
        expect(isInputKmValid(requestData)).toBe(false);
    });
    test('should return false for invalid evID', () => {
        const requestData = { ...validRequestData, evID: '-1' };
        expect(isInputKmValid(requestData)).toBe(false);
    });

    test('should return false for invalid chargerType', () => {
        const requestData = { ...validRequestData, chargerType: 'invalidChargerType' };
        expect(isInputKmValid(requestData)).toBe(false);
    });

    test('should return false for invalid sessionID', () => {
        const requestData = { ...validRequestData, sessionID: 1 };
        expect(isInputKmValid(requestData)).toBe(false);
    });

    test('should return false for invalid userID', () => {
        const requestData = { ...validRequestData, userID: 3 };
        expect(isInputKmValid(requestData)).toBe(false);
    });
});