
/**
 * Adds a duration in seconds to a given start date.
 * 
 * @param startDate The date to which the duration should be added.
 * @param durationInSeconds The duration in seconds to be added.
 * @returns A new Date object with the added duration.
 */
export function addDuration(startDate: Date, durationInSeconds: number): Date {
  return new Date(startDate.getTime() + durationInSeconds * 1000);
}

