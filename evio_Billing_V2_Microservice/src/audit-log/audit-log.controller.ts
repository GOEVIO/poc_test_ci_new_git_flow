import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { LogActionDto } from './dto/log-action.dto';

@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Post('log')
  async createLog(@Body() logActionDto: LogActionDto): Promise<void> {
    await this.auditLogService.logAction(logActionDto);
  }
}
