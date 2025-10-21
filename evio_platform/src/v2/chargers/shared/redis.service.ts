import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigType } from '@nestjs/config';
import { redis as redisConfiguration } from '../../../config/';

@Injectable()
export class RedisService {
    private client: Redis;

    constructor(
        @Inject(redisConfiguration.KEY)
        private redisConfig: ConfigType<typeof redisConfiguration>
    ) {
        this.client = new Redis({
            sentinels: [
                {
                    host: this.redisConfig.sentinelHost1,
                    port: this.redisConfig.sentinelPort,
                },
                {
                    host: this.redisConfig.sentinelHost2,
                    port: this.redisConfig.sentinelPort,
                },
                {
                    host: this.redisConfig.sentinelHost3,
                    port: this.redisConfig.sentinelPort,
                },
            ],
            name: this.redisConfig.masterName,
        });

        this.client.on('error', (err) => {
            console.error('[RedisService] Redis connection error:', err.message);
        });
    }

    async getFirmwareStatus(hwId: string): Promise<{ status: string; timestamp: string } | null> {
        const key = `firmware_status:${hwId}`;
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }

    async getDiagnosticStatus(hwId: string): Promise<{ status: string; timestamp: string } | null> {
        const key = `diagnostic_status:${hwId}`;
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }
}
