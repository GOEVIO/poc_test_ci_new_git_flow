import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { PricingProductService } from './services/pricing-product.service';
import { EvsePricingService } from './services/evse-pricing.service';
import {
  ApiBadGatewayResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger'
import { defaultErrorSchema } from '@/shared/schema/default-error'

@Controller('oicp/tariff')
export class TariffController {
  constructor(
    private readonly pricingProductService: PricingProductService,
    private readonly evsePricingService: EvsePricingService
  ) {}

  @ApiOperation({
    summary: 'Pull all Dynamic Pricing tariffs from Hubject',
  })
  @ApiOkResponse({
    description: 'Example sent successfully',
  })
  @ApiBadGatewayResponse({
    description: 'Error sending example',
    schema: defaultErrorSchema,
  })
  @HttpCode(200)
  @Post('job/pricingProductData/full')
  pullFullPricingProductData() {
    return this.pricingProductService.pullFullPricingProductData();
  }

  @HttpCode(200)
  @Post('job/pricingProductData/delta')
  pullDeltaPricingProductData() {
    return this.pricingProductService.pullDeltaPricingProductData();
  }

  @HttpCode(200)
  @Post('job/evsePricing/full')
  pullFullEvsePricing() : Promise<any> {
    return this.evsePricingService.pullFullEvsePricing();
  }

  @HttpCode(200)
  @Post('job/evsePricing/delta')
  pullDeltaEvsePricing() : Promise<any> {
    return this.evsePricingService.pullDeltaEvsePricing();
  }
}
