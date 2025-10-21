import { captureException } from "@sentry/node";
import { saveSessionFlowLogs } from 'evio-library-ocpi';
import { SessionFlowLogsStatus, SessionFlowLogsErrorTypes } from 'evio-library-commons';

interface SaveSessionLogsInfo {
    userId: string;
    hwId: string;
    plugId: string;
    stage: string;
    action: string;
    status: SessionFlowLogsStatus;
    errorType?: SessionFlowLogsErrorTypes;
    errorMessage?: string;
    payload?: any;
    sessionId?: string;
    externalSessionId?: string;
};

export const saveSessionLogs = (logsInfo: SaveSessionLogsInfo) => {
    const context = 'Function [saveSessionLogs]:';
    try {
        const dataToSave = { ...logsInfo, service: 'chargers' };

        if (dataToSave.status === SessionFlowLogsStatus.SUCCESS) {
            delete dataToSave.errorType;
            delete dataToSave.errorMessage;
            delete dataToSave.payload;
        } else if (dataToSave.payload) {
            dataToSave.payload = JSON.stringify(logsInfo.payload);
        }

        saveSessionFlowLogs(dataToSave);
    } catch (error) {
        console.error(`${context} Error saving session logs: ${error.message}`);
        captureException(error);
    }
};