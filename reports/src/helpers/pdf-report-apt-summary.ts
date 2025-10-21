import { PDF_CONFIG } from './pdf-config';
import { formatSeconds } from './pdf-functions';

export function generateAptReportSummary(
  pdf: PDFKit.PDFDocument,
  translationKeys: Record<string, string>,
  request: any,
  data: any,
) {
  const totalsGroupBy = data.totalsGroupBy || [];

  for (const group of totalsGroupBy) {
    pdf.y += 35;
    if (pdf.y + 60 > pdf.page.height) pdf.addPage();
    pdf
      .roundedRect(
        PDF_CONFIG.page.margin,
        pdf.y,
        pdf.page.width - PDF_CONFIG.page.margin * 2,
        60,
        1,
      )
      .stroke(PDF_CONFIG.colors.secondary)
      .moveDown()
      .fill(PDF_CONFIG.colors.primary)
      .fontSize(8)
      .font('Bold')
      .text(
        `${translationKeys[request.filter.groupBy.toUpperCase()]} `,
        73,
        pdf.y,
        { continued: true },
      )
      .font('Regular')
      .text(`${group.aptId || group.hwId}`, { continued: true })
      .font('Bold')
      .text(`${translationKeys['LOCATION']} `, 300, pdf.y, { continued: true })
      .font('Regular')
      .text(`${group.address.city}`);

    pdf.y += 5;
    let textY = pdf.y;

    pdf
      .fontSize(6)
      .font('Awesome-Solid')
      .text('\uf240', pdf.x, textY + 1, { continued: true, width: 100 })
      .font('Bold')
      .text(` ${translationKeys['SESSIONS']} `, pdf.x, textY)
      .font('Regular')
      .text(` ${group.totalSessions}`, pdf.x + 6, textY + 8);

    pdf
      .fontSize(6)
      .font('Awesome-Solid')
      .text('\uf0e7', pdf.x + 120, textY + 1, { continued: true })
      .font('Bold')
      .text(` ${translationKeys['ENERGY']} `, pdf.x, textY)
      .font('Regular')
      .text(` ${group.totalPower / 1000} kWh`, pdf.x + 6, textY + 8);

    pdf
      .fontSize(6)
      .font('Awesome-Solid')
      .text('\ue356', pdf.x + 120, textY + 1, { continued: true })
      .font('Bold')
      .text(` ${translationKeys['CHARGING_TIME']} `, pdf.x, textY)
      .font('Regular')
      .text(` ${formatSeconds(group.timeCharged)}`, pdf.x + 6, textY + 8);

    pdf
      .fontSize(6)
      .font('Awesome-Solid')
      .text('\uf571', pdf.x + 120, textY + 1, { continued: true })
      .font('Bold')
      .text(` ${translationKeys['TOTAL_EXCL_VAT']} `, pdf.x, textY)
      .font('Regular')
      .text(` ${group.totalPriceExclVat} €`, pdf.x + 6, textY + 8);
  }
}
