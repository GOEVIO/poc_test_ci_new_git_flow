import { describe, expect, it } from '@jest/globals';

import { getAddressInfoByZipCode, isZipAddressValidToCountry } from '../../services/googleMaps';

describe('Google Maps', () => {
    describe('#getAddressInfoByZipCode', () => {
        it('returns a valid address info by formatted zip code', async () => {
            const input: string = '1000-205';
            const result = await getAddressInfoByZipCode(input);
            expect(result.status).toBe(200);
            expect(result.data.results.length).toBeGreaterThan(0);
        });

        it('returns a valid address info by only numbers format zip code', async () => {
            const input: string = '1000205';
            const result = await getAddressInfoByZipCode(input);
            expect(result.status).toBe(200);
            expect(result.data.results.length).toBeGreaterThan(0);
        });

        it('returns 0 results info by non-existent zip code', async () => {
            const input: string = '2970';
            const result = await getAddressInfoByZipCode(input);
            expect(result.status).toBe(200);
            expect(result.data.results.length).toBe(0);
            expect(result.data.status).toBe('ZERO_RESULTS');
        });
    });

    describe('#isZipAddressValidToCountry', () => {
        it('returns true for a valid zip code in Portugal', async () => {
            const input: string = '1000-205';
            const countryCode: string = 'PT';
            const result = await isZipAddressValidToCountry(input, countryCode);
            expect(result).toBe(true);
        });

        it('returns false for a valid zip code with wrong country code', async () => {
            const input: string = '1000-205';
            const countryCode: string = 'ES';
            const result = await isZipAddressValidToCountry(input, countryCode);
            expect(result).toBe(false);
        });

        it('returns true for a valid zip code in Spain', async () => {
            const input: string = '08029';
            const countryCode: string = 'ES';
            const result = await isZipAddressValidToCountry(input, countryCode);
            expect(result).toBe(true);
        });
    });
});
