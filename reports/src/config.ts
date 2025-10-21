import {
  DEFAULT_UPDATE_HISTORY_RETRY_ATTEMPTS,
  DEFAULT_UPDATE_HISTORY_SIMULTANEOUSLY_MESSAGES,
  DEFAULT_DEAD_LETTER_EXCHANGE,
  DEFAULT_DEAD_QUEUE_NAME,
} from './constants';
import IQueuesConfig from './interfaces/queues-config.interface';

export const getConfigs = async (): Promise<IQueuesConfig> => {
  return {
    deadLetterExchange: DEFAULT_DEAD_LETTER_EXCHANGE,
    deadQueue: DEFAULT_DEAD_QUEUE_NAME,
    limitToProcess: DEFAULT_UPDATE_HISTORY_SIMULTANEOUSLY_MESSAGES,
    maxRetries: DEFAULT_UPDATE_HISTORY_RETRY_ATTEMPTS,
  };
};
