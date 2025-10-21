import { SessionData, StationData } from '../dtos/invoice.dto';
import {
  CHARGING_STATION_COLUMNS,
  getSessionColumns,
} from '../constants/session.config';
import { PDF_CONFIG } from '../constants/pdf.config';
import { addPage } from '../utils/page.utils';

export class PdfSessionSummaryBuilder {
  build(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    sessions: SessionData[],
  ) {
    sessions.forEach((sessionNetwork) => {
      addPage(doc);
      this.generateTitleSection(doc, translatedKeys, sessionNetwork);

      const columns = getSessionColumns(sessionNetwork.network);
      const { columnWidth, y } = this.generateHeader(
        doc,
        163,
        translatedKeys,
        columns,
      );

      this.generateItems(
        doc,
        y,
        columnWidth,
        translatedKeys,
        sessionNetwork,
        columns,
      );
    });
  }

  private generateTitleSection(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    sessions: SessionData,
  ) {
    const { bold, regular } = PDF_CONFIG.fonts;
    const { primary, secondary } = PDF_CONFIG.colors;
    const { marginSmall } = PDF_CONFIG.page;

    doc
      .fillColor(primary)
      .fontSize(20)
      .font(bold)
      .text(translatedKeys[sessions.title], 50, 50);

    doc
      .rect(marginSmall, 85, doc.page.width - marginSmall * 2, 80)
      .fillAndStroke(secondary)
      .fill(primary)
      .stroke()
      .fontSize(12)
      .font(bold)
      .text(translatedKeys['CHARGING_SESSION_SUMMARY'], 65, 92);

    doc
      .fontSize(11)
      .font(bold)
      .text(translatedKeys['SESSIONS'], 100, 117)
      .font(regular)
      .text(String(sessions.count), 100, 135)
      .font(bold)
      .text(translatedKeys['CHARGING_TIME'], 435, 117)
      .font(regular)
      .text(sessions.totalTime, 435, 135)
      .font(bold)
      .text(translatedKeys['ENERGY'], 780, 117)
      .font(regular)
      .text(sessions.totalEnergy, 780, 135);
  }

  private generateHeader(
    doc: PDFKit.PDFDocument,
    y: number,
    translatedKeys: Record<string, string>,
    columns: string[],
  ) {
    const { white, header } = PDF_CONFIG.colors;
    const { regular } = PDF_CONFIG.fonts;
    const { marginSmall } = PDF_CONFIG.page;

    const width = doc.page.width - marginSmall * 2;
    const columnWidth = width / columns.length;

    doc.fillColor(white).fontSize(10).font(regular);

    const heights = columns.map((title) =>
      doc.heightOfString(translatedKeys[title], {
        width: columnWidth,
        align: 'center',
      }),
    );

    const rowHeight = Math.max(...heights);

    doc
      .save()
      .rect(marginSmall, y, width, rowHeight)
      .fillAndStroke(header)
      .restore();

    columns.forEach((title, index) => {
      const offsetY = (rowHeight - heights[index]) / 2;
      doc.text(
        translatedKeys[title],
        marginSmall + columnWidth * index,
        y + offsetY,
        {
          width: columnWidth,
          align: 'center',
        },
      );
    });

    return { columnWidth, y: y + rowHeight };
  }

