import { PDF_CONFIG } from './pdf-config';
import { formatSeconds, capitalize } from './pdf-functions';

export function generateAptReportHeader(
  pdf: PDFKit.PDFDocument,
  translationKeys: Record<string, string>,
  request: any,
  data: any,
) {
  const totals = data.totals?.[0] || {};
  pdf
    .image('assets/img/evio.png', pdf.x, pdf.y, {
      width: 70,
      height: 20,
    })
    .fontSize(6)
    .moveDown(4)
    .text('Av. Dom Afonso Henriques 1825', pdf.x, pdf.y)
    .text('Matosinhos')
    .text('351 220 164 800')
    .text('evio@go-evio.com');

  pdf.y += 50;
  pdf
    .roundedRect(
      PDF_CONFIG.page.margin,
      pdf.y,
      pdf.page.width - PDF_CONFIG.page.margin * 2,
      20,
      1,
    )
    .fillAndStroke(PDF_CONFIG.colors.header);

  let textY = pdf.y + 6;

  pdf.x = 70;
  pdf
    .fill(PDF_CONFIG.colors.primary)
    .fillColor(PDF_CONFIG.colors.white)
    .fontSize(6)
    .font('Bold')
    .text(
      `${translationKeys[request.type.toUpperCase()]} ${translationKeys['MONTHLY_REPORT']}`,
      pdf.x,
      textY,
      { continued: true },
    )
    .font('Regular')
    .text(
      ` - ${translationKeys['GROUPED_BY']} ${translationKeys[request.filter.groupBy.toUpperCase()]}`,
      pdf.x,
      textY,
    );
  pdf.font('Awesome-Light').text('\uf073', pdf.x + 350, textY + 0.5, {
    continued: true,
    align: 'left',
  });
  pdf
    .font('Bold')
    .fontSize(6)
    .text(` ${translationKeys['TIME_PERIOD']} `, pdf.x, textY, {
      continued: true,
      align: 'left',
    });
  const monthStartName = new Date(request.filter.startDate).toLocaleString(
    request.language.substr(0, 2) || 'pt',
    {
      month: 'long',
    },
  );
  const monthEndName = new Date(request.filter.endDate).toLocaleString(
    request.language.substr(0, 2) || 'pt',
    {
      month: 'long',
    },
  );
  pdf
    .font('Regular')
    .text(`${capitalize(monthStartName)}`, { align: 'left', continued: true });
  if (monthStartName !== monthEndName) {
    pdf.text(` - ${capitalize(monthEndName)}`);
  }

  pdf.y += 20;

  pdf
    .roundedRect(
      PDF_CONFIG.page.margin,
      pdf.y,
      pdf.page.width - PDF_CONFIG.page.margin * 2,
      60,
      1,
    )
    .fillAndStroke(PDF_CONFIG.colors.secondary)
    .moveDown()
    .fill(PDF_CONFIG.colors.primary)
    .fontSize(8)
    .font('Bold')
    .text(`${translationKeys['TOTAL']}`, 73, pdf.y);

  pdf.y += 5;
  textY = pdf.y;

  pdf
    .fontSize(6)
    .font('Awesome-Solid')
    .text('\uf240', pdf.x, textY + 1, { continued: true, width: 100 })
    .font('Bold')
    .text(` ${translationKeys['SESSIONS']}`, pdf.x, textY)
    .font('Regular')
    .text(` ${totals.totalSessions ?? '-'}`, pdf.x + 6, textY + 8);

  pdf
    .fontSize(6)
    .font('Awesome-Solid')
    .text('\uf0e7', pdf.x + 120, textY + 1, { continued: true })
    .font('Bold')
    .text(` ${translationKeys['ENERGY']}`, pdf.x, textY)
    .font('Regular')
    .text(` ${totals.totalPower / 1000 || '-'} kWh`, pdf.x + 6, textY + 8);

  pdf
    .fontSize(6)
    .font('Awesome-Solid')
    .text('\ue356', pdf.x + 120, textY + 1, { continued: true })
    .font('Bold')
    .text(` ${translationKeys['CHARGING_TIME']}`, pdf.x, textY)
    .font('Regular')
    .text(` ${formatSeconds(totals.timeCharged)}`, pdf.x + 6, textY + 8);

  pdf
    .fontSize(6)
    .font('Awesome-Solid')
    .text('\uf571', pdf.x + 120, textY + 1, { continued: true })
    .font('Bold')
    .text(` ${translationKeys['TOTAL_EXCL_VAT']}`, pdf.x, textY)
    .font('Regular')
    .text(` ${totals.totalPriceExclVat ?? '-'} €`, pdf.x + 6, textY + 8);
}
