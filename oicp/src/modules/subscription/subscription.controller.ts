import { Controller, Post, Get, Body, Param, Put, Delete } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { Subscription } from './subscription.schema'
import { ApiBody, ApiOperation, ApiParam } from '@nestjs/swagger'

@Controller('oicp/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionsService: SubscriptionService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new subscription',
    description: 'Creates a new subscription with the provided details.',
  })
  @ApiBody({
    type: Subscription,
    required: true,
    description: 'Subscription details',
  })
  create(@Body() body: Partial<Subscription>) {
    return this.subscriptionsService.create(body)
  }

  @Get()
  @ApiOperation({
    summary: 'Get all subscriptions',
    description: 'Retrieves all subscriptions.',
  })
  findAll() {
    return this.subscriptionsService.findAll()
  }

  @Get('operatorIDs')
  @ApiOperation({
    summary: 'Get all operator IDs',
    description: 'Retrieves all operator IDs.',
  })
  getOperatorIds() {
    return this.subscriptionsService.getOperatorIds()
  }

  @Get(':operatorID')
  @ApiOperation({
    summary: 'Get subscription by operator ID',
    description: 'Retrieves a subscription by its operator ID.',
  })
  @ApiParam({
    name: 'operatorID',
    description: 'The operator ID of the subscription',
    required: true,
    type: String,
  })
  findOne(@Param('operatorID') operatorID: string) {
    return this.subscriptionsService.findByOperatorId(operatorID)
  }

  @Put(':operatorID')
  @ApiOperation({
    summary: 'Update a subscription',
    description: 'Updates the subscription with the provided operator ID.',
  })
  @ApiParam({
    name: 'operatorID',
    description: 'The operator ID of the subscription to update',
    required: true,
    type: String,
  })
  @ApiBody({
    type: Subscription,
    required: false,
    description: 'Updated subscription details',
  })
  update(
    @Param('operatorID') operatorID: string,
    @Body() body: Partial<Subscription>,
  ) {
    return this.subscriptionsService.update(operatorID, body)
  }

  @Delete(':operatorID')
  @ApiOperation({
    summary: 'Delete a subscription',
    description: 'Deletes the subscription with the provided operator ID.',
  })
  @ApiParam({
    name: 'operatorID',
    description: 'The operator ID of the subscription to delete',
    required: true,
    type: String,
  })
  delete(@Param('operatorID') operatorID: string) {
    return this.subscriptionsService.delete(operatorID)
  }
}
