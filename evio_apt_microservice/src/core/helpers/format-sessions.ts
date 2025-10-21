import { SessionStatusesNumberTypes } from 'evio-library-commons'
import {
  GetSessionClientResponseFoundDto,
  GetSessionClientResponseNotFoundDto,
} from '../../clients/get-sessions/get-sessions.dto'

export const formatSessions = (
  data: (
    | GetSessionClientResponseNotFoundDto
    | GetSessionClientResponseFoundDto
  )[]
): GetSessionClientResponseFoundDto | GetSessionClientResponseNotFoundDto => {
  const haveSession = data.some(
    (i) =>
      'chargingSession' in i &&
      Array.isArray((i as GetSessionClientResponseFoundDto).chargingSession) &&
      (i as GetSessionClientResponseFoundDto).chargingSession.length > 0
  )
  if (haveSession) {
    return {
      chargingSession: data
        .filter((i) => 'chargingSession' in i)
        .filter(
          (i) =>
            (i as GetSessionClientResponseFoundDto).chargingSession.length >
              0 &&
            i.chargingSession[0].status === SessionStatusesNumberTypes.ACTIVE
        )
        .map((i) => (i as GetSessionClientResponseFoundDto).chargingSession)
        .flat(),
    }
  }
  return {
    auth: false,
    code: 'session_not_found',
    message: 'Session not found',
  }
}
