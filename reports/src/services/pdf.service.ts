import PDFDocument from 'pdfkit';
import {
  IReportResponse,
  IReportRequestMessage,
} from '../interfaces/report.interface';
import { PDF_CONFIG } from '../helpers/pdf-config';
import { generateAptReportHeader } from '../helpers/pdf-report-apt-header';
import { generateAptReportSummary } from '../helpers/pdf-report-apt-summary';
import { generateAptReportDetails } from '../helpers/pdf-report-apt-details';
import { formatSeconds } from '../helpers/pdf-functions';

export async function generatePdf(
  request: IReportRequestMessage,
  response: IReportResponse,
  translationKeys: Record<string, string>,
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const pdf = new PDFDocument({ margin: PDF_CONFIG.page.margin, size: 'A4' });

    const chunks: Buffer[] = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', (err) => reject(err));

    pdf.registerFont('Regular', PDF_CONFIG.fonts.regular);
    pdf.registerFont('Bold', PDF_CONFIG.fonts.bold);
    pdf.registerFont('Awesome-Solid', PDF_CONFIG.fonts.awesomeSolid);
    pdf.registerFont('Awesome-Light', PDF_CONFIG.fonts.awesomeLight);

    response.totalsGroupBy.map((group) => {
      group.list?.map((session) => {
        session.startDate = new Date(session.startDate).toLocaleString('pt-PT');
        session.timeCharged = formatSeconds(session.timeCharged);
        session.totalPriceExclVat = `${session.totalPrice.excl_vat} €`;
        session.totalPower = `${session.totalPower / 1000} kWh`;
      });
    });

    generateAptReportHeader(pdf, translationKeys, request, response);
    if (response?.totalsGroupBy && response?.totalsGroupBy?.length > 0) {
      generateAptReportSummary(pdf, translationKeys, request, response);
      generateAptReportDetails(pdf, translationKeys, request, response);
    }

    pdf.end();
  });
}
