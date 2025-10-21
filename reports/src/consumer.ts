import mqConnection from 'evio-rabbitmq-connection/dist/src/rabbitmq-connection';
import { getConfigs } from './config';
import { REPORT_QUEUE_NAME, TEAMS_WEBHOOK_URL } from './constants';
import handleIncomingMessage from './services/message.service';

export async function startConsumer() {
  (async () => {
    const configs = await getConfigs();
    mqConnection.consume({
      queue: REPORT_QUEUE_NAME,
      handleIncomingMessage,
      teamsWebhookUrl: TEAMS_WEBHOOK_URL,
      ...configs,
    });
    console.info(`start consumer with:`);
    console.table(configs);
  })();
}
