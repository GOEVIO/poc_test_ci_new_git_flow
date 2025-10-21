import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { ExampleDto } from './dto/example.dto'
import { LogsService } from '@/logs/logs.service'
import { serviceUrl } from '@/config'

@Injectable()
export class AssetsService {
  constructor(
    @Inject(serviceUrl.KEY)
    private serviceUrlConfig: ConfigType<typeof serviceUrl>,
    private readonly logger: LogsService,
  ) {
    // Verifique se a configuração foi injetada corretamente
    this.logger.setContext(AssetsService.name)
  }

  async doExample(example: ExampleDto): Promise<ExampleDto> {
    try {
      console.log(
        `Protocols supported: ${JSON.stringify(this.serviceUrlConfig)}`,
      )
      return await new Promise((r) => r(example))
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }
}
