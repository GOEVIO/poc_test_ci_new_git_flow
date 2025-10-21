import { retrieveRabbitConfig } from "evio-library-configs";
import {
    DEFAULT_UPDATE_HISTORY_RETRY_ATTEMPTS,
    DEFAULT_UPDATE_HISTORY_SIMULTANEOUSLY_MESSAGES,
    DEFAULT_DEAD_LETTER_EXCHANGE,
    DEFAULT_DEAD_QUEUE_NAME,
    UpdateHistoryQueueName
} from "./constants";

interface IQueuesConfig {
    maxRetries: number;
    limitToProcess: number;
    deadLetterExchange: string;
    deadQueue: string;
}

export const getConfigs = async (): Promise<IQueuesConfig> => {
    const rabbitConfigs = await retrieveRabbitConfig(UpdateHistoryQueueName);
    return {
        deadLetterExchange: rabbitConfigs?.deadLetterExchange || DEFAULT_DEAD_LETTER_EXCHANGE,
        deadQueue: rabbitConfigs?.deadQueue || DEFAULT_DEAD_QUEUE_NAME,
        limitToProcess: rabbitConfigs?.readingSimultaneously || DEFAULT_UPDATE_HISTORY_SIMULTANEOUSLY_MESSAGES,
        maxRetries: rabbitConfigs?.retryAttempts || DEFAULT_UPDATE_HISTORY_RETRY_ATTEMPTS,
    }
} 