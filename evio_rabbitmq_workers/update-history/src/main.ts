import mqConnection from 'evio-rabbitmq-connection/dist/src/rabbitmq-connection';
import {
  INITIAL_DELAY_BEFORE_PROCESSING_MS,
  UpdateHistoryQueueName,
  teamsWebhookUrl,
  SENTRY_DNS,
} from './constants';

import { getChargingSession } from './repository';
import { buildHistoryUpdate } from './service';
import { findOneHistoryById, upsertOneHistoryById } from './model';
import { getConfigs } from './configs';
import { sessionIsNotCompleted } from './helpers/session-is-not-completed';
import { processingSessionManager } from './helpers/processing-session-manager';
import { sleep } from './helpers/sleep';
import * as Sentry from '@sentry/node';
import * as appData from '../package.json';

Sentry.init({
  dsn: SENTRY_DNS || '',
  tracesSampleRate: Number(process.env.SENTRY_TRACE_SAMPLE_RATE) || 0.01,
  profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.01,
  environment: process.env.NODE_ENV,
  release: `${appData.name}@${appData.version}`,
  integrations: [Sentry.nodeContextIntegration()],
});

const handleIncomingMessage = async (message: {
  sessionId: string;
  origin: 'ocpi22' | 'ocpp';
  from?: string;
}) => {
  const context = 'Update History Worker';
  try {
    const { sessionId, origin, from = '' } = message;

    // Wait a short period before processing to reduce the risk of race conditions.
    // Sometimes multiple identical messages are received at the same time.
    // This delay gives time for the database to be updated by the first one
    // before the next message tries to read or overwrite it.
    await sleep(INITIAL_DELAY_BEFORE_PROCESSING_MS);

    await processingSessionManager.addMessageInProcess(sessionId);
    console.log(`[${context}] Processing session from ${from} - `, sessionId);
    // Get session and history
    const [session, history] = await Promise.all([
      getChargingSession(origin, sessionId),
      findOneHistoryById(sessionId),
    ]);

    if (sessionIsNotCompleted(session, origin)) {
      console.log(
        `[${context}] Session from ${from}: ${sessionId} not completed`,
      );
      processingSessionManager.removeMessageInProcess(sessionId);
      return true;
    }

    // Build updated history based on session and history differences
    const updatedHistory = await buildHistoryUpdate(session, history, origin);

    // Save to db updated history
    // TODO _Id objectId and history schema
    await upsertOneHistoryById(sessionId, updatedHistory, !history?._id);

    console.log(`[${context}] Successfully processed session: `, sessionId);
    processingSessionManager.removeMessageInProcess(sessionId);
    return true;
  } catch (error: any) {
    processingSessionManager.removeMessageInProcessDuringCatch(
      message.sessionId,
      error?.message || '',
    );
    console.error(
      `[${context}] Error, message: ${JSON.stringify(message)} `,
      error,
    );
    throw error;
  }
};

(async () => {
  const configs = await getConfigs();
  mqConnection.consume({
    queue: UpdateHistoryQueueName,
    handleIncomingMessage,
    teamsWebhookUrl,
    ...configs,
  });
  console.info(`start consumer with:`);
  console.table(configs);
})();
