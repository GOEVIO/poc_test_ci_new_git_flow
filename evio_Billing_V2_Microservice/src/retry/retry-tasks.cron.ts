import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RetryService } from './retry.service';

@Injectable()
export class RetryTasksCron {
  private readonly logger = new Logger(RetryTasksCron.name);

  constructor(private readonly retryService: RetryService) {}

  async handleRetries() {
    this.logger.log('Checking for scheduled retry tasks...');
    await this.retryService.processRetries();
  }
}