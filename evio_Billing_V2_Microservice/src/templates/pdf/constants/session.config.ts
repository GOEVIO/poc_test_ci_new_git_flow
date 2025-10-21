export const NETWORK_SESSION_COLUMNS: Record<string, string[]> = {
  MOBIE: [
    'DATE',
    'START',
    'DURATION',
    'STATION',
    'LICENSE_PLATE',
    'ENERGY_OFF_PEAK_KWH',
    'ENERGY_NON_OFF_PEAK_KWH',
    'ACTIVATION_FEE_EUR',
    'ENERGY_COST_EUR',
    'TAR_EUR',
    'OPC_TIME_EUR',
    'OPC_ENERGY_EUR',
    'OPC_ACTIVATION_EUR',
    'IEC_EUR',
    'TOTAL_EXCL_VAT_EUR',
    'VAT_PERCENT',
    'TOTAL_INCL_VAT_EUR',
  ],
  default: [
    'DATE',
    'START',
    'DURATION',
    'CITY',
    'STATION',
    'LICENSE_PLATE',
    'ENERGY_CONSUMED_KWH',
    'CHARGING_DURATION_MIN',
    'POST_CHARGING_DURATION_MIN',
    'RATE_PER_KWH_EUR',
    'RATE_PER_MIN_EUR',
    'ACTIVATION_FEE_EUR',
    'CHARGING_USAGE_RATE_EUR_PER_MIN',
    'POST_CHARGING_USAGE_RATE_EUR_PER_MIN',
    'TOTAL_EXCL_VAT_EUR',
    'VAT_PERCENT',
    'TOTAL_INCL_VAT_EUR',
  ],
};

export const CHARGING_STATION_COLUMNS: string[] = [
  'STATION',
  'CITY',
  'TENSION',
];

export function getSessionColumns(network: string): string[] {
  return NETWORK_SESSION_COLUMNS[network] || NETWORK_SESSION_COLUMNS.default;
}
