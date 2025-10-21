import {
  GetSessionClientResponseNotFoundDto,
  GetSessionClientResponseFoundDto,
} from './get-sessions.dto'

export abstract class GetSessionClientInterface {
  abstract getSession(
    sessionId: string
  ): Promise<
    GetSessionClientResponseNotFoundDto | GetSessionClientResponseFoundDto
  >
}
