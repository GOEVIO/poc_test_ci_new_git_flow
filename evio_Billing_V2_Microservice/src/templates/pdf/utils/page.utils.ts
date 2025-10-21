import { PDF_CONFIG } from '../constants/pdf.config';

export function addPage(doc: PDFKit.PDFDocument) {
  doc.addPage({
    size: 'legal',
    layout: 'landscape',
    margin: PDF_CONFIG.page.marginSmall,
  });
}
