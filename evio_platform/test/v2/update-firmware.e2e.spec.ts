import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

jest.mock('axios');

jest.mock('@/v2/chargers/shared/redis.service', () => ({
    RedisService: jest.fn().mockImplementation(() => ({
        getFirmwareStatus: jest.fn().mockResolvedValue({
            status: 'Installing',
            timestamp: new Date().toISOString(),
        }),
    })),
}));

describe('Update Firmware (e2e)', () => {
    let app: INestApplication;
    let httpService: HttpService;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        httpService = app.get<HttpService>(HttpService);
        jest.clearAllMocks();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should return success when firmware update is allowed and no session is active', async () => {
        const hwId = 'test-charger-001';

        jest.spyOn(httpService, 'get').mockImplementationOnce(() =>
            of({
                data: { exists: false },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            } as AxiosResponse)
        );

        jest.spyOn(httpService, 'post').mockImplementationOnce(() =>
            of({
                data: {
                    status: 'Installed',
                    timestamp: new Date().toISOString(),
                },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            } as AxiosResponse)
        );

        const body = {
            location: 'http://firmware.example.com/update.bin',
            retrieveDate: new Date().toISOString(),
        };

        const response = await request(app.getHttpServer())
            .post(`/charger/command/${hwId}/update-firmware`)
            .send(body)
            .expect(200);

        expect(response.body).toHaveProperty('status', 'Installed');
        expect(response.body).toHaveProperty('timestamp');
    });

    it('should return 400 if an active session exists', async () => {
        const hwId = 'test-charger-002';

        jest.spyOn(httpService, 'get').mockImplementation(() =>
            of({
                data: { exists: true },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            } as AxiosResponse)
        );

        const body = {
            location: 'http://firmware.example.com/update.bin',
        };

        const response = await request(app.getHttpServer())
            .post(`/charger/command/${hwId}/update-firmware`)
            .send(body)
            .expect(400);

        expect(response.body.message).toContain('Active charging session');
    });

    it('should return 400 if location is missing', async () => {
        const hwId = 'test-charger-003';

        const response = await request(app.getHttpServer())
            .post(`/charger/command/${hwId}/update-firmware`)
            .send({})
            .expect(400);

        expect(response.body.message).toContain('location must be a string');
    });

    it('should default retrieveDate if not provided', async () => {
        const hwId = 'test-charger-004';

        jest.spyOn(httpService, 'get').mockImplementationOnce(() =>
            of({
                data: { exists: false },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            } as AxiosResponse)
        );

        const postSpy = jest.spyOn(httpService, 'post').mockImplementationOnce(() =>
            of({
                data: {
                    status: 'Downloaded',
                    timestamp: new Date().toISOString(),
                },
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {},
            } as AxiosResponse)
        );

        const body = {
            location: 'http://firmware.example.com/update.bin',
        };

        const response = await request(app.getHttpServer())
            .post(`/charger/command/${hwId}/update-firmware`)
            .send(body)
            .expect(200);

        expect(postSpy).toHaveBeenCalledWith(
            expect.stringContaining('/updateFirmware'),
            expect.objectContaining({
                retrieveDate: expect.any(String),
            })
        );

        expect(response.body).toHaveProperty('status', 'Downloaded');
        expect(response.body).toHaveProperty('timestamp');
    });

    it('should fallback to Redis when OCPP microservice fails', async () => {
        const hwId = 'test-charger-005';

        jest.spyOn(httpService, 'get').mockImplementationOnce(() => {
            return throwError(() => new Error('Microservice unavailable'));
        });

        const response = await request(app.getHttpServer())
            .get(`/charger/status/${hwId}/firmware-update`)
            .expect(200);

        expect(response.body.status).toBe('Installing');
        expect(response.body.timestamp).toBeDefined();
    });

});
