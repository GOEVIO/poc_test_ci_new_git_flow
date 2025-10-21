import { Customer, SummaryData, SummaryItem } from '../dtos/invoice.dto';
import { PDF_CONFIG } from '../constants/pdf.config';

export class PdfInvoiceSummaryBuilder {
  async build(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    summary: SummaryData,
  ) {
    const { bold } = PDF_CONFIG.fonts;
    const { primary, secondary } = PDF_CONFIG.colors;

    doc
      .fillColor(primary)
      .fontSize(20)
      .font(bold)
      .text(
        `${translatedKeys['ANNEX_INVOICE_SUMMARY']} ${summary.invoiceNumber}`,
        50,
        190,
      )
      .rect(50, 230, 500, 60)
      .fillAndStroke(secondary)
      .fill(primary)
      .fontSize(12)
      .font(bold)
      .text(translatedKeys['INVOICE_SUMMARY'], 73, 252);

    const invoiceTableTop = 296;
    this.generateHeader(doc, translatedKeys, invoiceTableTop);
    const y = this.generateItems(
      doc,
      invoiceTableTop + 30,
      translatedKeys,
      summary.items,
    );
    this.generateTotals(doc, translatedKeys, summary, y);
  }

  private generateHeader(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    y: number,
  ) {
    const { primary, white, header } = PDF_CONFIG.colors;
    const { bold } = PDF_CONFIG.fonts;

    doc
      .rect(50, 290, 500, 30)
      .fillAndStroke(header)
      .fill(primary)
      .stroke()
      .fillColor(white)
      .fontSize(13)
      .font(bold)
      .text(translatedKeys['DESCRIPTION'], 70, y)
      .text(translatedKeys['TOTAL_EXCL_VAT'], 340, y, {
        width: 90,
        align: 'center',
      })
      .text(translatedKeys['VAT_VALUE'], 470, y, {
        width: 90,
        align: 'center',
      });
  }

  private generateItems(
    doc: PDFKit.PDFDocument,
    y: number,
    translatedKeys: Record<string, string>,
    summary: SummaryItem[],
  ) {
    const { regular } = PDF_CONFIG.fonts;
    const { primary, rowAlt, rowFill } = PDF_CONFIG.colors;

    summary.forEach((item, index) => {
      const itemY = y + index * 20;
      const rowColor = index % 2 === 0 ? rowFill : rowAlt;
      doc
        .rect(50, itemY, 500, 20)
        .fillAndStroke(rowColor)
        .fill(primary)
        .stroke();

      doc
        .fillColor(primary)
        .fontSize(10)
        .font(regular)
        .text(translatedKeys[item.description], 70, itemY)
        .text(item.price, 340, itemY, { width: 90, align: 'center' })
        .text(item.vat, 470, itemY, { width: 90, align: 'center' });
    });

    return doc.y;
  }

  private generateTotals(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    summary: SummaryData,
    y: number,
  ) {
    const { bold, regular } = PDF_CONFIG.fonts;
    const { primary } = PDF_CONFIG.colors;

    doc
      .fillColor(primary)
      .fontSize(12)
      .font(regular)
      .text(translatedKeys['SUB_TOTAL'], 340, y + 20, {
        width: 90,
        align: 'right',
      })
      .text(summary.totalExclVat, 470, y + 20, { width: 70, align: 'right' })
      .font(bold)
      .text(translatedKeys['TOTAL_INCL_VAT'], 340, y + 40, {
        width: 90,
        align: 'right',
      })
      .text(summary.totalInclVat, 470, y + 40, { width: 70, align: 'right' });
  }
}
