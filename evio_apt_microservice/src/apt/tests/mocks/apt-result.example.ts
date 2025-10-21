import { OcpiTariffDimenstionType } from 'evio-library-commons'
import { Apt } from '../../../database/entities/apt.entity'

export const MockAptResultExample: Apt = {
  id: '44c7d061-e700-4b37-a9be-5330b3600235',
  brand: 'Some Brand',
  model: 'Model X',
  financial_provider: 'Financial Provider Name',
  firmware_version: '1.0.0',
  android_application_version: '2.0.0',
  has_sim_card: true,
  number_of_chargers: 3,
  chargers: [
    {
      hwId: 'hwId1',
      id: '44c7d061-e700-4b37-a9be-5330b3600742',
      charger_type: '004',
      plugs: [
        {
          plug_id: 'plugId1',
          id: '44c7d061-e700-4b37-a9be-5330b3600741',
          tariffs_detail: {
            tariff_owner: 'Tariff Owner 1',
            id: '44c7d061-e700-4b37-a9be-5330b3600744',
            elements: [
              {
                id: '44c7d061-e700-4b37-a9be-5330b3600745',
                restrictions: {
                  id: '44c7d061-e700-4b37-a9be-5330b3600745',
                  day_of_week: ['Monday', 'Tuesday'],
                  min_duration: 30,
                  start_time: '08:00',
                  end_time: '20:00',
                  start_date: '2025-01-01',
                  end_date: '2025-12-31',
                  min_kwh: 10,
                  max_kwh: 100,
                  min_current: 5,
                  max_current: 32,
                  min_power: 220,
                  max_power: 350,
                  max_duration: 5.0,
                },
                price_components: [
                  {
                    type: OcpiTariffDimenstionType.Flat,
                    price: 0.23,
                    vat: 0.05,
                    step_size: 1,
                    id: '44c7d061-e700-4b37-a9be-5330b3600746',
                  },
                  {
                    type: OcpiTariffDimenstionType.Energy,
                    price: 0.23,
                    vat: 0.85,
                    step_size: 1,
                    id: '44c7d061-e700-4b37-a9be-5330b3600747',
                  },
                  {
                    type: OcpiTariffDimenstionType.Energy,
                    price: 0.23,
                    vat: 0.05,
                    step_size: 1,
                    id: '44c7d061-e700-4b37-a9be-5330b3600748',
                  },
                  {
                    type: OcpiTariffDimenstionType.ParkingTime,
                    price: 0.23,
                    vat: 0.05,
                    step_size: 1,
                    id: '44c7d061-e700-4b37-a9be-5330b3600749',
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
  networks_available: ['Network1', 'Network2'],
  tariff_type: 'AD_HOC',
  description_of_the_agreement: 'Description of the Agreement',
  serial_number: '000353535',
  user_id: '688ce949e8a4a0e373ba0a22',
  created_at: '2025-08-01T15:20:25.260Z',
  updated_at: '2025-08-01T15:20:25.260Z',
  client_name: 'EVIO',
  ip: '192.000.0.1',
  apt_owner_id: '688ce949e8a4a0e373ba0a22',
  create_user_id: '688ce949e8a4a0e373ba0a22',
}
