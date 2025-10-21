import {
  RabbitmqQueueNames,
  DBNames,
  CollectionNames,
} from 'evio-library-commons';

export const UpdateHistoryQueueName =
  RabbitmqQueueNames.updateHistoryV2 ?? 'session_history_v2';

export const StatisticsDB = DBNames.Statistics;

export const HistoriesCollection = CollectionNames.Statistics?.Histories;

export const teamsWebhookUrl =
  'https://goeviocom.webhook.office.com/webhookb2/45886307-9d1b-4d9f-baf8-27e6d10277ac@f676247a-5860-4d95-864a-f36d4e2fb07c/IncomingWebhook/f3bd334e556b4fde9e27e092b8a01d51/4b281e34-c80c-45d8-b6a8-2ead11e27ecb';

export const existsId = (id?: any) =>
  id && id !== '-1' && String(id).toUpperCase() !== 'UNKNOWN';

export const DEFAULT_UPDATE_HISTORY_RETRY_ATTEMPTS = 3;
export const DEFAULT_UPDATE_HISTORY_SIMULTANEOUSLY_MESSAGES = 1;
export const DEFAULT_DEAD_LETTER_EXCHANGE = 'dlx_history';
export const DEFAULT_DEAD_QUEUE_NAME = 'history_error_queue';
export const INITIAL_DELAY_BEFORE_PROCESSING_MS = 500;

export const DEFAULT_EFFICIENCY = null;
export const DEFAULT_OVERCOST = null;
export const DEFAULT_CONVERSION_EFFICIENCY = 1;
export const HOST_OCPI = 'http://ocpi-22:3019';
export const PATH_PRICE_SIMULATION = '/api/private/tariffs/opcTariffsPrices';
export const EVIO_NETWORK = 'EVIO';
export const TAX_EXEMPTION_REASON_CODE_M40 = 'M40';

export const SENTRY_DNS =
  'https://a00f4adab0f806f9f303eb82699baa99@o4505861147131904.ingest.us.sentry.io/4509413053562880';

export const DEFAULT_USABLE_BATTERY_CAPACITY = 62.0; // this is an id3
export const DEFAULT_INTERNAL_CHARGER_POWER = 11.0; // this is an id3

export const MINIMUM_CHARGE_DURATION = 60;
export const SESSIONS_STATUS_COMPLETED = ['40', '70', 'COMPLETED'];
export const SESSIONS_STATUS_EXPIRED = ['60', 'EXPIRED'];

export const APT_HOST = 'http://apt:6001/api/private';
