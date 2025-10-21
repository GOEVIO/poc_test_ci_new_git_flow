import { getLastReadingPoint } from '../../utils/getLastReadingPoint';

export class ChargingSessionsHelper {
    static formatSessions(sessions: any[], chargers: any[], infrastructures: any[]) {
        return sessions.map(session => {
            const charger = chargers.find(c => c.hwId === session.hwId);
            const plug = charger?.plugs?.find((p: any) => p.plugId === session.plugId);
            const infrastructure = infrastructures.find(i => i._id.toString() === charger?.infrastructure?.toString());

            return {
                userName: session?.userName || session?.userIdInfo?.name || '',
                reservedAmount: session?.reservedAmount ?? 0,
                sessionId: session?.sessionId,
                sessionPrice: session?.sessionPrice ?? null,
                sessionSync: session?.sessionSync ?? false,
                startDate: session?.startDate,
                timeZone: session?.timeZone,
                status: session?.status,
                timeCharged: session?.timeCharged ?? 0,
                location: {
                    clientName: infrastructure?.clientName || '',
                    address: infrastructure?.address || {},
                    _id: infrastructure?._id || null,
                    CPE: infrastructure?.CPE || '',
                    imageContent: infrastructure?.imageContent || '',
                    name: infrastructure?.name || '',
                    additionalInformation: infrastructure?.additionalInformation || ''
                },
                charger: {
                    _id: charger?._id || null,
                    name: charger?.name || '',
                    hwId: charger?.hwId || '',
                    address: charger?.address || {},
                    endpoint: charger?.endpoint || '',
                    facilitiesTypes: charger?.facilitiesTypes || [],
                    accessType: charger?.accessType || '',
                    active: charger?.active ?? false,
                    rating: charger?.rating ?? 0,
                    numberOfSessions: charger?.numberOfSessions ?? 0,
                    status: charger?.status || '',
                    stationIdentifier: charger?.stationIdentifier || '',
                    CPE: charger?.CPE || ''
                },
                plug: plug
                    ? {
                        _id: plug._id || null,
                        plugId: plug.plugId || '',
                        connectorType: plug.connectorType || '',
                        qrCodeId: plug.qrCodeId || '',
                        status: plug.status || '',
                        subStatus: plug.subStatus || '',
                        voltage: plug.voltage ?? null,
                        amperage: plug.amperage ?? null,
                        power: plug.power ?? null,
                        createdAt: plug.createdAt || null,
                        updatedAt: plug.updatedAt || null,
                        hasRemoteCapabilities: plug.hasRemoteCapabilities ?? false,
                        active: plug.active ?? false
                    }
                    : null,
                tariff: session?.tariff || null,
                lastReadingPoint: getLastReadingPoint(session?.readingPoints),
                totalPrice: session?.totalPrice || null,
                estimatedPrice: session?.estimatedPrice ?? 0
            };
        });
    }
}
