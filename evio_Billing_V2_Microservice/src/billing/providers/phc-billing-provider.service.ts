import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BillingProvider } from './billing-provider.interface';
import { InvoiceService } from '../../invoice/invoice.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import Constants from '../../utils/constants';
import { uploadFileToS3 } from '../../utils/aws-s3.util';
import { Writable } from 'stream';
import { InvoiceStatusId } from '../../enums/invoice-status.enum';
const ftp = require('basic-ftp');
import { setTimeout as delay } from 'timers/promises';
import { sendMessage } from 'evio-event-producer';
import { Invoice } from '../../invoice/entities/invoice.entity';

@Injectable()
export class PhcBillingProviderService implements BillingProvider {
  private readonly logger = new Logger(PhcBillingProviderService.name);
  private token: string | null = null;
  private tokenExpiration: number | null = null;

  constructor(
    private readonly http: HttpService,
    private invoiceService: InvoiceService,
    private auditLogService: AuditLogService,
  ) { }

  /**
   * Authenticates with the PHC API and stores the token and its expiration time.
   */
  async authenticate(): Promise<void> {
    const url = `${Constants.services.phc.host}${Constants.services.phc.authenticate}?userid=IDTESTE`;
    const headers = { 'Content-Type': 'application/json' };

    const body = {
      company: Constants.services.phc.company,
      username: Constants.services.phc.username,
      password: Constants.services.phc.password,
    };

    const { data } = await firstValueFrom(
      this.http.request({
        method: 'GET',
        url,
        headers,
        data: body,
      }),
    );

    if (!data?.accesstoken || !data?.accessexpire) {
      throw new Error('Authentication failed: invalid response from PHC');
    }

    this.token = data.accesstoken;
    this.tokenExpiration = new Date(data.accessexpire).getTime();
  }

  /**
   * Retrieves a valid token from memory or re-authenticates if expired.
   */
  private async getToken(): Promise<string> {
    if (
      !this.token ||
      !this.tokenExpiration ||
      Date.now() >= this.tokenExpiration
    ) {
      await this.authenticate();
    }

    if (!this.token) {
      throw new Error(
        'Authentication failed: token is null after authentication',
      );
    }

    return this.token;
  }

  /**
   * Creates an invoice in the PHC system and updates local invoice data.
   * Uploads the generated PDF to S3 and logs the operation.
   */
  async createInvoice(inputData: any): Promise<any> {
    const token = await this.getToken();
    const url = `${Constants.services.phc.host}${Constants.services.phc.createInvoice}?userid=IDTESTE`;

    const body = {
      ...inputData,
      company: Constants.services.phc.company,
      authentication: token,
      action: 'CREATE',
    };

    const headers = { 'Content-Type': 'application/json', 'Connection': 'keep-alive' };

    try {
      const response = await firstValueFrom(
        this.http.post(url, body, { headers }),
      );

      if (!response?.data?.invoiceStampID) {
        this.logger.error(`Error in PHC response`, JSON.stringify(response?.data));
        throw new Error(`Error in PHC response. Cannot proceed with invoice creation.`);
      }

      const currentYear = new Date().getFullYear();
      const invoiceUpdate: Partial<Invoice> = {
        third_party_id: response.data.invoiceStampID,
        status: InvoiceStatusId.SentToThirdPartySuccessful,
        sent_at: new Date(),
      };

      if (response?.data?.fno) {
        invoiceUpdate.invoice_number = `FT ${currentYear}A${inputData.doctype}/${response.data.fno}`;
      }

      const invoice = await this.invoiceService.updateInvoice(
        { id: inputData.invoiceId },
        invoiceUpdate,
      );

      await this.auditLogService.logAction({
        objectType: 'invoice',
        relatedObjectId: inputData.invoiceId,
        action: 'send_invoice_to_third_party',
        oldValue: { third_party_sent: false },
        newValue: {
          third_party_sent: true,
          third_party_invoice_id: response.data.invoiceStampID,
        },
        description: `Invoice sent to PHC and third-party ID received.`,
        triggeredBy: 'system',
      });

      return invoice;
    } catch (error) {
      this.logger.error(
        `Error creating invoice: ${error.message}`,
        error.stack,
      );

      await this.invoiceService.updateInvoice(
        { id: inputData.invoiceId },
        { status: InvoiceStatusId.SendToThirdPartyError },
      );

      const payload = { invoiceId: inputData.invoiceId };
      await sendMessage({ method: 'sendInvoiceToProviderProcess', payload }, 'billing_v2_key');

      await this.auditLogService.logAction({
        objectType: 'invoice',
        relatedObjectId: inputData.invoiceId,
        action: 'send_invoice_to_third_party',
        oldValue: { third_party_sent: false },
        newValue: { third_party_sent: false },
        description: `Error: ${error.message}`,
        triggeredBy: 'system',
      });

      throw error;
    }
  }

