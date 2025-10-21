jest.mock('axios');

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { RedisService } from '@/v2/chargers/shared/redis.service';

describe('Get Diagnostics Status (e2e)', () => {
    let app: INestApplication;
    let redisService: RedisService;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(RedisService)
            .useValue({
                getDiagnosticStatus: jest.fn(),
            })
            .compile();

        app = moduleFixture.createNestApplication();

        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        redisService = moduleFixture.get<RedisService>(RedisService);
        await app.init();
    });

    afterEach(async () => {
        await app.close();
        jest.clearAllMocks();
    });

    it('should return diagnostics status from Redis', async () => {
        const hwId = 'test-hw-123';

        const mockData = {
            status: 'Uploaded',
            timestamp: new Date().toISOString(),
        };

        (redisService.getDiagnosticStatus as jest.Mock).mockResolvedValue(mockData);

        const response = await request(app.getHttpServer())
            .get(`/charger/status/${hwId}/diagnostics`)
            .expect(200);

        expect(response.body).toEqual(mockData);
    });

    it('should return 404 if status not found in Redis', async () => {
        const hwId = 'test-hw-not-found';

        (redisService.getDiagnosticStatus as jest.Mock).mockResolvedValue(null);

        const response = await request(app.getHttpServer())
            .get(`/charger/status/${hwId}/diagnostics`)
            .expect(404);

        expect(response.body.message).toContain('No diagnostics status found');
    });
});
