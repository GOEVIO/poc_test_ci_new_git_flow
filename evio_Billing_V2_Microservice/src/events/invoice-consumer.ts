import { startConsumer } from './consumer-factory';
import { MessageHandlerService } from './messageHandlers/messageHandler.service';

export async function startInvoiceConsumer(app) {
  await startConsumer(
    app,
    process.env.QUEUE_NAME || 'billingV2_queue',
    MessageHandlerService,
    3
  );
}
