import {
  ChargerPriceComponents,
  ChargerTariffsPlugDto,
} from '../../chargers/dtos/get-charger-tariffs.dto'
import {
  InternalChargerInterface,
  PublicChargerInterface,
  OcpiTariffDimenstionType,
  isNotEmptyObject,
} from 'evio-library-commons'

export const formatTariffs = (
  plug: InternalChargerInterface.Plug | PublicChargerInterface.Plug,
  isPublicNetwork: boolean
): { tariff?: ChargerTariffsPlugDto; tariffId?: string } | null => {
  if (isPublicNetwork) {
    const tariff: PublicChargerInterface.Tariff | undefined = (
      plug as PublicChargerInterface.Plug
    ).serviceCost?.tariffs?.find(
      (tariff: PublicChargerInterface.Tariff) =>
        tariff.type === 'AD_HOC_PAYMENT'
    )

    if (!tariff) return null

    return {
      tariff: formatPublic(tariff),
      tariffId: tariff?.id || '',
    }
  } else {
    const tariffs = (plug as InternalChargerInterface.Plug)
      .tariff as InternalChargerInterface.PlugTariff[]
    let internalTariff: InternalChargerInterface.PlugTariff | undefined =
      findInternalTariffs(tariffs, 'APT')

    if (!internalTariff) {
      internalTariff = findInternalTariffs(tariffs, 'Public')
      if (!internalTariff) return null
    }

    return {
      tariff: formatInternal(internalTariff),
      tariffId: internalTariff?.tariffId || '',
    }
  }
}

const formatPublic = (
  tariffs: PublicChargerInterface.Tariff
): ChargerTariffsPlugDto => {
  const emptyValues: ChargerTariffsPlugDto = {
    activation_fee: [],
    price_per_kwh: [],
    price_per_time: [],
  }

  if (!tariffs || !tariffs.elements || tariffs.elements.length === 0) {
    return emptyValues
  }

  const currency = tariffs?.currency || 'EUR'
  const formattedTariffs: ChargerTariffsPlugDto = tariffs.elements.reduce(
    (acc: any, tariff: PublicChargerInterface.Element) => {
      if (!tariff.price_components || tariff.price_components.length === 0) {
        return acc
      }

      const restrictions =
        tariff.restrictions || ({} as PublicChargerInterface.TariffRestrictions)

      const flatTariffs = tariff.price_components
        .filter((c: PublicChargerInterface.PriceComponent) => c.type === 'FLAT')
        .map((c: PublicChargerInterface.PriceComponent) => ({
          ...c,
          uom: 'UN',
          currency,
          type: 'FLAT' as OcpiTariffDimenstionType,
        })) as ChargerPriceComponents[]

      const energyTariffs = tariff.price_components
        .filter(
          (c: PublicChargerInterface.PriceComponent) => c.type === 'ENERGY'
        )
        .map((c: PublicChargerInterface.PriceComponent) => ({
          ...c,
          uom: 'kWh',
          currency,
          type: 'ENERGY' as OcpiTariffDimenstionType,
        })) as ChargerPriceComponents[]

      const timeTariffs = tariff.price_components
        .filter((c: PublicChargerInterface.PriceComponent) => c.type === 'TIME')
        .map((c: PublicChargerInterface.PriceComponent) => ({
          ...c,
          uom: 'min',
          currency,
          type: 'TIME' as OcpiTariffDimenstionType,
        })) as ChargerPriceComponents[]

      if (flatTariffs.length > 0) {
        if (!acc.activation_fee) {
          acc.activation_fee = []
        }
        acc.activation_fee.push({
          price_components: flatTariffs,
          restrictions,
        })
      }
      if (energyTariffs.length > 0) {
        if (!acc.price_per_kwh) {
          acc.price_per_kwh = []
        }
        acc.price_per_kwh.push({
          price_components: energyTariffs,
          restrictions,
        })
      }
      if (timeTariffs.length > 0) {
        if (!acc.price_per_time) {
          acc.price_per_time = []
        }
        acc.price_per_time.push({
          price_components: timeTariffs,
          restrictions,
        })
      }

      return acc
    },
    {} as ChargerTariffsPlugDto
  )

  return formattedTariffs
}

const formatInternal = (
  internalPlugTar: InternalChargerInterface.PlugTariff
): ChargerTariffsPlugDto => {
  const tariffs: any = {}

  const internalTariff = internalPlugTar.tariff

  // Activation Fee → FLAT
  if (internalTariff?.activationFee) {
    if (!tariffs.activation_fee) {
      tariffs.activation_fee = []
    }
    tariffs.activation_fee.push({
      price_components: [
        {
          type: 'FLAT',
          price: internalTariff.activationFee,
          vat: 0,
          step_size: 1,
          uom: 'UN',
          currency: 'EUR',
        },
      ],
      restrictions: {},
    })
  }

  // Charging Amount → TIME ou ENERGY
  if (internalTariff?.chargingAmount?.value) {
    const uom = internalTariff.chargingAmount.uom?.toLowerCase()
    const type = uom === 'kwh' ? 'ENERGY' : 'TIME'
    const target = uom === 'kwh' ? 'price_per_kwh' : 'price_per_time'

    if (!tariffs[target]) {
      tariffs[target] = []
    }

    tariffs[target].push({
      price_components: [
        {
          type,
          price: internalTariff.chargingAmount.value,
          vat: 0,
          step_size: 1,
          uom: internalTariff.chargingAmount.uom || '',
          currency: 'EUR',
        },
      ],
      restrictions: {},
    })
  }

  // Parking During Charging → TIME
  if (internalTariff?.parkingDuringChargingAmount?.value) {
    if (!tariffs.price_per_time) {
      tariffs.price_per_time = []
    }
    tariffs.price_per_time.push({
      price_components: [
        {
          type: 'TIME',
          price: internalTariff.parkingDuringChargingAmount.value,
          vat: 0,
          step_size: 1,
          uom: internalTariff.parkingDuringChargingAmount.uom || 'min',
          currency: 'EUR',
        },
      ],
      restrictions: {},
    })
  }

  // Parking → TIME
  if (internalTariff?.parkingAmount?.value) {
    if (!tariffs.price_per_time) {
      tariffs.price_per_time = []
    }
    tariffs.price_per_time.push({
      price_components: [
        {
          type: 'TIME',
          price: internalTariff.parkingAmount.value,
          vat: 0,
          step_size: 1,
          uom: internalTariff.parkingAmount.uom || 'min',
          currency: 'EUR',
        },
      ],
      restrictions: {},
    })
  }

  return tariffs
}

const findInternalTariffs = (
  tariffs: InternalChargerInterface.PlugTariff[],
  groupName: string
): InternalChargerInterface.PlugTariff | undefined => {
  const tariff = tariffs.find((tar) => tar.groupName === groupName)
  return isNotEmptyObject(tariff?.tariff) ? tariff : undefined
}
