import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { ControllerResult } from '../common/result-wrappers'
import { PaymentsLibraryService } from '../libraries/payments/payments-library.service'
import { BillingBodyDto } from './update-billing.dto'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { defaultTin, emails, TinType } from 'evio-library-commons'
@Controller('billing')
@ApiTags('Billing')
export class BillingController {
  constructor(
    private readonly paymentsLibraryService: PaymentsLibraryService
  ) {}

  @Post('preauthorisation/:id/billing')
  @ApiOperation({
    summary: 'Update billing information for a charging session',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing information updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input or update failed' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createBillingInfo(
    @Param('id') id: string,
    @Body() body: BillingBodyDto,
    @Headers('language') language: string
  ): Promise<ControllerResult> {
    try {
      if (body?.address && body.address?.street.trim() !== '') {
        const [street, number, floor] = body.address?.street.split(',')
        body.address = {
          ...body.address,
          street: street?.trim(),
          number: number?.trim(),
          floor: floor?.trim(),
        }
      }

      const data = await this.paymentsLibraryService.updatePreAuthorizationById(
        id,
        { billingInfo: { ...body, language } }
      )

      return {
        message: 'Billing information updated successfully',
        success: true,
        data,
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error
      } else {
        throw new BadRequestException({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update billing information',
          code:
            typeof error === 'object' && error !== null && 'response' in error
              ? (error as any)?.response?.code
              : 'update_billing_info_failed',
        })
      }
    }
  }

  @Post('preauthorisation/:id/billing/default')
  @ApiOperation({
    summary: 'Update default billing information for a charging session',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing information updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input or update failed' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createDefaultBillingInfo(
    @Param('id') id: string,
    @Headers('language') language: string
  ): Promise<ControllerResult> {
    try {
      const data = await this.paymentsLibraryService.updatePreAuthorizationById(
        id,
        {
          billingInfo: {
            name: 'Final Consumer',
            email: emails.SupportEvio,
            tin: defaultTin,
            viesVat: false,
            clientType: TinType.PRIVATE,
            language,
          },
        }
      )

      return {
        message: 'Billing information updated successfully',
        success: true,
        data,
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error
      } else {
        throw new BadRequestException({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update billing information',
          code:
            typeof error === 'object' && error !== null && 'response' in error
              ? (error as any)?.response?.code
              : 'update_billing_info_failed',
        })
      }
    }
  }

  @Get('preauthorisation/:id/status')
  @ApiOperation({ summary: 'Get billing status for a charging session' })
  @ApiResponse({
    status: 200,
    description: 'Billing status retrieved successfully',
  })
  async getBillingStatus(@Param('id') id: string): Promise<{ status: string }> {
    try {
      const status =
        await this.paymentsLibraryService.getPreAuthorizationBillingStatusById(
          id
        )
      return { status }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error
      } else {
        throw new BadRequestException({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to retrieve billing status',
          code:
            typeof error === 'object' && error !== null && 'response' in error
              ? (error as any)?.response?.code
              : 'get_billing_status_failed',
        })
      }
    }
  }
}
