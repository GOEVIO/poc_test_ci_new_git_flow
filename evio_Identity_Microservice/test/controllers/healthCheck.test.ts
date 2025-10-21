import * as path from 'path';
import { describe, expect, it } from '@jest/globals';

import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import Constants from '../../utils/constants';
import app from '../../app';
import HealthCheckController, { HealthCheckResponse } from '../../controllers/healthCheck';

/* tslint:disable no-var-requires */
const { name, version } = require(path.resolve('./package.json'));

describe('HealthCheckController', () => {
    it('should return health check message', async () => {
        const controller = new HealthCheckController();
        const response = await controller.getData();

        expect(response.name).toBe(name);
        expect(response.version).toBe(version);
        expect(response.environment).toBe(Constants.environment);
    });

    describe('GET /', () => {
        it('returns HTTP 200 and desired information on body', async () => {
            const response = await request(app).get('/api/private/healthCheck');
            const expectedBody: HealthCheckResponse = {
                name,
                version,
                environment: Constants.environment,
            };

            expect(response.status).toBe(StatusCodes.OK);
            expect(response.body).toEqual(expectedBody);
        });
    });
});
