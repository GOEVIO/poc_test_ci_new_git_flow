import ChargingSession from '../../../models/chargingSession';

export function validateSession(chargerFound: { hwId: string }): Promise<boolean> {
    const context = 'Function validateSession';

    const query = {
        hwId: chargerFound.hwId,
        $or: [
            { status: process.env.SessionStatusToStart },
            { status: process.env.SessionStatusRunning },
            { status: process.env.SessionStatusToStop },
            { status: process.env.SessionStatusInPause },
        ],
    };

    return new Promise((resolve, reject) => {
        ChargingSession.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error`, err);
                reject(err);
            } else {
                resolve(result.length > 0);
            }
        });
    });
}