  /**
   * Creates a credit note in the PHC system.
   */
  async createCreditNote(data: any): Promise<any> {
    const token = await this.getToken();
    const url = `${Constants.services.phc.host}${Constants.services.phc.createInvoice}?userid=IDTESTE`;

    const body = {
      ...data,
      company: 'TESTES',
      authentication: token,
      action: 'CREATE',
    };

    const headers = { 'Content-Type': 'application/json' };

    const response = await firstValueFrom(
      this.http.post(url, body, { headers }),
    );

    this.logger.log(`PHC createCreditNote from invoice: ${data.ftorigem}  response: ${JSON.stringify(response?.data)}`);
    if (!response?.data?.invoiceStampID) {
      this.logger.error(`Error in PHC response`, JSON.stringify(response?.data));
      throw new Error(`Error in PHC response. Cannot proceed with credit note creation.`);
    }

    return response.data;
  }

  /**
   * Downloads a PDF document (invoice or credit note) from PHC.
   * @param documentId - The external PHC document ID
   * @param type - Type of document: 'invoice' or 'credit_note'
   * @param retryProcess - If true, uses a lower max retry count for the retry process
   */
  async fetchDocument(documentId: string, retryProcess?: boolean): Promise<Buffer> {
    const ftpConfig = {
      host: Constants.services.phc.ftpHost,
      user: Constants.services.phc.ftpUser,
      password: Constants.services.phc.ftpPassword,
      secure: true,
      secureOptions: { rejectUnauthorized: false },
    };

    const client = new ftp.Client();
    const documentIdFormatted = documentId.replace(/\//g, '_');
    const remotePath = `/${documentIdFormatted}.pdf`;
    const maxRetries = retryProcess ? Number(Constants.services.phc.maxRetriesRetryProcess) : (Number(Constants.services.phc.maxRetries) || 15);

    let chunks: Buffer[] = [];

    this.logger.log(`Starting fetchDocument for: ${documentId}`);
    this.logger.log(`Connecting to FTP with host: ${ftpConfig.host}, user: ${ftpConfig.user}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt} to access FTP and fetch: ${remotePath}`);
        await client.access(ftpConfig);

        chunks = [];
        const writableStream = new Writable({
          write(chunk, encoding, callback) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
            callback();
          },
        });

        await client.downloadTo(writableStream, remotePath);

        this.logger.log(`Document ${documentId} successfully fetched from FTP on attempt ${attempt}`);
        return Buffer.concat(chunks);
      } catch (err) {
        if (err.code === 550 && attempt < maxRetries) {
          const waitTime = 1000 * attempt;
          this.logger.warn(`Attempt ${attempt}: file ${remotePath} not ready yet, retrying in ${waitTime}ms...`);
          await delay(waitTime);
        } else {
          this.logger.error(`Failed to fetch document from FTP on attempt ${attempt}: ${err.message}`, err.stack);
          throw new Error(`Could not fetch document from FTP: ${err.message}`);
        }
      } finally {
        client.close();
      }
    }

    this.logger.error(`Document ${documentId} not found after ${maxRetries} attempts`);
    throw new Error(`Document ${documentId} not found after ${maxRetries} attempts`);
  }

  /**
   * Uploads a PDF document to S3 and returns its URL.
   * @param pdfInvoice - PDF file buffer
   * @param invoiceName - Desired name in S3
   */
  async uploadDocument(
    pdfInvoice: Buffer,
    folder: string,
    invoiceName: string,
  ): Promise<string> {
    const invoiceNameFormatted = invoiceName.replace(/\//g, '_');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${folder}/${year}/${month}/${invoiceNameFormatted}.pdf`;

    return await uploadFileToS3(pdfInvoice, fileName);
  }
}
