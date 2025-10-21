import { RabbitmqQueueNames } from 'evio-library-commons'
import mqConnection from 'evio-rabbitmq-connection/dist/src/rabbitmq-connection'
import Sentry from '@sentry/node'

export const sendSessionToHistoryQueue = async (
  sessionId: string,
  from: string = '',
) => {
  const context = 'sendSessionToHistoryQueue oicp'
  try {
    if (!sessionId) return
    const message = {
      sessionId,
      origin: 'ocpi22',
      from: `service oicp - ${from}`,
    }
    console.log(
      `Sending session to queue ${RabbitmqQueueNames.updateHistoryV2}`,
      message,
    )
    mqConnection.sendToQueue(RabbitmqQueueNames.updateHistoryV2, message)
  } catch (error) {
    console.error(`${context}`, error)
    Sentry.captureException(`${context} Error ${error}`)
  }
}
