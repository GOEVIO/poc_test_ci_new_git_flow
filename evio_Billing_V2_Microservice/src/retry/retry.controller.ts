import { Controller, Get } from '@nestjs/common';
import { RetryService } from './retry.service';

@Controller('retry')
export class RetryController {
  constructor(private readonly retryService: RetryService) {}

  @Get('process')
  async triggerProcessing() {
    return this.retryService.processRetries();
  }
}
