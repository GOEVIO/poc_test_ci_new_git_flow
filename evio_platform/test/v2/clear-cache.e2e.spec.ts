jest.mock('axios');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { of } from 'rxjs';
import { AppModule } from '@/app.module';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';

describe('Clear Cache (e2e)', () => {
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
                data: { status: 'Cleared' },
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

    it('should return status "Cleared" for a valid clearCache command', async () => {
        const hwId = 'charger123';

        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/clear-cache`)
            .expect(200)
            .expect({ status: 'Cleared' });
    });

    it('should return status "ClearCacheFailed" if the clear cache command fails', async () => {
        jest.spyOn(httpService, 'post').mockImplementationOnce(() =>
            of({
                data: { status: 'ClearCacheFailed' },
                status: 200,
                statusText: 'OK',
                headers: {} as any,
                config: { headers: {} } as any,
            } as AxiosResponse),
        );

        const hwId = 'charger123';

        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/clear-cache`)
            .expect(200)
            .expect({ status: 'ClearCacheFailed' });
    });

    it('should return status "NotSupported" if the clear cache command is not supported', async () => {
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

        return request(app.getHttpServer())
            .post(`/charger/command/${hwId}/clear-cache`)
            .expect(200)
            .expect({ status: 'NotSupported' });
    });
});
