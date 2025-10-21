import { Channel, ConsumeMessage, Options } from 'amqplib';

export function handleError(
  channel: Channel,
  msg: ConsumeMessage,
  retries: number,
  maxRetries: number,
  queueName: string
): void {
  const options: Options.Publish = {
    headers: { 'x-retries': retries + 1 },
    persistent: true,
  };

  if (retries < maxRetries) {
    channel.sendToQueue(queueName, msg.content, options);
    console.log(`Retrying (${retries + 1}/${maxRetries})`);
  } else {
    channel.sendToQueue('dlq_' + queueName, msg.content, {
      headers: { 'x-retries': retries },
      persistent: true,
    });
    console.log(`Moved to DLQ after ${maxRetries} attempts`);
  }

  channel.nack(msg, false, false);
}

export async function processMessage(
  handlerService: any,
  method: string,
  payload: any
): Promise<any> {
  if (!method || typeof handlerService[method] !== 'function') {
    throw new Error(`Unsupported method "${method}"`);
  }
  return handlerService[method](payload || {});
}