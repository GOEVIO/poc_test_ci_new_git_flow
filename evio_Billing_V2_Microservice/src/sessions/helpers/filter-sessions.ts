import { ISession } from '../interfaces/session-group.interface';
import { Session } from '../interfaces/session.interface';

/**
 * Filters out invalid sessions (missing start/end, zero energy and cost.).
 * @param sessions - Array of sessions.
 * @returns Filtered array of valid sessions.
 */
export function filterSessions(sessions: ISession[]): ISession[] {
  return sessions.filter((s) => {
    return s.start && s.end && s.energy > 0 && s.cost >= 0;
  });
}

 /**
     * Returns the latest session date from a group.
     */
    export function getLatestSessionDate(group: Session[]): string | undefined {
        let latestDate: string | undefined = undefined;
        for (const session of group) {
            const dateStr = session.end_date_time || session.stopDate;
            if (dateStr) {
                if (!latestDate || new Date(dateStr) > new Date(latestDate)) {
                    latestDate = dateStr;
                }
            }
        }
        return latestDate ? new Date(latestDate).toISOString().split('T')[0] : undefined;
    }