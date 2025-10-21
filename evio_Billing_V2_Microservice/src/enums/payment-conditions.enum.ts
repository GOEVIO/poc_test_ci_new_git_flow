export enum PaymentConditionsId {
  Days_7_PT = 1,
  Days_15_PT = 2,
  Prompt_Payment_PT = 3,
  Days_30_PT = 4,
  Days_60_PT = 5,

  Days_7_EN = 6,
  Days_15_EN = 7,
  Prompt_Payment_EN = 8,
  Days_30_EN = 9,
  Days_60_EN = 10,

  Days_7_ES = 11,
  Days_15_ES = 12,
  Prompt_Payment_ES = 13,
  Days_30_ES = 14,
  Days_60_ES = 15,

  Days_7_FR = 16,
  Days_15_FR = 17,
  Prompt_Payment_FR = 18,
  Days_30_FR = 19,
  Days_60_FR = 20,
}

export const PaymentConditionStringToEnumByLang: Record<string, Record<string, PaymentConditionsId>> = {
  PT: {
    '7_Days': PaymentConditionsId.Days_7_PT,
    '15_Days': PaymentConditionsId.Days_15_PT,
    'Prompt_Payment': PaymentConditionsId.Prompt_Payment_PT,
    '30_Days': PaymentConditionsId.Days_30_PT,
    '60_Days': PaymentConditionsId.Days_60_PT,
  },
  EN: {
    '7_Days': PaymentConditionsId.Days_7_EN,
    '15_Days': PaymentConditionsId.Days_15_EN,
    'Prompt_Payment': PaymentConditionsId.Prompt_Payment_EN,
    '30_Days': PaymentConditionsId.Days_30_EN,
    '60_Days': PaymentConditionsId.Days_60_EN,
  },
  ES: {
    '7_Days': PaymentConditionsId.Days_7_ES,
    '15_Days': PaymentConditionsId.Days_15_ES,
    'Prompt_Payment': PaymentConditionsId.Prompt_Payment_ES,
    '30_Days': PaymentConditionsId.Days_30_ES,
    '60_Days': PaymentConditionsId.Days_60_ES,
  },
  FR: {
    '7_Days': PaymentConditionsId.Days_7_FR,
    '15_Days': PaymentConditionsId.Days_15_FR,
    'Prompt_Payment': PaymentConditionsId.Prompt_Payment_FR,
    '30_Days': PaymentConditionsId.Days_30_FR,
    '60_Days': PaymentConditionsId.Days_60_FR,
  },
};

