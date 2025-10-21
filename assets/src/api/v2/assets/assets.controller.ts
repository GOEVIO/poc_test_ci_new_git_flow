import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common'
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger'

import {
  PageNumberPipe,
  PageSizePipe,
} from '@/shared/pagination/pagination.pipe'
import { ParseClientTypePipe } from '@/shared/pipes/client-type.pipe'
import { ParseOptionalDatePipe } from '@/shared/pipes/parse-optional-date.pipe'
import { defaultErrorSchema } from '@/shared/schema/default-error'
import { ClientTypeType } from '@/shared/types/client-type.type'
import { ExampleDto } from './dto/example.dto'
import {
  OverviewDataDto,
  OverviewDto,
  OverviewFiltersDto,
} from './overview/overview.dto'
import { AssetsService } from './assets.service'
import { OverviewService } from './overview/overview.service'

@Controller({ path: 'assets', version: '2' })
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly overviewService: OverviewService,
  ) {}

  @ApiOperation({
    summary: 'Send an example',
  })
  @ApiOkResponse({
    description: 'Example sent successfully',
    type: ExampleDto,
  })
  @ApiBadGatewayResponse({
    description: 'Error sending example',
    schema: defaultErrorSchema,
  })
  @ApiBody({
    type: ExampleDto,
    required: true,
    description: 'Example to send',
  })
  @HttpCode(200)
  @Post('example')
  async doExample(@Body() example: ExampleDto): Promise<ExampleDto> {
    return await this.assetsService.doExample(example)
  }

  @ApiOperation({
    summary: 'Retrieves assets overview',
  })
  @ApiBadGatewayResponse({
    description: 'Any of the query params is unparseable',
  })
  @Get('overview')
  async overview(
    @Query('pageNumber', PageNumberPipe) pageNumber: number,
    @Query('pageSize', PageSizePipe) pageSize: number,
    @Query('dateFrom', ParseOptionalDatePipe) dateFrom?: Date,
    @Query('dateThru', ParseOptionalDatePipe) dateThru?: Date,
    @Query('clientType', ParseClientTypePipe) clientType?: ClientTypeType,
    @Query('createUser') createUser?: string,
  ): Promise<OverviewDto> {
    const pagination = { pageNumber, pageSize }
    const data = await this.overviewService.get(pagination, {
      dateFrom,
      dateThru,
      clientType,
      createUser,
    })
    return new OverviewDto(
      data,
      pagination,
      new OverviewFiltersDto(dateFrom, dateThru, clientType, createUser),
    )
  }

  @ApiOperation({
    summary: 'Retrieves assets overview without pagination',
  })
  @ApiBadGatewayResponse({
    description: 'Any of the query params is unparseable',
  })
  @Get('overview/all')
  async rawOverview(
    @Query('dateFrom', ParseOptionalDatePipe) dateFrom?: Date,
    @Query('dateThru', ParseOptionalDatePipe) dateThru?: Date,
    @Query('clientType', ParseClientTypePipe) clientType?: ClientTypeType,
    @Query('createUser') createUser?: string,
  ): Promise<OverviewDataDto[]> {
    const pagination = { pageNumber: -1, pageSize: -1 }
    return await this.overviewService.get(pagination, {
      dateFrom,
      dateThru,
      clientType,
      createUser,
    })
  }
}
