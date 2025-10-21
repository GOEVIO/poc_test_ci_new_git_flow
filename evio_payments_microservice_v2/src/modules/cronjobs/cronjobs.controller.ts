import { Controller, InternalServerErrorException, Post } from '@nestjs/common'
import { CronService } from './cronjobs.service'

@Controller('jobs')
export class CronjobsController {
  constructor(private readonly cronService: CronService) {}

  @Post('preauthorisation/extend')
  async extendPreAuthorisation(): Promise<any> {
    try {
      return await this.cronService.extendPreAuthorisation()
    } catch (error) {
      throw new InternalServerErrorException({ error: error.message })
    }
  }
}
