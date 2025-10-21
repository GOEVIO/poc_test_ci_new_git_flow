import { Controller, Post, Req, Logger, Body, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { Request } from 'express';

@Controller('session')
export class SessionController {
  private readonly logger = new Logger(SessionController.name);

  constructor(
    private readonly sessionService: SessionService,
  ) { }

  @Post('ad_hoc')
  async processAdhocSession(@Req() request: Request) {
    const sessionId = request.body.sessionId;
    const cdrId = request.body.cdrId;
    await this.sessionService.handleAdHocSession(sessionId, cdrId);
    return { message: 'Process to adhoc finished' };
  }

  @Post('periodic')
  async processPeriodicSessions(
    @Body('type') type: string,
    @Body('userId') userId?: string 
  ) {
    const validTypes = ['WEEKLY', 'BI_WEEKLY', 'MONTHLY'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    await this.sessionService.handlePeriodicSession(type, userId);
    return { message: `Session collection triggered for type: ${type}` };
  }

  @Post('adhoc_missing')
  async processAdhocMissingSessions() {
    const context = 'processAdhocMissingSessions';
    this.logger.log(`[${context}] Starting processing...`);
    try {
      await this.sessionService.handleAdHocMissingSessions();
      this.logger.log(`[${context}] Completed processing.`);
      return { message: 'Ad-hoc missing sessions processed' };
    } catch (error) {
      this.logger.error(`[${context}] Error during processing:`, error);
      throw error;
    }
  } 

  @Post('adhoc/reprocess')
  async reprocessAdhocSessions(@Req() request: Request) {
    this.logger.log(`Reprocessing ad-hoc session with sessionId: ${request.body.sessionId} and cdrId: ${request.body.cdrId}`);
    if (!request.body || !request.body.sessionId || !request.body.cdrId) {
      this.logger.error('Both sessionId and cdrId are required for reprocessing');    
      throw new BadRequestException('Both sessionId and cdrId are required for reprocessing');
    }

    await this.sessionService.reprocessAdHocSession(request.body.sessionId, request.body.cdrId);
    this.logger.log(`Reprocessing of ad-hoc session with sessionId: ${request.body.sessionId} completed`);
    return { message: 'Reprocessing of ad-hoc session completed' };
  }
}
