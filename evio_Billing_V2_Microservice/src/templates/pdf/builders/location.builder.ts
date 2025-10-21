import { brotliDecompress } from 'zlib';
import { PDF_CONFIG } from '../constants/pdf.config';
import { CHARGING_STATION_COLUMNS } from '../constants/session.config';
import { Footer, StationData, PriceTable } from '../dtos/invoice.dto';
import { addPage } from '../utils/page.utils';
import { stroke } from 'pdfkit';
import { Boolean } from 'aws-sdk/clients/cloudsearch';

export class PdfLocationBuilder {
  private readonly rowHeight = 24;
  private readonly maxY = 530;
  private readonly colWidth = 110;
  private readonly tableWidth = this.colWidth * 3;

  build(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    stations: StationData[],
    footer: Footer
  ) {
    this.generateTitleSection(doc, translatedKeys, footer);
    this.generateHeader(doc, translatedKeys);
    this.generateItems(doc, translatedKeys, stations);
  }

  private generateTitleSection(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    footer: Footer,
  ) {
    const { bold } = PDF_CONFIG.fonts;
    const { primary } = PDF_CONFIG.colors;
    const { margin } = PDF_CONFIG.page;

    const { summaryText, activationFeeAdHoc, activationFee, priceTable } =
      footer || {};

    if (doc.y + this.rowHeight * 4 > this.maxY) {
      addPage(doc);
      doc.y = 50;
    }

    doc
      .fillColor(primary)
      .fontSize(18)
      .font(bold)
      .text(translatedKeys['CHARGING_STATIONS_DETAILS'], margin, doc.y);

    if (priceTable && activationFeeAdHoc && activationFee) {
      this.generatePriceTable(doc, priceTable, translatedKeys);
    }

    if (summaryText && activationFeeAdHoc && activationFee) {
      this.generateSummaryText(
        doc,
        translatedKeys,
        activationFeeAdHoc,
        activationFee,
        !!priceTable,
      );
    }
  }

  private generatePriceTable(
    doc: PDFKit.PDFDocument,
    priceTable: PriceTable,
    translatedKeys: Record<string, string>,
  ) {
    const priceTableX = 450;
    const previousY = doc.y;
    const { regular } = PDF_CONFIG.fonts;
    const { primary, greenDark, greenLight, greenMedium, white } =
      PDF_CONFIG.colors;
    const {
      unitPriceCEMEOutEmptyBT,
      unitPriceCEMEEmptyBT,
      unitPriceTAROutEmptyBT,
      unitPriceTAREmptyBT,
      unitPriceCEMEOutEmptyMT,
      unitPriceCEMEEmptyMT,
      unitPriceTAROutEmptyMT,
      unitPriceTAREmptyMT,
    } = priceTable;
    doc.font(regular).fillColor(primary).fontSize(10);
    doc.table({
      position: { x: priceTableX, y: doc.y + 40 },
      defaultStyle: { border: 1, borderColor: white },
      columnStyles: [120, 200, 80, 80],
      rowStyles: (i: number) => {
        if (i === 0) {
          return { backgroundColor: greenDark };
        } else if (i === 1 || i === 2) {
          return { backgroundColor: greenLight };
        } else {
          return { backgroundColor: greenMedium };
        }
      },
      data: [
        [
          '',
          {
            textStroke: 0.5,
            textStrokeColor: primary,
            text: translatedKeys['TWO_RATE_TARIFF'],
          },
          {
            textStroke: 0.5,
            textStrokeColor: primary,
            text: translatedKeys['LOW_TENSION'],
          },
          {
            textStroke: 0.5,
            textStrokeColor: primary,
            text: translatedKeys['MEDIUM_TENSION'],
          },
        ],
        [
          {
            rowSpan: 2,
            text: translatedKeys['ENERGY_TARIFF'],
          },
          translatedKeys['PEAK_TARIFF'],
          `${unitPriceCEMEOutEmptyBT} €/kWh`,
          `${unitPriceCEMEOutEmptyMT} €/kWh`,
        ],
        [
          translatedKeys['OFF_PEAK_TARIFF'],
          `${unitPriceCEMEEmptyBT} €/kWh`,
          `${unitPriceCEMEEmptyMT} €/kWh`,
        ],
        [
          { rowSpan: 2, text: translatedKeys['ACCESS_TARIFF'] },
          translatedKeys['PEAK_TARIFF'],
          `${unitPriceTAROutEmptyBT} €/kWh`,
          `${unitPriceTAROutEmptyMT} €/kWh`,
        ],
        [
          translatedKeys['OFF_PEAK_TARIFF'],
          `${unitPriceTAREmptyBT} €/kWh`,
          `${unitPriceTAREmptyMT} €/kWh`,
        ],
      ],
    });
    doc.y = previousY;
  }

  private generateSummaryText(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    activationFeeAdHoc: number,
    activationFee: number,
    hasTable: boolean = false,
  ) {
    const { regular } = PDF_CONFIG.fonts;
    const { line } = PDF_CONFIG.colors;
    const previousY = doc.y;
    const summaryTextX = 450;
    doc.y = hasTable ? doc.y + 140 : doc.y + 40;
    doc
      .fillColor(line)
      .fontSize(9.5)
      .font(regular)
      .text(translatedKeys['PDF_INVOICE_FOOTER_TEXT'], summaryTextX, doc.y, {
        align: 'left',
      })
      .text(
        translatedKeys['PDF_INVOICE_FOOTER_TEXT_FEES']
          .replace('{{activationFeeAdHoc}}', String(activationFeeAdHoc))
          .replace('{{activationFee}}', String(activationFee)),
        summaryTextX,
        doc.y,
        { align: 'left' },
      );
    doc.y = previousY;
  }

  private generateHeader(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
  ) {
    const { primary, white, header } = PDF_CONFIG.colors;
    const { regular } = PDF_CONFIG.fonts;
    const { margin } = PDF_CONFIG.page;

    let y = doc.y;

    doc
      .rect(margin, y, this.tableWidth, this.rowHeight)
      .fillAndStroke(header)
      .fill(primary)
      .stroke();

    y += 8;
    const headers = CHARGING_STATION_COLUMNS;
    headers.forEach((header, i) => {
      doc
        .fillColor(white)
        .fontSize(10)
        .font(regular)
        .text(translatedKeys[header], margin + this.colWidth * i, y, {
          width: this.colWidth,
          align: 'center',
        });
    });
  }

  private generateItems(
    doc: PDFKit.PDFDocument,
    translatedKeys: Record<string, string>,
    stations: StationData[],
  ) {
    const { primary } = PDF_CONFIG.colors;
    const { regular } = PDF_CONFIG.fonts;
    const { margin } = PDF_CONFIG.page;

    let y = doc.y + 8;

    stations.forEach((station) => {
      if (y + this.rowHeight > this.maxY) {
        addPage(doc);
        doc.y = 50;
        this.generateHeader(doc, translatedKeys);
        y = doc.y + 8;
      }

      Object.values(station).forEach((value: string, i) => {
        doc
          .fillColor(primary)
          .font(regular)
          .fontSize(10)
          .text(value, margin + this.colWidth * i, y + 4, {
            width: this.colWidth,
            align: 'center',
          });
      });
      y += this.rowHeight;
    });
  }
}
