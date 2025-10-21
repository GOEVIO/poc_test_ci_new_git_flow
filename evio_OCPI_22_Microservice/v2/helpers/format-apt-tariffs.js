const getActivationPrices = (elements) => {
  return elements
    .flatMap(el => el.price_components.filter(c => c.type === "FLAT"))
    .reduce((sum, c) => sum + c.price, 0).toFixed(2);
};

const formatCemeTariffTariffs = (elements, charger, isMobiE, flatValue) => {

  if(!isMobiE){
    return [
      {
        type: "flat",
        uom: "un",
        price: flatValue
      },
      {
        type: "time",
        uom: "min",
        price: 0
      },
      {
        type: "energy",
        uom: "kWh",
        price: 0
      },
      {
        type: "percentage",
        uom: "un",
        price: 0.15
      }
    ];
  }

  const result = elements.flatMap(el => {
    const energyComponents = el.price_components.filter(c => c.type === "ENERGY");
    if (energyComponents.length === 0) return [];

    return energyComponents.map(pc => {
      const restriction = el.restrictions;

      const isServerOutEmpty = restriction?.start_time === "08:00" && restriction?.end_time === "22:00";

      return {
        power: "all",
        uom: "€/kWh",
        tariffType: isServerOutEmpty ? "server_out_empty" : "server_empty",
        voltageLevel: charger.voltageLevel,
        price: pc.price
      };
    });
  });

  return result;
};

const formatOPCTariff = (tariff, charger) => {
  return {
    country_code: charger.address?.countryCode || 'PT',
    currency: "EUR",
    elements: tariff.elements.map(el => ({
      price_components: el.price_components.map(pc => ({
        vat: pc.vat,
        type: pc.type,
        price: pc.price,
        step_size: pc.step_size
      })),
      restrictions: el.restrictions || null
    })),
    id: tariff?.id,
    party_id: charger?.partyId,
    type: "AD_HOC_PAYMENTS",
    last_updated: new Date().toISOString()
  };
};

const formatCEMETariff = (tariff, charger, isMobiE) => {
  const flatValue = getActivationPrices(tariff.elements) || null;
  return {
    activationFee: {
      currency: "EUR",
      value: flatValue
    },
    activationFeeAdHoc: {
      currency: "EUR",
      value: flatValue
    },
    tariff: formatCemeTariffTariffs(tariff.elements, charger, isMobiE, flatValue),
    tariffsHistory: [],
    CEME: "EVIO",      
    country: charger.address?.countryCode || 'PT',
    cycleType: "server_daily",
    planName: "server_plan_EVIO_ad_hoc",
    tariffType: "server_bi_hour",
    id: tariff.id,
    last_updated: new Date().toISOString(),
  };
};

const formatAptTariffs = (aptTariffsData, charger, isMobiE = true) => {
  let cemeTariff = aptTariffsData.find(tariff => tariff.tariff_owner === 'CEME') || null;
  let cpoTariff = aptTariffsData.find(tariff => tariff.tariff_owner === 'CPO') || null;

  return {
    cemeTariff: cemeTariff?.id ? formatCEMETariff(cemeTariff, charger, isMobiE) : null,
    cpoTariff: cpoTariff?.id ? formatOPCTariff(cpoTariff, charger) : null
  };
};

module.exports = {
  formatAptTariffs
};