import { Injectable } from '@nestjs/common';
import { RedisService } from '../shared/redis.service';

@Injectable()
export class DiagnosticStatusService {
    constructor(private readonly redisService: RedisService) {}

    async getStatus(hwId: string): Promise<{ status: string; timestamp: string } | null> {
        return await this.redisService.getDiagnosticStatus(hwId);
    }
}
