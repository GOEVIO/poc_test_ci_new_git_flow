import { describe, expect, it } from '@jest/globals';
import { isValidPortugueseZipCode, isValidEmail, isValidPortugueseMobilePhone } from '../../utils';

describe('Validation Utils', () => {
    describe('#isValidPortugueseZipCode', () => {
        it('returns true when zip code is valid', () => {
            const zipCode = '1000-100';
            const result = isValidPortugueseZipCode(zipCode);
            expect(result).toBe(true);
        });

        it('returns false when zip code is invalid (without -)', () => {
            const zipCode = '1000100';
            const result = isValidPortugueseZipCode(zipCode);
            expect(result).toBe(false);
        });

        it('returns false when zip code is invalid (with space instead -)', () => {
            const zipCode = '1000 100';
            const result = isValidPortugueseZipCode(zipCode);
            expect(result).toBe(false);
        });
    });

    describe('#isValidEmail', () => {
        it('returns false to invalid format email', () => {
            let email = 'testinho.com';
            let result = isValidEmail(email);
            expect(result).toBe(false);
            email = 'test@.com';
            result = isValidEmail(email);
            expect(result).toBe(false);
            email = '@go-evio.com';
            result = isValidEmail(email);
            expect(result).toBe(false);
            email = 'cenas@go-evio';
            result = isValidEmail(email);
            expect(result).toBe(false);
        });

        it('returns true to valid format email', () => {
            let email = 'coisas@go-evio.com';
            let result = isValidEmail(email);
            expect(result).toBe(true);
            email = 'SKJDJ#@go-evio.com';
            result = isValidEmail(email);
            expect(result).toBe(true);
        });
    });

    describe('#isValidPortugueseMobilePhone', () => {
        it('returns false to invalid format Portuguese mobile number', () => {
            let mobile = 'cenas';
            let result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(false);
            mobile = '55151514';
            result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(false);
            mobile = '51251515615641651615';
            result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(false);
            mobile = '5ds145f41sdavfc1';
            result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(false);
            mobile = '998071799';
            result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(false);
            mobile = '229485931';
            result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(false);
            
        });

        it('returns true to valid format Portuguese mobile number', () => {
            let mobile = '918152266';
            let result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(true);
            mobile = '968152266';
            result = isValidPortugueseMobilePhone(mobile);
            expect(result).toBe(true);
        });
    });
});