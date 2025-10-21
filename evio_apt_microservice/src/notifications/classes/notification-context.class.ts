import { INotificationStrategy } from '../interfaces/notification-strategy.interface'
import { ISessionEmail } from '../interfaces/session-email.interface'

export default class NotificationContext {
  private strategy: INotificationStrategy

  public setStrategy(strategy: INotificationStrategy): void {
    this.strategy = strategy
  }

  public async sendStartSessionEmail(data: ISessionEmail): Promise<any> {
    return this.strategy.sendStartSessionEmail(data)
  }

  public async sendStopSessionEmail(data: ISessionEmail): Promise<any> {
    return this.strategy.sendStopSessionEmail(data)
  }
}
