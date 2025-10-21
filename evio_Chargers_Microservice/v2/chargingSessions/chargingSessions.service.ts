import ChargingSession from '../../models/chargingSession';
import Charger from '../../models/charger';
import Infrastructure from '../../models/infrastructure';
import { ChargingSessionsHelper } from './chargingSessions.helper';

export class ChargingSessionService {
    static async getActiveSessions(userId: string) {
        const sessions = await ChargingSession.find({
            chargerOwner: userId,
            status: { $in: [process.env.SessionStatusRunning, process.env.SessionStatusInPause] }
        }).lean();

        if (sessions.length === 0) return [];

        const [chargers, infrastructures] = await Promise.all([
            Charger.find({ createUser: userId, active: true, hasInfrastructure: true }).lean(),
            Infrastructure.find({ createUserId: userId }).lean()
        ]);

        return ChargingSessionsHelper.formatSessions(sessions, chargers, infrastructures);
    }
}
