const amqp = require('amqplib');
const handlers = require('./messageHandlers');
require('dotenv').config();

const QUEUE_NAME = process.env.QUEUE_NAME;
const MAX_RETRIES = process.env.MAX_RETRIES || 3;
async function startConsumer() {
  try {
    const connection = await amqp.connect(`amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:5672`);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'dlq_' + QUEUE_NAME,
        'x-message-ttl': 60000,
      }
    });

    await channel.assertQueue('dlq_' + QUEUE_NAME, { durable: true });

    console.log(`Waiting for messages in "${QUEUE_NAME}"`);

    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      const content = JSON.parse(msg.content.toString());
      const { method, payload } = content;

      try {
        if (!method || !handlers[method]) {
          throw new Error(`Unsupported method "${method}"`);
        }

        await handlers[method](payload || {});
        channel.ack(msg);
      } catch (err) {
        console.error('Error handling message:', err);

        const retries = msg.properties.headers?.['x-retries'] || 0;

        if (retries < MAX_RETRIES) {
          channel.sendToQueue(QUEUE_NAME, msg.content, {
            headers: { 'x-retries': retries + 1 },
            persistent: true,
          });
          console.log(`Retrying (${retries + 1}/${MAX_RETRIES})`);
        } else {
          channel.sendToQueue('dlq_' + QUEUE_NAME, msg.content, {
            headers: { 'x-retries': retries },
            persistent: true,
          });
          console.log(`Moved to DLQ after ${MAX_RETRIES} attempts`);
        }

        channel.nack(msg, false, false);
      }
    });

  } catch (err) {
    console.error('Failed to start consumer:', err);
  }
}

module.exports = { startConsumer };
