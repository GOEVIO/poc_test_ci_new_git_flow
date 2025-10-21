import { ISessionEmail } from "./session-email.interface"

export interface INotificationStrategy {
  sendStartSessionEmail(payload: ISessionEmail): Promise<void>
  sendStopSessionEmail(payload: ISessionEmail): Promise<void>
}
