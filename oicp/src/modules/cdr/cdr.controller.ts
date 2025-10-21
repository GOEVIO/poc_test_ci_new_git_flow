import {
  Controller,
  Post,
  HttpCode,
  Body,
  Param,
  UseInterceptors,
} from '@nestjs/common'
import { ReceiveCdrService } from './services/receive-cdr.service'
import { GetCdrService } from './services/get-cdr.service'
import { ReceiveCdrDto } from './dto/receive-cdr.dto'
import { ApiGetCdrsRequestDto, ProcessDataDto } from './dto/get-cdr.dto'
import { eRoamingAcknowledgementDto } from '@/shared/dto/acknowledgement.dto'
import { ReceiverInterceptor } from '@/interceptors/receiver.interceptor'

@Controller('')
export class CdrController {
  constructor(
    private readonly receiveCdrService: ReceiveCdrService,
    private readonly getCdrService: GetCdrService
  ) {}

  @UseInterceptors(ReceiverInterceptor)
  @HttpCode(200)
  @Post('api/oicp/cdrmgmt/v22/operators/:operatorId/charge-detail-record')
  receiveCdr(
    @Param('operatorId') operatorId: string,
    @Body() cdr: ReceiveCdrDto): Promise<eRoamingAcknowledgementDto> {
    return this.receiveCdrService.receiveCdr(cdr, operatorId)
  }

  @HttpCode(200)
  @Post('oicp/cdr/manual-job')
  manualGet(
    @Body() data: ApiGetCdrsRequestDto
  ) : Promise<ProcessDataDto> {
    return this.getCdrService.manualGet(data);
  }

  @HttpCode(200)
  @Post('oicp/cdr/job')
  get() : Promise<ProcessDataDto> {
    return this.getCdrService.get();
  }
}
