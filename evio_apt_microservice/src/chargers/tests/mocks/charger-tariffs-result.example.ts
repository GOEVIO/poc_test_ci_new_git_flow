import { OcpiTariffDimenstionType } from 'evio-library-commons'
import { GetChargerTariffsDto } from '../../dtos'

export const MockChargerTariffsResult: GetChargerTariffsDto = {
  totalChargers: 1,
  chargers: [
    {
      chargerItem: {
        _id: '1234567890',
        accessibility: 'Public',
        chargerId: 'HW123',
        chargerName: 'Charger 1',
        state: 'Active',
        operationalStatus: 'Operational',
        status: 'Available',
        chargerType: 'Type 2',
        voltageLevel: 'BTN',
      },
      plugs: [
        {
          status: 'Available',
          plugId: 'P1',
          plugNumber: 1,
          connectorStatus: 'AVAILABLE',
          amperage: 32,
          voltage: 400,
          power: 22,
          connectorPowerType: 'AC',
          connectorType: 'Type 2',
          preauthorisation: 40,
          tariffs: {
            activation_fee: [
              {
                price_components: [
                  {
                    type: OcpiTariffDimenstionType.Flat,
                    price: 5.0,
                    step_size: 1,
                    vat: 23,
                    currency: 'EUR',
                    uom: 'UN',
                  },
                ],
                restrictions: {
                  day_of_week: ['MONDAY', 'TUESDAY'],
                  start_time: '08:00',
                  end_time: '20:00',
                },
              },
            ],
            price_per_kwh: [
              {
                price_components: [
                  {
                    _id: '68307e9603e77e001334c00f',
                    type: OcpiTariffDimenstionType.Energy,
                    price: 0.53,
                    vat: 23,
                    step_size: 1,
                    currency: 'EUR',
                    uom: 'kWh',
                  },
                ],
                restrictions: {
                  day_of_week: [],
                  min_duration: 0,
                  max_duration: 3600,
                },
              },
              {
                price_components: [
                  {
                    _id: '68307e9603e77e001334c011',
                    type: OcpiTariffDimenstionType.Energy,
                    price: 0.53,
                    vat: 23,
                    step_size: 1,
                    currency: 'EUR',
                    uom: 'kWh',
                  },
                ],
                restrictions: {
                  day_of_week: [],
                  min_duration: 3700,
                },
              },
            ],
            price_per_time: [
              {
                price_components: [
                  {
                    type: OcpiTariffDimenstionType.Time,
                    price: 5.0,
                    step_size: 1,
                    vat: 23,
                    currency: 'EUR',
                    uom: 'min',
                  },
                ],
                restrictions: {},
              },
            ],
          },
        },
      ],
    },
  ],
}
