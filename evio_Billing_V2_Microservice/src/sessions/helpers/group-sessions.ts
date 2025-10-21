import { ISession } from '../interfaces/session-group.interface';

/**
 * Groups sessions by userId.
 * @param sessions - Flat list of sessions.
 * @returns Array of session arrays, each grouped by userId.
 */
export function groupSessions(sessions: ISession[]): ISession[][] {
  const map = new Map<string, ISession[]>();

  for (const session of sessions) {
    if (!map.has(session.userId)) {
      map.set(session.userId, []);
    }
    map.get(session.userId)!.push(session);
  }

  return Array.from(map.values());
}