import * as Sentry from '@sentry/node';
import Constants, { logger } from '../utils/constants';

type MetricUnit = 'ms' | 's' | 'B' | 'KB' | 'MB' | 'GB' | 'TB' | 'c' | 'percent';

export const registerMetric = (metricName: string, value: number, unit?: MetricUnit): void => {
    const context = 'Function registerMetric';
    try {
        Sentry.metrics.distribution(metricName, value, {
            unit,
            tags: { environment: Constants.environment }
        });
    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);
    }
};

export default {
    registerMetric
};
