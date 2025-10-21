import { Branding, Customer } from '../dtos/invoice.dto';
import { PDF_CONFIG } from '../constants/pdf.config';

export class PdfHeaderBuilder {
  build(doc: PDFKit.PDFDocument, branding: Branding, customer: Customer) {
    const { regular } = PDF_CONFIG.fonts;
    doc.font(regular);

    if (branding?.logoPath) {
      doc
        .image(branding.logoPath, 50, 45, { width: 70, height: 20 })
        .fontSize(10)
        .text(branding?.companyEmail, 50, 70)
        .text(customer?.name, 200, 130, { align: 'right' })
        .text(customer?.address, 200, 145, { align: 'right' });
    }
  }
}
