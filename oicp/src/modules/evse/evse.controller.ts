import { Body, Controller, HttpCode, Post, Query, Get } from '@nestjs/common'
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger'
import { ProcessDataDto, PullEvseDataDto } from './evse.dto'
import { EvseService } from './evse.service'
import { defaultErrorSchema } from '@/shared/schema/default-error'

@Controller({ path: 'oicp/evse', version: '2.3' })
export class EvseController {
  constructor(private readonly evseService: EvseService) {}

  @ApiOperation({
    summary: 'Pull all Evse Data with input filters',
  })
  @ApiOkResponse({
    description: 'Example sent successfully',
    type: ProcessDataDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending example',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    type: PullEvseDataDto,
    required: true,
    description: 'Valid filters',
  })
  @HttpCode(200)
  @Post('data')
  async pullEvseData(
    @Body() pullEVSEDataMessage: PullEvseDataDto,
  ): Promise<ProcessDataDto> {
    return await this.evseService.pullEvseData(pullEVSEDataMessage)
  }



  @ApiOperation({
    summary: 'Fetch evse data in full mode',
  })
  @ApiOkResponse({
    description: 'Example sent successfully',
    type: ProcessDataDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending example',
    schema: defaultErrorSchema,
  })

  @HttpCode(200)
  @Post('job/full')
  async fullEvseDataRequest(): Promise<ProcessDataDto> {
    return await this.evseService.fullEvseDataRequest()
  }

  
  @ApiOperation({
    summary: 'Fetch evse data in delta mode',
  })
  @ApiOkResponse({
    description: 'Example sent successfully',
    type: ProcessDataDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending example',
    schema: defaultErrorSchema,
  })

  @HttpCode(200)
  @Post('job/delta')
  async deltaEvseDataRequest(): Promise<ProcessDataDto> {
    return await this.evseService.deltaEvseDataRequest()
  }

  @ApiOperation({
    summary: 'Pull status from all evses',
  })
  @ApiOkResponse({
    description: 'Example sent successfully',
    type: ProcessDataDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending example',
    schema: defaultErrorSchema,
  })

  @HttpCode(200)
  @Post('job/status')
  async pullEvseStatusJobProcess(): Promise<any> {
    return await this.evseService.pullEvseStatusJobProcess()
  }


  @Get('status')
  async statusByEvseId(
    @Query('evseId') evseId: string
  ): Promise<string> {
    return await this.evseService.getEvseStatusById(evseId)
  }
}
