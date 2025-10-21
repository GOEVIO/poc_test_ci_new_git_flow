export const milisecondsToHours = (ms: number) => ms / 3600000

export const milisecondsToMinutes = (ms: number) => ms / 60000

export const milisecondsToSeconds = (ms: number) => ms / 1000

export const durationInMiliseconds = (start: string, stop: string): number =>
  new Date(stop).getTime() - new Date(start).getTime()
