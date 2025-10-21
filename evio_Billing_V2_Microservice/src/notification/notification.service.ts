import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class NotificationService {
  private readonly notificationsUrl = 'http://localhost:3008/api/private/sendEmail';

  constructor(private readonly httpService: HttpService) {}

  async sendEmail(payload: any, clientname: string) {
    try {
      const response$ = this.httpService.post(this.notificationsUrl, payload, {
        headers: {
          clientname
        },
      });

      const response = await lastValueFrom(response$);
      return response.data;
    } catch (error) {
      throw new HttpException(
        `Error sending email: ${error?.response?.data?.message || error.message}`,
        error?.response?.status || 500,
      );
    }
  }
}
