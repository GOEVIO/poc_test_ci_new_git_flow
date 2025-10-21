import { sendMessage } from 'evio-event-producer';
import { Constants } from '../utils/constants';

export async function publish(data) {
  return await sendMessage(data, Constants.eventProducer.reportRoutingKey);
}
