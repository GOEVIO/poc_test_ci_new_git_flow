import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { getInvoiceEmailTranslations, getCreditNoteEmailTranslations } from '../helpers/email-translations';
import Constants from '../utils/constants';
import { ClientNames } from "evio-library-commons";

@Injectable()
export class CustomMailerService {
    constructor(private configService: ConfigService) { }

    private getTransporter(clientName: string): nodemailer.Transporter {
        let mailUser: string | undefined;
        let mailPass: string | undefined;

        switch (clientName) {
            case ClientNames.EVIO:
                mailUser = Constants.email.clientNames.EVIO.user;
                mailPass = Constants.email.clientNames.EVIO.pass;
                break;
            case ClientNames.ACP:
                mailUser = Constants.email.clientNames.ACP.user;
                mailPass = Constants.email.clientNames.ACP.pass;
                break;
            case ClientNames.GoCharge:
                mailUser = Constants.email.clientNames.GoCharge.user;
                mailPass = Constants.email.clientNames.GoCharge.pass;
                break;
            case ClientNames.Hyundai:
                mailUser = Constants.email.clientNames.Hyundai.user;
                mailPass = Constants.email.clientNames.Hyundai.pass;
                break;
            default:
                mailUser = Constants.email.clientNames.EVIO.user;
                mailPass = Constants.email.clientNames.EVIO.pass;
        }

        if (mailUser === undefined || mailPass === undefined) {
            console.error(`Mail user or password is undefined for client: ${clientName}`);
            mailUser = Constants.email.clientNames.EVIO.user;
            mailPass = Constants.email.clientNames.EVIO.pass;
        }

        return nodemailer.createTransport({
            maxConnections: 2,
            maxMessages: 1,
            pool: true,
            host: Constants.email.host,
            port: Constants.email.port,
            secure: Constants.email.port == 465 ? true : false,
            auth: {
                user: mailUser,
                pass: mailPass,
            },
        });
    }

    async sendEmail(options: {
        to: string | string[], 
        bcc?: string | string[];
        subject: string;
        html: string;
        attachments?: any[];
        clientName: string;
    }): Promise<void> {
        const { to, subject, html, attachments, bcc, clientName } = options;
        const context = 'Function sendEmail';

        try {
            const transporter = this.getTransporter(clientName);
            await transporter.verify();

            const mailUser = transporter.options.auth.user;

            const fromName = this.getFromName(clientName);
            const mailOptions = {
                from: `"${fromName}" <${mailUser}>`,
                to,
                bcc,
                subject,
                html,
                attachments,
            };

            await transporter.sendMail(mailOptions);
            console.log(`[${context}] Email sent successfully to: ${to}`);
        } catch (error) {
            console.error(`[${context}] Error:`, error?.message);
            throw new Error('Error sending email');
        }
    }

    async prepareEmailHtml(
      name: string,
      language: string,
      company: string,
      templateType: string = 'invoice'
    ): Promise<string> {
        const htmlPath =
            company === 'EVIO'
                ? path.join(process.cwd(), 'src', 'templates', 'html', templateType, 'EVIO', 'index.html')
                : path.join(process.cwd(), 'src', 'templates', 'html', templateType, 'wl', company, 'index.html');
        const htmlTemplate = await fs.readFile(htmlPath, 'utf-8');

        const loadImageAsBase64 = async (filePath: string) => {
            const file = await fs.readFile(filePath);
            return file.toString('base64');
        };

        const baseImgPath =
            company === 'EVIO'
                ? path.join(process.cwd(), 'src', 'templates', 'html', templateType, 'EVIO', 'img')
                : path.join(process.cwd(), 'src', 'templates', 'html', templateType, 'wl', company, 'img');

        const images = {
            Logo: await loadImageAsBase64(path.join(baseImgPath, 'Logo.png')),
            line: await loadImageAsBase64(path.join(baseImgPath, 'line.png')),
            charge: await loadImageAsBase64(path.join(baseImgPath, 'charge.png')),
            call: await loadImageAsBase64(path.join(baseImgPath, 'call.png')),
            email: await loadImageAsBase64(path.join(baseImgPath, 'email.png')),
            apple: await loadImageAsBase64(path.join(baseImgPath, 'apple.png')),
            play: await loadImageAsBase64(path.join(baseImgPath, 'play.png')),
        };

        const translations = templateType === 'invoice'
            ? getInvoiceEmailTranslations(name, company)
            : getCreditNoteEmailTranslations(name, company);

        const selectedLanguage =
            translations[language] ??
            translations[language.split('_')[0]] ??
            translations['EN_GB'];

        const templateData = {
            ...images,
            ...selectedLanguage,
            linkApple: 'https://apps.apple.com/app/id123456789',
            linkGoogle: 'https://play.google.com/store/apps/details?id=com.example',
        };

        const template = handlebars.compile(htmlTemplate);
        return template(templateData);
    }

    private getFromName(clientName: string): string {
        if (clientName === 'Salvador Caetano') {
            return 'GoCharge';
        }
        if (clientName === 'ACP') {
            return 'ACP Electric';
        }
        return `${clientName}`;
    }
}
