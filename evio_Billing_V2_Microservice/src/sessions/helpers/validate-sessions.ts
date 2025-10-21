import { ISession } from '../interfaces/session-group.interface';

/**
 * Validates that all sessions are from the same calendar day.
 * @param sessions - Array of filtered sessions.
 * @returns Object containing isValid flag and optional reason.
 */
export function validateSessions(sessions: ISession[]) {
  if (!sessions.length) {
    return { isValid: false, reason: 'No sessions provided' };
  }

  const firstDate = new Date(sessions[0].start).toDateString();
  const allSameDay = sessions.every(
    (s) => new Date(s.start).toDateString() === firstDate
  );

  return {
    isValid: allSameDay,
    reason: allSameDay ? null : 'Sessions span multiple days',
  };
}