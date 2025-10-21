export const PDF_CONFIG = {
  fonts: {
    regular: 'assets/fonts/Nunito.ttf',
    bold: 'assets/fonts/NunitoBold.ttf',
    awesomeSolid: 'assets/fonts/fa-solid-900.ttf',
    awesomeLight: 'assets/fonts/fa-light-300.ttf',
  },
  page: {
    margin: 50,
    marginSmall: 10,
    session: {
      width: 970,
      margin: 20,
    },
  },
  colors: {
    primary: '#353841',
    secondary: '#f1f5fe',
    rowAlt: '#ffffff',
    rowFill: '#f1f5fe',
    white: '#FFFFFF',
    line: '#8e96ae',
    header: '#71778a',
    greenDark: '#00FFCC',
    greenLight: '#E7FFF6',
    greenMedium: '#CBFFEC',
  },
  table: {
    rowHeight: 30,
  },
};

export const APT_SESSION_COLUMNS = [
  'DATE',
  'DURATION',
  'CHARGING_STATION',
  'ENERGY',
  'NETWORK',
  'TOTAL_EXCL_VAT',
];

export const KEY_TO_COLUMN_MAP: Record<any, any> = {
  startDate: 'DATE',
  timeCharged: 'DURATION',
  hwId: 'CHARGING_STATION',
  totalPower: 'ENERGY',
  network: 'NETWORK',
  totalPriceExclVat: 'TOTAL_EXCL_VAT',
};
