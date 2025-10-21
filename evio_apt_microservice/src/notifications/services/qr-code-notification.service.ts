import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sendEmailNotification } from '../../core/helpers/send-email';
import { ISessionEmail } from '../interfaces/session-email.interface';


@Injectable()
export class QrCodeNotificationService {
    private readonly logger = new Logger(QrCodeNotificationService.name);

    constructor(private readonly configService: ConfigService) { }

    private async sendSessionEmail(
        type: string,
        data: ISessionEmail,
    ): Promise<void> {
        const context = `send-${type}`;
        this.logger.log(`[${context}][START] - to=${data.to}`);

        const mailOptions = {
            ...data,
            type
        };

        const sent = await sendEmailNotification(
            mailOptions,
            data.clientName,
            this.configService,
        );

        if (!sent) {
            this.logger.error(`[${context}][FAILED] - to=${data.to}`);
            throw new Error(`[${context}][ERROR] - Email not sent`);
        }

        this.logger.log(`[${context}][SUCCESS] - to=${data.to}`);
    }

    async sendStartSessionEmail(data: ISessionEmail): Promise<void> {
        return this.sendSessionEmail('start-session', data);
    }

    async sendStopSessionEmail(data: ISessionEmail): Promise<void> {
        return this.sendSessionEmail('stop-session', data);
    }
}
