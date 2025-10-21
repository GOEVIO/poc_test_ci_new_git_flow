import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SessionResumeService } from './session-resume.service';
import { Session } from '../../sessions/interfaces/session.interface';
import { InvoiceBilling } from '../../invoice/entities/invoice-billing.entity';
import { Invoice } from '../../invoice/entities/invoice.entity';
import { InvoiceCommunicationItem } from '../../sessions/interfaces/invoice-communication-item.interface';
import { ExcelTemplateService } from '../excel.template.service';

export interface PdfResumePayload {
  branding: any;
  customer: any;
  summary: any;
  sessions: any;
  stations: any;
  footer: any;
}

export interface BuildPdfPayloadParams {
  sessions: Session[];
  invoiceCommunication: InvoiceCommunicationItem[];
  invoiceNumber: string;
  invoiceBilling: InvoiceBilling;
  isAdHoc?: boolean;
}

@Injectable()
export class PdfPayloadBuilderService {
  private readonly logger = new Logger(PdfPayloadBuilderService.name);

  constructor(
    private readonly sessionResume: SessionResumeService,
    private readonly excelTemplateService: ExcelTemplateService
  ) { }

  async buildPayload(params: BuildPdfPayloadParams, cdrExtension: any): Promise<PdfResumePayload> {
    const { sessions, invoiceCommunication, invoiceNumber, invoiceBilling, isAdHoc } = params;
    const sessionNetwork = sessions[0].network || sessions[0].source;
    if (!sessionNetwork) {
      this.logger.error('Session network not found', { sessions });
      throw new BadRequestException('Session network not found');
    }

    let sessionsResume: any;
    let footerResume: any;
    let stations = await this.sessionResume.buildStations(sessions);

    if (sessionNetwork === 'EVIO') {
      sessionsResume = await this.sessionResume.buildResumeEvio(sessions);
      footerResume = [];
    } else {
      if (isAdHoc) {
        sessionsResume = await this.sessionResume.buildResumeAdHoc(sessions, cdrExtension);
        footerResume = await this.sessionResume.buildFooter(cdrExtension, true);
      } else {
        sessionsResume = await this.sessionResume.buildResumePeriodic(sessions, cdrExtension);
        footerResume = await this.sessionResume.buildFooter(cdrExtension, false);
      }
    }

    const summary = await this.sessionResume.retrievePdfResumeServices(
      sessions,
      sessions[0].clientName,
      sessionNetwork,
      sessions[0].billingPeriod
    );

    const totalExclVat = Math.round(sessions.reduce((sum, s) => sum + (s.finalPrices?.totalPrice.excl_vat || s.totalPrice?.excl_vat || 0), 0) * 100) / 100;
    const totalInclVat = Math.round(sessions.reduce((sum, s) => sum + (s.finalPrices?.totalPrice.incl_vat || s.totalPrice?.incl_vat || 0), 0) * 100) / 100;
                    
    return {
      branding: {
        logoPath: this.resolveLogoPath(sessions[0].clientName),
        clientName: sessions[0].clientName,
        companyEmail: process.env.EVIOMAIL
      },
      customer: {
        name: invoiceBilling.name,
        address: [
          invoiceBilling.street ?? "",
          invoiceBilling.number ?? "",
          invoiceBilling.city ?? "",
          invoiceBilling.country ?? ""
        ].filter(Boolean).join(', ').replace(/, -$/, ""),
        language: invoiceCommunication[0].language
      },
      summary: {
        invoiceNumber: invoiceNumber,
        totalExclVat: totalExclVat,
        totalInclVat: totalInclVat,
        items: summary
      },
      sessions: sessionsResume,
      stations: stations,
      footer: footerResume
    };
  }

  private resolveLogoPath(clientName?: string): string {
    if (clientName === 'EVIO') {
      return 'assets/images/evio.png';
    }
    return `assets/wl/${clientName}/logo.png`;
  }
}