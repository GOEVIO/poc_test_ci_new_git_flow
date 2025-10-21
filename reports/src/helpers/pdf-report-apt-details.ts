import { KEY_TO_COLUMN_MAP, PDF_CONFIG } from './pdf-config';
import { formatSeconds } from './pdf-functions';
import { APT_SESSION_COLUMNS } from './pdf-config';

export function generateAptReportDetails(
  pdf: PDFKit.PDFDocument,
  translationKeys: Record<string, string>,
  request: any,
  data: any,
) {
  const totalsGroupBy = data.totalsGroupBy || [];

  pdf.addPage();
  for (const group of totalsGroupBy) {
    if (group.list?.length === 0 || !group.list) continue;
    pdf
      .roundedRect(
        PDF_CONFIG.page.margin,
        pdf.y,
        pdf.page.width - PDF_CONFIG.page.margin * 2,
        70,
        1,
      )
      .fillAndStroke(PDF_CONFIG.colors.secondary)
      .moveDown()
      .fill(PDF_CONFIG.colors.primary)
      .stroke()
      .fontSize(8)
      .font(PDF_CONFIG.fonts.bold)
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
      .text(` ${group.address.city}`);

    pdf.y += 15;
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

    pdf.y += 20;

    const { columnWidth, y } = generateHeader(pdf, pdf.y, translationKeys);

    generateItems(pdf, y, columnWidth, group.list, translationKeys);

    pdf.y += 35;

    if (pdf.y > pdf.page.height - 200) {
      pdf.addPage();
      pdf.y = 50;
    }
  }
}

function generateHeader(pdf: PDFKit.PDFDocument, y, translationKeys) {
  const { white, header } = PDF_CONFIG.colors;
  const { regular } = PDF_CONFIG.fonts;
  const { margin } = PDF_CONFIG.page;

  const width = pdf.page.width - margin * 2;
  const columnWidth = width / APT_SESSION_COLUMNS.length;

  pdf.fillColor(white).fontSize(6).font(regular);

  const heights = APT_SESSION_COLUMNS.map((title) =>
    pdf.heightOfString(title, {
      width: columnWidth,
      align: 'center',
    }),
  );

  const rowHeight = Math.max(...heights, 20);

  pdf.save().rect(margin, y, width, rowHeight).fillAndStroke(header).restore();

  APT_SESSION_COLUMNS.forEach((title, index) => {
    const offsetY = (rowHeight - heights[index]) / 2;
    pdf.text(
      translationKeys[title],
      margin + columnWidth * index,
      y + offsetY,
      {
        width: columnWidth,
        align: 'center',
      },
    );
  });
  return { columnWidth, y: y + rowHeight };
}

function generateItems(
  pdf: PDFKit.PDFDocument,
  y: number,
  columnWidth: number,
  sessions: Array<Record<string, any>>,
  translationKeys: Record<string, string>,
) {
  pdf.fontSize(6);
  const { regular } = PDF_CONFIG.fonts;
  const { primary, secondary } = PDF_CONFIG.colors;
  const { margin } = PDF_CONFIG.page;

  let rowHeight = 20;
  const maxY = pdf.page.height - 100;
  let rowNumber = 0;

  sessions.forEach((session) => {
    const heights = Object.values(session).flatMap((value) =>
      pdf.heightOfString(String(value), {
        width: columnWidth,
        align: 'center',
      }),
    );
    rowHeight = Math.max(...heights, rowHeight);
  });

  sessions.forEach((session) => {
    if (y + rowNumber * rowHeight > maxY) {
      pdf.addPage();
      const header = generateHeader(pdf, 50, translationKeys);
      y = header.y;
      rowNumber = 0;
    }

    const currentY = y + rowNumber * rowHeight;

    Object.entries(session).forEach(([key, value]) => {
      if (KEY_TO_COLUMN_MAP[key]) {
        const offsetY =
          (rowHeight - pdf.heightOfString(value, { width: columnWidth })) / 2;
        pdf
          .fillColor(primary)
          .font(regular)
          .fontSize(6)
          .text(
            value,
            margin +
              columnWidth *
                APT_SESSION_COLUMNS.findIndex(
                  (c) =>
                    c.toLowerCase() === KEY_TO_COLUMN_MAP[key].toLowerCase(),
                ),
            currentY + offsetY,
            {
              width: columnWidth,
              align: 'center',
            },
          );
      }
    });
    pdf
      .moveTo(margin, y + rowNumber * rowHeight + rowHeight)
      .lineTo(pdf.page.width - margin, y + rowNumber * rowHeight + rowHeight)
      .stroke(secondary);

    rowNumber++;
  });
}
