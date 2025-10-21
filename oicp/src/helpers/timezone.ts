import * as geoTimeZone from 'geo-tz'

export const getTimezone = (latitude: number, longitude: number) => {
  return geoTimeZone.find(latitude, longitude)[0]
}
