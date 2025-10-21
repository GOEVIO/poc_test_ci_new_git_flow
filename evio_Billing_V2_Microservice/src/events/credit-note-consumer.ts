import { MessageHandlerService } from './messageHandlers/messageHandler.service';
import { startConsumer } from './consumer-factory';
require('dotenv').config();

export async function startCreditNoteConsumer(app) {
  await startConsumer(
    app,
    process.env.CREDIT_NOTE_QUEUE_NAME || 'credit_note_queue',
    MessageHandlerService,
    3
  );
}
