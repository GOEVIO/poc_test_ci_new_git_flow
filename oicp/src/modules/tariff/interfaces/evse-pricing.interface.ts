import {ITariff} from './pricing-product.interface'

export interface IEvsePricing {
  OperatorID: string
  OperatorName: string
  EVSEPricing: IEvsePricingData[]
}

interface IEvsePricingData {
  EvseID: string
  ProviderID: string
  EvseIDProductList: string[]
}

export interface IEvsePricingResponse {
  EVSEPricing: IEvsePricing[]
  StatusCode: IStatusCode
}

interface IStatusCode {
  AdditionalInfo: string
  Code: string
  Description: string
}

export interface ITariffIdUpdateOperation {
  updateOne: {
    filter: {
      'plugs.evse_id': string
      source: string
      operationalStatus: { $ne: string }
    };
    update: {
      $set: {
        "plugs.$[plug].tariffId": string[];
        'plugs.$[plug].serviceCost.tariffs': Partial<ITariff>[]
      };
      $currentDate: {
        updatedAt: true;
      };
    };
    arrayFilters: Array<{
      "plug.evse_id": string;
    }>;
  };
}
