import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { toPlainAs, toInstance } from '@/helpers/dto'
import { ConfigService } from '@nestjs/config'
import { LogsService } from '@/logs/logs.service'
import { CdrConstants } from '@/constants'
import {
  ApiGetCdrsRequestDto,
  HubjectGetCdrsRequestDto,
  ProcessDataDto,
} from '../dto/get-cdr.dto'
import { ReceiveCdrDto } from '../dto/receive-cdr.dto'
import { ReceiveCdrService } from './receive-cdr.service'
import { firstValueFrom } from 'rxjs'
import { ChargerNetworks } from 'evio-library-commons'

@Injectable()
export class GetCdrService {
  constructor(
    private readonly logger: LogsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly receiveCdrService: ReceiveCdrService,
  ) {
    this.logger.setContext(GetCdrService.name)
  }

  public async manualGet(input: ApiGetCdrsRequestDto): Promise<ProcessDataDto> {

    // Build input process data to use in pagination
    const body = toPlainAs(HubjectGetCdrsRequestDto, input)
    const url = this.configService.get('oicp.endpoints.cdr.get')
    const data = this.buildProcessData(url, body, ChargerNetworks.Hubject)

    // Fetch each cdr and process them accordingly
    await this.paginateService(data)

    return data
  }

  public async get(): Promise<ProcessDataDto> {
    // Build input process data to use in pagination
    const { url, body, source } = await this.preparePullCdrsDataInput()
    const data = this.buildProcessData(url, body, source)

    // Fetch each cdr and process them accordingly
    await this.paginateService(data)
    
    return data
  }

  private buildProcessData(
    url: string,
    body: Record<string, any>,
    source: string,
  ): ProcessDataDto {
    return {
      isLastPage: false,
      isFirstPage: true,
      page: CdrConstants.paginationRequest.page,
      size: CdrConstants.paginationRequest.size,
      numberOfElements: 0,
      url,
      body,
      source,
    }
  }

  private async paginateService(data: ProcessDataDto): Promise<void> {
    try {
      while (!data.isLastPage || data.isFirstPage) {
        // Request
        const response = await firstValueFrom(
          this.httpService.post(
            `${data.url}?page=${data.page}&size=${data.size}`,
            data.body,
          ),
        )

        const { content, totalPages, last, first, numberOfElements } =
          response.data

        await this.processContent(content)

        // Update values for next iteration
        console.log({
          page: data.page,
          size: data.size,
          host: `${data.url}?page=${data.page}&size=${data.size}`,
          numberOfElements,
          totalPages,
        })
        data.page++
        data.isLastPage = last
        data.isFirstPage = first
        data.numberOfElements += numberOfElements
      }
    } catch (error: any) {
      data.page = -1
      this.logger.error(error?.response?.data)
    }
  }

  private async processContent(content: ReceiveCdrDto[]): Promise<void> {
    for (const cdr of content) {
      const cdrInstance = toInstance(ReceiveCdrDto, cdr) as ReceiveCdrDto
      await this.receiveCdrService.receiveCdr(cdrInstance, '')
    }
  }

  private async preparePullCdrsDataInput(
    hoursBack = 24,
    cdrForwarded = false,
  ): Promise<{
    url: string
    body: any
    source: string
  }> {
    const source = ChargerNetworks.Hubject
    const url = this.configService.get('oicp.endpoints.cdr.get')
    const providerId = this.configService.get('oicp.providerId')

    const { from, to } = this.buildTimeWindow(hoursBack)

    const body = toPlainAs(HubjectGetCdrsRequestDto, {
      providerId,
      from,
      to,
      cdrForwarded,
    })

    return { url, body, source }
  }
  
  private buildTimeWindow(hoursBack = 24): { from: string; to: string } {
    const to = new Date()
    const from = new Date(to.getTime() - hoursBack * 60 * 60 * 1000)
    return { from: from.toISOString(), to: to.toISOString() }
  }
}
