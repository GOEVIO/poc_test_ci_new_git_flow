jest.mock('axios');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { of } from 'rxjs';
import { AppModule } from '@/app.module';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';

describe('Unlock Connector (e2e)', () => {
    let app: INestApplication;
    let httpService: HttpService;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        httpService = app.get<HttpService>(HttpService);

        jest.spyOn(httpService, 'post').mockImplementation(() =>
            of({
                data: { status: 'Unlocked' },
                status: 200,
                statusText: 'OK',
                headers: {} as any,
                config: { headers: {} } as any,
            } as AxiosResponse),
        );

        await app.init();
    });

    afterAll(async () => {
        jest.clearAllMocks();
        await app.close();
    });

    it('should return status "Unlocked" for a valid unlockConnector command', async () => {
        const hwId = 'charger123';
        const connectorId = 1;

        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/unlock-connector/${connectorId}`)
            .expect(200)
            .expect({ status: 'Unlocked' });
    });

    it('should return status "UnlockFailed" if the connector cannot be unlocked', async () => {
        jest.spyOn(httpService, 'post').mockImplementationOnce(() =>
            of({
                data: { status: 'UnlockFailed' },
                status: 200,
                statusText: 'OK',
                headers: {} as any,
                config: { headers: {} } as any,
            } as AxiosResponse),
        );

        const hwId = 'charger123';
        const connectorId = 2;

        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/unlock-connector/${connectorId}`)
            .expect(200)
            .expect({ status: 'UnlockFailed' });
    });

    it('should return status "NotSupported" if the connector lock is not supported', async () => {
        jest.spyOn(httpService, 'post').mockImplementationOnce(() =>
            of({
                data: { status: 'NotSupported' },
                status: 200,
                statusText: 'OK',
                headers: {} as any,
                config: { headers: {} } as any,
            } as AxiosResponse),
        );

        const hwId = 'charger123';
        const connectorId = 3;

        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/unlock-connector/${connectorId}`)
            .expect(200)
            .expect({ status: 'NotSupported' });
    });
});
