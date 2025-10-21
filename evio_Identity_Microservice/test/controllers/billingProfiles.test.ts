import { describe, expect, it } from '@jest/globals';

import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import app from '../../app';
import ClientTypeEnum from '../../enums/clientType.enum';
import { ClientWhiteLabelsEnum } from '../../enums/clientWhiteLabels.enum';

describe('Billing Profiles', () => {
    const PATH: string = '/api/private/billingProfile';

    describe(`PATCH ${PATH}`, () => {
        it('returns HTTP 500 for empty headers, because validateUserPerClientName method need refactor', async () => {
            const response = await request(app)
                .patch(PATH);
            expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        });

        it('returns HTTP 400 for request with non-valid client data', async () => {
            const response = await request(app)
                .patch(PATH)
                .set('clientname', ClientWhiteLabelsEnum.Kinto)
                .set('client', ClientTypeEnum.Backoffice);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                auth: false,
                code: 'action_not_allowed',
                message: 'Action not allowed',
            });
        });

        it('returns HTTP 400 for request without billing profile id', async () => {
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'billing_profile_id_missing',
                message: 'Billing Profile id missing',
            });
        });

        it('returns HTTP 400 for request without nif', async () => {
            const body = {
                _id: '5f5e3e3e3e3e3e3e3e3e3e3e',
            };
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android)
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'nif_missing',
                message: 'NIF missing',
            });
        });

        it('returns HTTP 400 for request without billingAddress', async () => {
            const body = {
                _id: 'valid_id',
                nif: 'valid_nif',
            };
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android)
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'billingAddress_missing',
                message: 'Billing address missing',
            });
        });

        it('returns HTTP 400 for request without billingName', async () => {
            const body = {
                _id: 'valid_id',
                nif: 'valid_nif',
                billingAddress: { },
            };
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android)
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'billingName_missing',
                message: 'Billing name missing',
            });
        });

        it('returns HTTP 400 for request with invalid countryCode', async () => {
            const body = {
                _id: 'valid_id',
                nif: 'valid_nif',
                billingName: 'valid_billing_name',
                billingAddress: {
                    countryCode: 'pt',
                    zipCode: '4999-790',
                },
            };
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android)
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'invalid_billing_address_country_code',
                message: 'Invalid Billing address country code',
            });
        });

        it('returns HTTP 400 for request with empty zipCode and countryCode PT', async () => {
            const body = {
                _id: 'valid_id',
                nif: 'valid_nif',
                billingName: 'valid_billing_name',
                billingAddress: {
                    countryCode: 'PT',
                    zipCode: '',
                },
            };
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android)
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'zipCode_invalid',
                message: 'zipCode is not valid',
            });
        });

        it('returns HTTP 400 for request with invalid zipCode and countryCode PT', async () => {
            const body = {
                _id: 'valid_id',
                nif: 'valid_nif',
                billingName: 'valid_billing_name',
                billingAddress: {
                    countryCode: 'PT',
                    zipCode: 'invalid_zip_code',
                },
            };
            const response = await request(app)
                .patch(PATH)
                .set('clientname', 'test')
                .set('client', ClientTypeEnum.Android)
                .send(body);
            expect(response.status).toBe(StatusCodes.BAD_REQUEST);
            expect(response.body).toEqual({
                code: 'zipCode_invalid',
                message: 'zipCode is not valid',
            });
        });
    });
});
