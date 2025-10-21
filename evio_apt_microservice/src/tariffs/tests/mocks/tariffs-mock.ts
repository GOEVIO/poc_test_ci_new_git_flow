import { OcpiTariffDimenstionType } from 'evio-library-commons'
import {
  AptTariffElements,
  AptTariffPriceComponents,
  AptTariffRestrictions,
  AptTariffsDetails,
} from '../../../database/entities'

export const tariffsRestrictions: AptTariffRestrictions = {
  day_of_week: ['MONDAY', 'TUESDAY'],
  min_duration: 30,
  start_time: '08:00',
  end_time: '18:00',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  min_kwh: 10,
  max_kwh: 100,
  min_current: 10,
  max_current: 100,
  min_power: 10,
  max_power: 100,
  max_duration: 60,
  reservation: 'RESERVATION',
}

export const tariffsPriceComponents: AptTariffPriceComponents = {
  type: OcpiTariffDimenstionType.Energy,
  price: 0.2,
  vat: 0.2,
  step_size: 1,
}

export const tariffsElements: AptTariffElements = {
  price_components: [tariffsPriceComponents],
  restrictions: tariffsRestrictions,
}

export const tariffsDetails: AptTariffsDetails = {
  tariff_owner: 'CEME',
  elements: [tariffsElements],
}

export const tariffsRestrictionsToUpdate: AptTariffRestrictions = {
  ...tariffsRestrictions,
  id: '550e8400-e29b-41d4-a716-446655440000',
}

export const tariffsPriceComponentsToUpdate: AptTariffPriceComponents = {
  ...tariffsPriceComponents,
  id: '550e8400-e29b-41d4-a716-446655440000',
}

export const tariffsElementsToUpdate: AptTariffElements = {
  price_components: [tariffsPriceComponentsToUpdate],
  restrictions: tariffsRestrictionsToUpdate,
  id: '550e8400-e29b-41d4-a716-446655440000',
}

export const tariffsDetailsToUpdate: AptTariffsDetails = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tariff_owner: 'CEME',
  elements: [tariffsElementsToUpdate],
}