  private generateItems(
    doc: PDFKit.PDFDocument,
    y: number,
    columnWidth: number,
    translatedKeys: Record<string, string>,
    sessions: SessionData,
    columns: string[],
  ) {
    const { regular, bold } = PDF_CONFIG.fonts;
    const { primary, line } = PDF_CONFIG.colors;
    const { marginSmall } = PDF_CONFIG.page;

    let rowHeight = 30;
    const maxY = 530;
    let rowNumber = 0;

    sessions.items.forEach((session) => {
      const heights = Object.values(session).map((value) =>
        doc.heightOfString(String(value), {
          width: columnWidth,
          align: 'center',
        }),
      );
      rowHeight = Math.max(...heights, rowHeight);
    });

    sessions.items.forEach((session) => {
      if (y + rowNumber * rowHeight > maxY) {
        addPage(doc);
        const header = this.generateHeader(
          doc,
          50,
          translatedKeys,
          getSessionColumns(sessions.network),
        );
        y = header.y;
        rowNumber = 0;
      }

      const currentY = y + rowNumber * rowHeight;

      Object.entries(session).forEach(([key, value]) => {
        if (columns.includes(key.toUpperCase())) {
          const offsetY =
            (rowHeight - doc.heightOfString(value, { width: columnWidth })) / 2;
          doc
            .fillColor(primary)
            .font(regular)
            .fontSize(10)
            .text(
              value,
              marginSmall +
                columnWidth *
                  columns.findIndex(
                    (c) => c.toLowerCase() === key.toLowerCase(),
                  ),
              currentY + offsetY,
              {
                width: columnWidth,
                align: 'center',
              },
            );
        }
      });

      this.addOpcPriceIfNeeded(
        doc,
        currentY + rowHeight - 12,
        session,
        columns,
        columnWidth,
      );

      doc
        .moveTo(marginSmall, y + rowNumber * rowHeight + rowHeight)
        .lineTo(
          doc.page.width - marginSmall,
          y + rowNumber * rowHeight + rowHeight,
        )
        .stroke(line);

      rowNumber++;
    });

    const finalY = y + rowNumber * rowHeight + 22;

    doc
      .fillColor(primary)
      .font(regular)
      .fontSize(12)
      .text(translatedKeys['SUB_TOTAL'], 800, finalY, {
        width: 90,
        align: 'left',
      })
      .text(sessions.totalExclVat, 850, finalY, { width: 90, align: 'right' })
      .font(bold)
      .fontSize(13)
      .text(translatedKeys['TOTAL_INCL_VAT'], 800, finalY + 22, {
        width: 90,
        align: 'left',
      })
      .text(sessions.totalInclVat, 850, finalY + 22, {
        width: 90,
        align: 'right',
      });
  }

  private addOpcPriceIfNeeded(
    doc: PDFKit.PDFDocument,
    y: number,
    metadata: Record<string, any>,
    columns: string[],
    columnWidth: number,
  ) {
    const { marginSmall } = PDF_CONFIG.page;
    const { line } = PDF_CONFIG.colors;
    const { regular } = PDF_CONFIG.fonts;
    doc.fillColor(line).fontSize(8).font(regular);

    if (columns.includes('OPC_TIME_EUR') && metadata['RATE_PER_MIN_EUR']) {
      doc.text(
        `${metadata['RATE_PER_MIN_EUR']} €/min`,
        marginSmall +
          columnWidth * columns.findIndex((c) => c === 'OPC_TIME_EUR'),
        y,
        {
          width: columnWidth,
          align: 'center',
        },
      );
    }
    if (columns.includes('OPC_ENERGY_EUR') && metadata['RATE_PER_KWH_EUR']) {
      doc.text(
        `${metadata['RATE_PER_KWH_EUR']} €/kWh`,
        marginSmall +
          columnWidth * columns.findIndex((c) => c === 'OPC_ENERGY_EUR'),
        y,
        {
          width: columnWidth,
          align: 'center',
        },
      );
    }
    if (
      columns.includes('OPC_ACTIVATION_EUR') &&
      metadata['UNIT_PRICE_OPC_FLAT']
    ) {
      doc.text(
        `${metadata['UNIT_PRICE_OPC_FLAT']} €`,
        marginSmall +
          columnWidth * columns.findIndex((c) => c === 'OPC_ACTIVATION_EUR'),
        y,
        {
          width: columnWidth,
          align: 'center',
        },
      );
    }
    if (columns.includes('IEC_EUR') && metadata['UNIT_PRICE_IEC']) {
      doc.text(
        `${metadata['UNIT_PRICE_IEC']} €/kWh`,
        marginSmall + columnWidth * columns.findIndex((c) => c === 'IEC_EUR'),
        y,
        {
          width: columnWidth,
          align: 'center',
        },
      );
    }
  }
}
