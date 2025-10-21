import { describe, expect, it } from '@jest/globals';

import { validateUserPerClientName } from '../../auth/auth';
import { ClientWhiteLabelsEnum } from '../../enums/clientWhiteLabels.enum';
import ClientTypeEnum from '../../enums/clientType.enum';

describe('Auth', () => {
    describe('#validateUserPerClientName', () => {
        it('throws an error to empty headers object', () => {
            const headers = {};
            expect(() => {
                validateUserPerClientName(headers);
            }).toThrow();
        });

        it('throws an error when headers object only have clientname', () => {
            const headers = { clientname: ClientWhiteLabelsEnum.Kinto };
            expect(() => {
                validateUserPerClientName(headers);
            }).toThrow();
        });

        it('returns false when is Kinto via Backoffice and includeWebClient is true', () => {
            const headers = {
                client: ClientTypeEnum.Backoffice,
                clientname: ClientWhiteLabelsEnum.Kinto
            };
            const includeWebClient: boolean = true;
            const expectedResult: boolean = false;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns true when is Kinto via Backoffice and includeWebClient is false', () => {
            const headers = {
                client: ClientTypeEnum.Backoffice,
                clientname: ClientWhiteLabelsEnum.Kinto
            };
            const includeWebClient: boolean = false;
            const expectedResult: boolean = true;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns false when is Kinto via Android and includeWebClient is true', () => {
            const headers = {
                client: ClientTypeEnum.Android,
                clientname: ClientWhiteLabelsEnum.Kinto
            };
            const includeWebClient: boolean = true;
            const expectedResult: boolean = false;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns false when is Kinto via IOS and includeWebClient is true', () => {
            const headers = {
                client: ClientTypeEnum.IOS,
                clientname: ClientWhiteLabelsEnum.Kinto
            };
            const includeWebClient: boolean = true;
            const expectedResult: boolean = false;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns false when is Kinto via IOS and includeWebClient is false', () => {
            const headers = {
                client: ClientTypeEnum.IOS,
                clientname: ClientWhiteLabelsEnum.Kinto
            };
            const includeWebClient: boolean = false;
            const expectedResult: boolean = false;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns true when is non-Kinto via Android and includeWebClient is true', () => {
            const headers = {
                client: ClientTypeEnum.Android,
                clientname: ClientWhiteLabelsEnum.Hyundai
            };
            const includeWebClient: boolean = true;
            const expectedResult: boolean = true;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns true when is non-Kinto via IOS and includeWebClient is true', () => {
            const headers = {
                client: ClientTypeEnum.IOS,
                clientname: ClientWhiteLabelsEnum.Hyundai
            };
            const includeWebClient: boolean = true;
            const expectedResult: boolean = true;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });

        it('returns true when is non-Kinto via Backoffice and includeWebClient is true', () => {
            const headers = {
                client: ClientTypeEnum.Backoffice,
                clientname: ClientWhiteLabelsEnum.Hyundai
            };
            const includeWebClient: boolean = true;
            const expectedResult: boolean = true;
            const result: boolean = validateUserPerClientName(headers, includeWebClient);

            expect(result).toBe(expectedResult);
        });
    });
});
