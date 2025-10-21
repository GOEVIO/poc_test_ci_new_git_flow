import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { LogActionDto } from './dto/log-action.dto';

@Injectable()
export class AuditLogService {
    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogRepository: Repository<AuditLog>,
    ) { }

    async logAction(dto: LogActionDto): Promise<void> {
        const logEntry = this.auditLogRepository.create(dto);
        await this.auditLogRepository.save(logEntry);
    }
}