import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PdfHeaderBuilder } from './builders/header.builder';
import { PdfInvoiceSummaryBuilder } from './builders/summary.builder';
import { PdfSessionSummaryBuilder } from './builders/session.builder';
import { PdfLocationBuilder } from './builders/location.builder';
import { PDF_CONFIG } from './constants/pdf.config';
import { translate } from './utils/translation.utils';

@Injectable()
export class InvoicePdfService {
  constructor(
    private readonly headerBuilder: PdfHeaderBuilder,
    private readonly summaryBuilder: PdfInvoiceSummaryBuilder,
    private readonly sessionBuilder: PdfSessionSummaryBuilder,
    private readonly locationBuilder: PdfLocationBuilder,
  ) { }

  private readonly LANGUAGE_MAP: Record<string, string> = {
    'en-gb': 'en',
    'pt-pt': 'pt_PT',
    'pt': 'pt_PT'
  };

  normalizeLanguageCode(code: string): string {
    const key = code?.toLowerCase().replace('_', '-') || 'en-gb';
    return this.LANGUAGE_MAP[key] || 'en';
  }

  async generatePdf(data: any): Promise<Buffer> {
    return new Promise(async (resolve) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: PDF_CONFIG.page.margin,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const normalizedLanguage = this.normalizeLanguageCode(data.customer.language);
      const translatedKeys = await translate(normalizedLanguage);

      this.headerBuilder.build(doc, data.branding, data.customer);
      this.summaryBuilder.build(doc, translatedKeys, data.summary);
      this.sessionBuilder.build(doc, translatedKeys, data.sessions);

      if (data.stations && data.stations.length > 0) {
        this.locationBuilder.build(
          doc,
          translatedKeys,
          data.stations,
          data.footer
        );
      }

      doc.end();
    });
  }
}
