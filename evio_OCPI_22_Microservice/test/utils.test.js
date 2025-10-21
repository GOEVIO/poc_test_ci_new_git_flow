const axios = require('axios');
const {
  describe, expect, it
} = require('@jest/globals');
const { getFees } = require('../services/vat');

describe('utils', () => {
  describe('#getFees', () => {
    it('should fail to invalid country code', () => {
      const input = {
        countryCode: 'invalid'
      };
      expect(getFees(input)).rejects.toEqual(
        { code: 'invalid_country_code', message: 'Invalid country code' }
      );
    });

    it('should get error when configs service return empty data', () => {
      const input = {
        countryCode: 'PT',
        address: {
          postalCode: 'valid-postal-code'
        }
      };
      jest.spyOn(axios, 'get').mockResolvedValue({ data: null });
      expect(getFees(input)).rejects.toEqual(
        { code: 'problem_while_get_fees_to_simulation', message: 'At this time it is not possible to obtain a simulation for the position' }
      );
    });

    it('should get error when an error occurred with the configs service request', async () => {
      const input = {
        countryCode: 'PT',
        address: {
          postalCode: 'valid-postal-code'
        }
      };
      const mockedError = new Error('error');
      jest.spyOn(axios, 'get').mockRejectedValue(mockedError);
      expect(getFees(input)).rejects.toEqual(
        { code: 'problem_while_get_fees_to_simulation', message: 'At this time it is not possible to obtain a simulation for the position' }
      );
    });

    it('should receive data for happy case', async () => {
      const input = {
        countryCode: 'PT',
        address: {
          postalCode: 'valid-postal-code'
        }
      };
      const mockedData = { data: 'data' };
      jest.spyOn(axios, 'get').mockResolvedValue({ data: mockedData });
      expect(getFees(input)).resolves.toEqual(mockedData);
    });
  });
});
