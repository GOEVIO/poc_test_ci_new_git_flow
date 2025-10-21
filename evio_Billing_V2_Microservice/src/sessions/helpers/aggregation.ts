import { ISession } from '../interfaces/session-group.interface';

/**
 * Calculates the total energy of a session group.
 */
export function calculateTotalEnergy(sessions: ISession[]): number {
  return sessions.reduce((sum, s) => sum + s.energy, 0);
}

/**
 * Calculates the total cost of a session group.
 */
export function calculateTotalCost(sessions: ISession[]): number {
  return sessions.reduce((sum, s) => sum + s.cost, 0);
}

/**
 * Calculates the total duration in minutes of a session group.
 */
export function calculateTotalDuration(sessions: ISession[]): number {
  return sessions.reduce((sum, s) => {
    const start = new Date(s.start).getTime();
    const end = new Date(s.end).getTime();
    return sum + (end - start) / 1000 / 60; 
  }, 0);
}