export const REPORT_QUEUE_NAME = 'report_consumer_queue';

export const DEFAULT_UPDATE_HISTORY_RETRY_ATTEMPTS = 3;
export const DEFAULT_UPDATE_HISTORY_SIMULTANEOUSLY_MESSAGES = 1;
export const DEFAULT_DEAD_LETTER_EXCHANGE = 'dlx_report';
export const DEFAULT_DEAD_QUEUE_NAME = 'report_error_queue';
export const INITIAL_DELAY_BEFORE_PROCESSING_MS = 500;

export const TEAMS_WEBHOOK_URL =
  'https://goeviocom.webhook.office.com/webhookb2/45886307-9d1b-4d9f-baf8-27e6d10277ac@f676247a-5860-4d95-864a-f36d4e2fb07c/IncomingWebhook/f3bd334e556b4fde9e27e092b8a01d51/4b281e34-c80c-45d8-b6a8-2ead11e27ecb';

export const EVIO_EMAIL_HOST = process.env.EVIO_EMAIL_HOST;
export const EVIO_EMAIL_PORT = process.env.EVIO_EMAIL_PORT;
export const EVIO_EMAIL_USER = process.env.EVIO_EMAIL_USER;
export const EVIO_EMAIL_PASS = process.env.EVIO_EMAIL_PASS;
export const EVIO_EMAIL_FROM = process.env.EVIO_EMAIL_FROM || 'EVIO Support';

export const STATISTICS_DB = 'statisticsDB';
export const HISTORIES_COLLECTION = 'historiesv2';
