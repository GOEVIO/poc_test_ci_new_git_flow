const express = require('express');
const PDFDocument = require('pdfkit');
const MapingWLEmail = require('../../models/MapingWLEmail.json');
const addressS = require("../../services/address")
const { generateFooter } = require("../InvoiceAttachment");
const Constants = require('../constants');

var UtilsMobiE = {
    createInvoicePDF(billingData, invoice, attach, clientName, language) {
        return new Promise((resolve, reject) => {
            try {

                let doc = new PDFDocument({ bufferPages: true, margin: 50 });

                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    let pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                generateHeader(doc, billingData, clientName);
                generateInvoiceSummary(doc, invoice, attach);

                // Request to remove the graphics in the attachment. EVIO-4483
                // generateImage(doc);

                // Generate the footer only for uploads with a MobiE session - 004
                if(invoice.chargerType === "004") {
                    generateFooter(doc, language);
                }
                
                sessionSummary(doc, attach);

                doc.end();
            }
            catch (error) {
                console.error(`[] Error `, error);
                reject(error.message);
            };
        });
    }
}

function generateHeader(doc, billingData, clientName) {

    let address = addressS.parseAddressToString(billingData.billingAddress)

    let logo_url = 'assets/wl/' + clientName + '/logo.png';
    let email = MapingWLEmail.clientName;

    doc
        .image(logo_url, 50, 45, { width: 70, height: 20 })
        .fillColor("#353841")
        .font('assets/fonts/Nunito.ttf')
        .fontSize(10)

        //.text("Av. Dom Afonso Henriques 1825 4450-017 Matosinhos", 50, 80)
        //.text("Portugal", 50, 95)
        //.text("T. +351 220 164 800", 50, 110)
        //.text("suporte@gocharge.pt", 50, 80)
        .text(email, 50, 80)

        .text(`${billingData.billingName}`, 200, 130, { align: "right" })
        .text(address, 200, 145, { align: "right" })
}

function generateInvoiceSummary(doc, invoice, attach) {
    doc
        .fillColor("#353841")
        .fontSize(20)
        .font('assets/fonts/NunitoBold.ttf')
        .text(`Anexo - Resumo da FATURA ${invoice.documentNumber}`, 50, 195 /*200*/);

    doc
        .rect(65, 230, 500, 60)
        .fillAndStroke('#f1f5fe')
        .fill('#353841')
        .stroke()
        .fontSize(12)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Resumo da Fatura", 73, 252, { lineBreak: false });

    let invoiceTableTop = 296;
    generateTableHeader(doc, invoiceTableTop, "Descrição", "Total s/IVA", "Valor IVA");
    generateTableRows(doc, attach, invoice);
}

function generateTableHeader(doc, y, description, totalIva, iva) {
    doc
        .rect(65, 290, 500, 30)
        .fillAndStroke('#71778a')
        .fill('#353841')
        .stroke();

    doc
        .fillColor("#FFFFFF")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text(description, 70, y)
        .text(totalIva, 340, y, { width: 90, align: "center" })
        .text(iva, 470, y, { width: 90, align: "center" });
}

function generateTableRows(doc, attach, invoice) {

    let invoiceTableTop = 325;
    let invoiceTableTopText = invoiceTableTop + 3;
    let lines = attach.overview.lines;
    let total = attach.overview.footer;

    // doc
    //     .rect(75, invoiceTableTop, 490, 20)
    //     .fillAndStroke('#f1f5fe')
    //     .fill('#353841')
    //     .stroke();

    // doc
    //     .fillColor("#353841")
    //     .fontSize(10)
    //     .font('assets/fonts/Nunito.ttf')
    //     .text("Serviços EVIO", 85, invoiceTableTopText)
    //     .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
    //     .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });
    addServicesRow(invoice, lines, doc, invoiceTableTop, invoiceTableTopText)

    invoiceTableTop += 20;
    invoiceTableTopText += 20;
    doc
        .rect(75, invoiceTableTop, 490, 20)
        .fillAndStroke('#fff')
        .fill('#353841')
        .stroke();

    doc
        .fillColor("#353841")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Serviços na rede EVIO", 85, invoiceTableTopText)
        .text(`${checkExcVat(lines.evio_network.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
        .text(`${checkVatValue(lines.evio_network.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

    invoiceTableTop += 20;
    invoiceTableTopText += 20;
    doc
        .rect(75, invoiceTableTop, 490, 20)
        .fillAndStroke('#f1f5fe')
        .fill('#353841')
        .stroke();

    doc
        .fillColor("#353841")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Serviços na rede MOBI.E", 85, invoiceTableTopText)
        .text(`${checkExcVat(lines.mobie_network.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
        .text(`${checkVatValue(lines.mobie_network.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

    invoiceTableTop += 20;
    invoiceTableTopText += 20;
    doc
        .rect(75, invoiceTableTop, 490, 20)
        .fillAndStroke('#fff')
        .fill('#353841')
        .stroke();

    doc
        .fillColor("#353841")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Serviços em outras redes", 85, invoiceTableTopText)
        .text(`${checkExcVat(lines.other_networks.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
        .text(`${checkVatValue(lines.other_networks.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

    invoiceTableTop += 20;
    invoiceTableTopText += 20;
    addWhiteLabelNetworkRow(invoice, lines, doc, invoiceTableTop, invoiceTableTopText)

    invoiceTableTop += 20;
    invoiceTableTopText += 20;

    doc
        .font('assets/fonts/Nunito.ttf')
        .fontSize(12)
        .text("Sub-Total", 420, invoiceTableTopText, { width: 90, align: "left" })
        .text(`${roundValue(total.total_exc_vat)}€`, 470, invoiceTableTopText, { width: 90, align: "right" })

        .font('assets/fonts/NunitoBold.ttf')
        .fontSize(13)
        .text("Total C/IVA", 420, invoiceTableTopText + 17, { width: 90, align: "left" })
        .text(`${roundValue(total.total_inc_vat)}€`, 470, invoiceTableTopText + 17, { width: 90, align: "right" })
        .moveDown();
}

function generateImage(doc) {
    doc
        .fillColor("#8e96ae")
        .font('assets/fonts/Nunito.ttf')
        .fontSize(7)
        .text("Aplicável apenas para carregamentos efetuados na rede MOBI.E", 135, 465)

        .image("assets/images/diagram.png", 75, 475, { width: 320, height: 200 })

        .moveDown();
}


function checkExcVat(value) {
    if (value === 0) {
        return "-";
    }
    else {
        return value.toFixed(2) + "€";
    }
}

function checkVatValue(value) {
    if (value === 0) {
        return "-";
    }
    else {
        return value.toFixed(2) + "€";
    }
}

function sessionSummary(doc, attach) {
    doc.addPage({
        size: 'legal',
        layout: 'landscape',
        margin: 10
    });

    doc.fillColor("#353841")
        .fontSize(20)
        .font('assets/fonts/NunitoBold.ttf')
        .text(`Anexo - Detalhes de serviços na rede MOBI.E`, 50, 50, { align: "left" });

    doc
        .rect(20, 85, 970, 80)
        .fillAndStroke('#f1f5fe')
        .fill('#353841')
        .stroke()
        .fontSize(12)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Resumo de Sessões de Carregamento", 65, 92, { lineBreak: false });

    sessionHeaderSummary(doc, attach);
}

function sessionHeaderSummary(doc, attach) {

    let header = attach.chargingSessions.header;

    doc
        .fontSize(11)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Sessões", 100, 117, { align: "left" })
        .font('assets/fonts/Nunito.ttf')
        .text(header.sessions, 100, 135, { align: "left" })

        .font('assets/fonts/NunitoBold.ttf')
        .text("Tempo de carregamento", 435, 117, { align: "left" })
        .font('assets/fonts/Nunito.ttf')
        .text(header.totalTime, 435, 135, { align: "left" })

        .font('assets/fonts/NunitoBold.ttf')
        .text("Energia", 780, 117, { align: "left" })
        .font('assets/fonts/Nunito.ttf')
        .text(header.totalEnergy, 780, 135, { align: "left" });

    summaryTableHeader(doc, attach);
}

function summaryTableHeader(doc, attach) {

    let height = 50;

    doc
        .rect(20, 165, 970, height)
        .fillAndStroke('#71778a')
        .fill('#353841')
        .stroke();

    let y = 183;
    let width = 52.8;
    let x = 20;

    /*doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Data", x + width * 0, y, { width: width, align: "center" })
        .text("Início", x + width * 1, y, { width: width, align: "center" })
        .text("Duração", x + width * 2, y, { width: width, align: "center" })
        .text("Cidade", x + width * 3, y, { width: width, align: "center" })
        .text("Posto", x + width * 4, y, { width: width, align: "center" })
        .text("Energia Consumida (kWh)", x + width * 5, y - 13, { width: width + 6, align: "center" })
        .text("Custo Energia (€)", x + width * 6 + 6, y - 7, { width: width, align: "center" })
        .text("TAR (€)", x + width * 7 + 6, y, { width: width - 6, align: "center" })
        .text("Desconto (€)", x + width * 8, y - 7, { width: width, align: "center" })
        .text("Taxa de Ativação (€)", x + width * 9, y - 13, { width: width, align: "center" })
        .text("OPC por Tempo (€)", x + width * 10, y - 7, { width: width, align: "center" })
        .text("OPC por Enegia (€)", x + width * 11, y - 7, { width: width, align: "center" })
        .text("OPC Ativação (€)", x + width * 12, y - 13, { width: width, align: "center" })
        .text("IEC (€)", x + width * 13, y, { width: width, align: "center" })
        .text("Total s/IVA (€)", x + width * 14, y - 7, { width: width, align: "center" })
        .text("IVA (%)", x + width * 15, y, { width: width, align: "center" })
        .text("Total c/IVA (€)", x + width * 16, y - 7, { width: width, align: "center" });
        */

    doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Data", x + width * 0, y, { width: width, align: "center" })
        .text("Início", x + width * 1, y, { width: width, align: "center" })
        .text("Duração", x + width * 2, y, { width: width, align: "center" })
        .text("Posto", x + width * 3, y, { width: width, align: "center" })
        .text("Matricula", x + width * 4, y, { width: width, align: "center" })
        .text("Energia Vazio (kWh)", x + width * 5, y - 13, { width: width, align: "center" })
        .text("Energia Fora Vazio (kWh)", x + width * 6, y - 13, { width: width, align: "center" })
        .text("Tarifa de Ativação (€)", x + width * 7, y - 13, { width: width, align: "center" })
        .text("Custo Energia (€)", x + width * 8, y - 7, { width: width, align: "center" })
        .text("TAR (€)", x + width * 9, y, { width: width, align: "center" })
        .text("Apoio Público (€)", x + width * 10, y - 7, { width: width, align: "center" })
        .text("OPC por Tempo (€)", x + width * 11, y - 7, { width: width, align: "center" })
        .text("OPC por Enegia (€)", x + width * 12, y - 7, { width: width, align: "center" })
        .text("OPC Ativação (€)", x + width * 13, y - 13, { width: width, align: "center" })
        .text("IEC (€)", x + width * 14, y, { width: width, align: "center" })
        .text("Total s/IVA (€)", x + width * 15, y - 7, { width: width, align: "center" })
        .text("IVA (%)", x + width * 16, y, { width: width, align: "center" })
        .text("Total c/IVA (€)", x + width * 17, y - 7, { width: width, align: "center" });

    summaryTableRows(doc, attach, 215);
}

function createLineSeparator(doc, x, y, add) {
    doc
        .strokeColor("#FFFFFF")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x, y + add)
        .stroke();
}

function summaryTableRows(doc, attach, height) {

    let data = attach.chargingSessions.lines;
    let unitPricesSummary = attach.chargingSessions.unitPricesSummary;
    let summaryAddress = attach.chargingSessions.summaryAddress;
    let row_height = 30;
    let nextPageLength = 530;

    data.forEach(line => {
        //Cria nova página se necessário 
        if (height > nextPageLength) {
            height = addNewSummaryPage(doc);
        }

        row_height = checkRowHeight(line, row_height);

        row_height = row_height + 12;

        let y = height + (row_height / 2) - 5;
        createSummaryTableRow(doc, line, y, height, row_height);
        height += row_height;
        row_height = 30;
    });

    //Add summary total cost
    //Fazer se check + height = muda de pagina
    if (height + 20 > nextPageLength) {
        height = totalNextPage(doc);
    }

    let footer = attach.chargingSessions.footer;
    doc
        .fillColor("#353841")
        .font('assets/fonts/Nunito.ttf')
        .fontSize(12)
        .text("Sub-Total", 800, height + 5, { width: 90, align: "left" })
        .text(`${roundValue(footer.total_exc_vat)}€`, 850, height + 5, { width: 90, align: "right" })

        .font('assets/fonts/NunitoBold.ttf')
        .fontSize(13)
        .text("Total C/IVA", 800, height + 22, { width: 90, align: "left" })
        .text(`${roundValue(footer.total_inc_vat)}€`, 850, height + 22, { width: 90, align: "right" })
        .moveDown();

    //Checkar se é necessario nova pagina
    let addUnitPriceTable = false
    if (height + 150 <= nextPageLength) {
        addUnitPricesTable(doc, height + 18, unitPricesSummary);
        addUnitPriceTable = true;
    }

    if (height + 94 > nextPageLength) {

        doc.addPage({
            size: 'legal',
            layout: 'landscape',
            margin: 10
        });

        if (addUnitPriceTable == false) {
            addUnitPricesTable(doc, 25, unitPricesSummary);
            addUnitPriceTable = true;
        }

        //reset page height
        height = 10;

    }

    //Add unit tables if is not yet in any page
    addLocationsTable(doc, height + 50, summaryAddress, unitPricesSummary, addUnitPriceTable);

}

function createSummaryTableRow(doc, line, y, height, row_height) {

    //let width = 50.2;
    let width = 52.8;
    let x = 20;

    /*doc
        .fillColor("#353841")
        .fontSize(9)
        .font('assets/fonts/Nunito.ttf')
        .text(`${checkRowContent(line.date)}`, x + width * 0, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.startTime)}`, x + width * 1, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.duration)}`, x + width * 2, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.city)}`, x + width * 3, checkRowHeightCityElement(line.city, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.hwId)}`, x + width * 4, checkRowHeightChargerElement(line.hwId, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.totalPower)}`, x + width * 5, y, { width: width + 6, align: "center" })
        .text(`${checkRowContent(line.energyCost)}`, x + width * 6 + 6, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.tar)}`, x + width * 7 + 6, y, { width: width - 6, align: "center" })
        .text(`${checkRowContent(line.mobiEGrant)}`, x + width * 8, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.activationFee)}`, x + width * 9, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.opcTimeCost)}`, x + width * 10, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.opcEnergyCost)}`, x + width * 11, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.opcFlatCost)}`, x + width * 12, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.iec)}`, x + width * 13, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.total_exc_vat)}`, x + width * 14, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.vat)}`, x + width * 15, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.total_inc_vat)}`, x + width * 16, y, { width: width, align: "center" });
*/

    doc
        .fillColor("#353841")
        .fontSize(9)
        .font('assets/fonts/Nunito.ttf')
        .text(`${checkRowContent(line.date)}`, x + width * 0, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.startTime)}`, x + width * 1, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.duration)}`, x + width * 2, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.hwId)}`, x + width * 3, checkRowHeightChargerElement(line.hwId, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.licensePlate)}`, x + width * 4, checkRowHeightElement(line.licensePlate, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.energyConsumedEmpty)}`, x + width * 5, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.energyConsumedOutEmpty)}`, x + width * 6, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.activationFee)}`, x + width * 7, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.energyCost)}`, x + width * 8, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.tar)}`, x + width * 9, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.mobiEGrant)}`, x + width * 10, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.opcTimeCost)}`, x + width * 11, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.opcEnergyCost)}`, x + width * 12, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.opcFlatCost)}`, x + width * 13, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.iec)}`, x + width * 14, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.total_exc_vat)}`, x + width * 15, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.vat)}`, x + width * 16, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.total_inc_vat)}`, x + width * 17, y, { width: width, align: "center" });

    y = y + 13.5

    if (line.unitPriceOPCTime !== 0) {
        doc
            .fillColor("#8E96AE")
            .fontSize(8)
            .font('assets/fonts/Nunito.ttf')
            .text(`${checkRowContent(line.unitPriceOPCTime)} €/min`, x + width * 11, y, { width: width, align: "center" });
    }

    if (line.unitPriceOPCEnergy !== 0) {
        doc
            .fillColor("#8E96AE")
            .fontSize(8)
            .font('assets/fonts/Nunito.ttf')
            .text(`${checkRowContent(line.unitPriceOPCEnergy)} €/kWh`, x + width * 12, y, { width: width, align: "center" });
    }

    if (line.unitPriceOPCFlat !== 0) {
        doc
            .fillColor("#8E96AE")
            .fontSize(8)
            .font('assets/fonts/Nunito.ttf')
            .text(`${checkRowContent(line.unitPriceOPCFlat)}€`, x + width * 13, y, { width: width, align: "center" });
    }

    if (line.unitPriceIEC !== 0) {
        doc
            .fillColor("#8E96AE")
            .fontSize(8)
            .font('assets/fonts/Nunito.ttf')
            .text(`${checkRowContent(line.unitPriceIEC)} €/kWh`, x + width * 14, y, { width: width, align: "center" });
    }

    doc
        .strokeColor("#8e96ae")
        .lineWidth(0.1)
        .moveTo(20, height + row_height)
        .lineTo(990, height + row_height)
        .stroke();

}

function checkRowContent(element) {
    if (element == 0 || element == undefined || element === '') {
        return "-";
    }
    else {
        return element;
    }
}

function addNewSummaryPage(doc) {

    doc.addPage({
        size: 'legal',
        layout: 'landscape',
        margin: 10
    });

    let resetPageHeight = 115;
    let height = 50;

    doc
        .rect(20, 65, 970, height)
        .fillAndStroke('#71778a')
        .fill('#353841')
        .stroke();

    let y = 83;
    let x = 20;
    //let width = 50.2;
    let width = 52.8;

    /* doc
         .fillColor("#FFFFFF")
         .fontSize(10)
         .font('assets/fonts/Nunito.ttf')
         .text("Data", x + width * 0, y, { width: width, align: "center" })
         .text("Início", x + width * 1, y, { width: width, align: "center" })
         .text("Duração", x + width * 2, y, { width: width, align: "center" })
         .text("Cidade", x + width * 3, y, { width: width, align: "center" })
         .text("Posto", x + width * 4, y, { width: width, align: "center" })
         .text("Energia Consumida (kWh)", x + width * 5, y - 13, { width: width + 6, align: "center" })
         .text("Custo Energia (€)", x + width * 6 + 6, y - 7, { width: width, align: "center" })
         .text("TAR (€)", x + width * 7 + 6, y, { width: width - 6, align: "center" })
         .text("Desconto (€)", x + width * 8, y - 7, { width: width, align: "center" })
         .text("Taxa de Ativação (€)", x + width * 9, y - 13, { width: width, align: "center" })
         .text("OPC por Tempo (€)", x + width * 10, y - 7, { width: width, align: "center" })
         .text("OPC por Enegia (€)", x + width * 11, y - 7, { width: width, align: "center" })
         .text("OPC Ativação (€)", x + width * 12, y - 13, { width: width, align: "center" })
         .text("IEC (€)", x + width * 13, y, { width: width, align: "center" })
         .text("Total s/IVA (€)", x + width * 14, y - 7, { width: width, align: "center" })
         .text("IVA (%)", x + width * 15, y, { width: width, align: "center" })
         .text("Total c/IVA (€)", x + width * 16, y - 7, { width: width, align: "center" });
 */

    doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Data", x + width * 0, y, { width: width, align: "center" })
        .text("Início", x + width * 1, y, { width: width, align: "center" })
        .text("Duração", x + width * 2, y, { width: width, align: "center" })
        .text("Posto", x + width * 3, y, { width: width, align: "center" })
        .text("Matricula", x + width * 4, y, { width: width, align: "center" })
        .text("Energia Vazio (kWh)", x + width * 5, y - 13, { width: width, align: "center" })
        .text("Energia Fora Vazio (kWh)", x + width * 6, y - 13, { width: width, align: "center" })
        .text("Tarifa de Ativação (€)", x + width * 7, y - 13, { width: width, align: "center" })
        .text("Custo Energia (€)", x + width * 8, y - 7, { width: width, align: "center" })
        .text("TAR (€)", x + width * 9, y, { width: width, align: "center" })
        .text("Apoio Público (€)", x + width * 10, y - 7, { width: width, align: "center" })
        .text("OPC por Tempo (€)", x + width * 11, y - 7, { width: width, align: "center" })
        .text("OPC por Enegia (€)", x + width * 12, y - 7, { width: width, align: "center" })
        .text("OPC Ativação (€)", x + width * 13, y - 13, { width: width, align: "center" })
        .text("IEC (€)", x + width * 14, y, { width: width, align: "center" })
        .text("Total s/IVA (€)", x + width * 15, y - 7, { width: width, align: "center" })
        .text("IVA (%)", x + width * 16, y, { width: width, align: "center" })
        .text("Total c/IVA (€)", x + width * 17, y - 7, { width: width, align: "center" });

    return resetPageHeight;
}


function addUnitPricesTable(doc, y, unitPricesSummary) {

    let height_element = 20;
    let new_height = y + 40;
    let x_start = 450;

    let aid = "0.2614"
    if (unitPricesSummary)
        if (unitPricesSummary.mobiEGrant)
            aid = unitPricesSummary.mobiEGrant

    let activationFee = Constants.defaultCEMEtariff.activationFee
    if (unitPricesSummary)
        if (unitPricesSummary.activationFee)
            activationFee = unitPricesSummary.activationFee

    let activationFeeAdHoc = Constants.defaultCEMEtariff.activationFeeAdHoc
    if (unitPricesSummary)
        if (unitPricesSummary.activationFeeAdHoc)
            activationFeeAdHoc = unitPricesSummary.activationFeeAdHoc

    doc
        .rect(x_start, new_height, 485, height_element)
        .fillAndStroke('#00FFCC')
        .fill('#00FFCC')
        .stroke();

    new_height = new_height + 20;

    doc
        .rect(x_start, new_height, 485, 40)
        .fillAndStroke('#E7FFF6')
        .fill('#E7FFF6')
        .stroke();

    doc
        .rect(x_start, new_height + 40, 485, 40)
        .fillAndStroke('#CBFFEC')
        .fill('#CBFFEC')
        .stroke();

    createLineSeparator(doc, x_start + 120, new_height - 20, 100);

    createLineSeparator(doc, x_start + 320, new_height - 20, 100);

    createLineSeparator(doc, x_start + 400, new_height - 20, 100);

    createHorizontalLineSeparator(doc, x_start, new_height, 481);

    createHorizontalLineSeparator(doc, x_start + 125, new_height + 20, 331);

    createHorizontalLineSeparator(doc, x_start, new_height + 40, 481);

    createHorizontalLineSeparator(doc, x_start + 125, new_height + 60, 331);

    doc
        .fillColor("#353841")
        .fontSize(10)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Bi-Horário", x_start + 125, new_height - 17, { align: "left" })
        .text("Baixa Tensão", x_start + 325, new_height - 17, { align: "left" })
        .text("Média Tensão", x_start + 405, new_height - 17, { align: "left" });

    doc
        .fillColor("#353841")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Tarifa de energia", x_start + 5, new_height + 12, { align: "left" })
        .text("Tarifa de acesso às redes", x_start + 5, new_height + 54, { align: "left" })

        .text("08:00 - 22:00  Fora do vazio", x_start + 125, new_height + 4, { align: "left" })
        .text("22:00 - 08:00  Vazio", x_start + 125, new_height + 24, { align: "left" })

        .text("08:00 - 22:00  Fora do vazio", x_start + 125, new_height + 44, { align: "left" })
        .text("22:00 - 08:00  Vazio", x_start + 125, new_height + 64, { align: "left" })

        .text(`${unitPricesSummary.unitPriceCEMEOutEmptyBT} €/kWh`, x_start + 325, new_height + 4, { align: "left" })
        .text(`${unitPricesSummary.unitPriceCEMEEmptyBT} €/kWh`, x_start + 325, new_height + 24, { align: "left" })
        .text(`${unitPricesSummary.unitPriceTAROutEmptyBT} €/kWh`, x_start + 325, new_height + 44, { align: "left" })
        .text(`${unitPricesSummary.unitPriceTAREmptyBT} €/kWh`, x_start + 325, new_height + 64, { align: "left" })

        .text(`${unitPricesSummary.unitPriceCEMEOutEmptyMT} €/kWh`, x_start + 405, new_height + 4, { align: "left" })
        .text(`${unitPricesSummary.unitPriceCEMEEmptyMT} €/kWh`, x_start + 405, new_height + 24, { align: "left" })
        .text(`${unitPricesSummary.unitPriceTAROutEmptyMT} €/kWh`, x_start + 405, new_height + 44, { align: "left" })
        .text(`${unitPricesSummary.unitPriceTAREmptyMT} €/kWh`, x_start + 405, new_height + 64, { align: "left" });

    doc
        .fillColor("#8E96AE")
        .fontSize(9.5)
        .font('assets/fonts/Nunito.ttf')
        .text("Tarifa de ativação = " + activationFeeAdHoc + " € por sessão ou " + activationFee + " € se for através da carteira",
            x_start + 5, new_height + 84, { align: "left" })
        .text("Apoio Público = " + "0" + " € por sessão", x_start + 5, new_height + 98,
            { align: "left" });;

}

function addLocationsTable(doc, y, summaryAddress, unitPricesSummary, addUnitPriceTable) {

    doc.fillColor("#353841")
        .fontSize(18)
        .font('assets/fonts/NunitoBold.ttf')
        .text(`Detalhes dos Postos de Carregamento`, 50, y, { align: "left" });

    let height = 28;

    doc
        .rect(50, y + 24, 330, height)
        .fillAndStroke('#71778a')
        .fill('#353841')
        .stroke();

    y = y + 32;
    let width = 110;
    let x = 50;

    doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Posto", x + width * 0, y, { width: width, align: "center" })
        .text("Cidade", x + width * 1, y, { width: width, align: "center" })
        .text("Tensão", x + width * 2, y, { width: width, align: "center" });

    locationsTableRows(doc, y + 20, summaryAddress, unitPricesSummary, addUnitPriceTable);

}

function locationsTableRows(doc, height, summaryAddress, unitPricesSummary, addUnitPriceTable) {

    let data = summaryAddress;
    let row_height = 24;
    let nextPageLength = 530;

    data.forEach(line => {

        //Cria nova página se necessário 
        if (height > nextPageLength) {
            height = addNewLocationsTableRowsPage(doc);
            if (addUnitPriceTable == false) {
                addUnitPricesTable(doc, 25, unitPricesSummary);
                addUnitPriceTable = true;
            }
        }

        let y = height + (row_height / 2) - 6;
        locationsTableRow(doc, line, y, height, row_height);
        height += row_height;
        row_height = 24;

    });

    //Add new unit table if is not added yet
    if (addUnitPriceTable == false) {
        doc.addPage({
            size: 'legal',
            layout: 'landscape',
            margin: 10
        });

        addUnitPricesTable(doc, 25, unitPricesSummary);
        addUnitPriceTable = true;

        //reset page height
        height = 10;
    }

}

function locationsTableRow(doc, line, y, height, row_height) {

    let width = 110;
    let x = 50;

    doc
        .fillColor("#353841")
        .fontSize(9)
        .font('assets/fonts/Nunito.ttf')
        .text(`${line.hwId}`, x + width * 0, y, { width: width, align: "center" })
        .text(`${line.city}`, x + width * 1, y, { width: width, align: "center" })
        .text(`${line.voltageLevel}`, x + width * 2, y, { width: width, align: "center" });

    doc
        .strokeColor("#8e96ae")
        .lineWidth(0.1)
        .moveTo(x, height + row_height)
        .lineTo(330 + 50, height + row_height)
        .stroke();

}

function addNewLocationsTableRowsPage(doc) {

    doc.addPage({
        size: 'legal',
        layout: 'landscape',
        margin: 10
    });

    let resetPageHeight = 94;
    let height = 28;

    doc
        .rect(50, 65, 330, height)
        .fillAndStroke('#71778a')
        .fill('#353841')
        .stroke();

    let y = 62 + 11;
    let width = 110;
    let x = 50;

    doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Posto", x + width * 0, y, { width: width, align: "center" })
        .text("Cidade", x + width * 1, y, { width: width, align: "center" })
        .text("Tensão", x + width * 2, y, { width: width, align: "center" });

    return resetPageHeight;
}


function totalNextPage(doc) {

    doc.addPage({
        size: 'legal',
        layout: 'landscape',
        margin: 10
    });

    let resetPageHeight = 60;

    return resetPageHeight;
}

function checkRowHeight(line, rowHeight) {
    let x = 10;
    if (line.hwId) {
        if (line.hwId.length > 10) {
            let factor = Math.ceil(line.hwId.length / x);
            return rowHeight + (x * factor);
        }
        else {
            return rowHeight;
        }
    }
    else {
        return rowHeight;
    }
}

function checkRowHeightCityElement(element, rowHeight) {
    let x = 11;
    if (element !== undefined) {
        if (element.length > x) {
            let factor = Math.ceil(element.length / x);
            return rowHeight - ((x * factor)) + (x / 2) + 3 + (2 * factor);
        }
        else {
            return rowHeight;
        }
    }
    else {
        return rowHeight;
    }
}

function checkRowHeightChargerElement(element, rowHeight) {
    let x = 9;
    if (element !== undefined) {
        if (element.length > x) {
            let factor = Math.ceil(element.length / x);
            return rowHeight - ((x * factor)) + (x / 2) + 3 + (2 * factor);
        }
        else {
            return rowHeight;
        }
    }
    else {
        return rowHeight;
    }
}

function createLineSeparator(doc, x, y, add) {
    doc
        .strokeColor("#FFFFFF")
        .lineWidth(1.0)
        .moveTo(x, y)
        .lineTo(x, y + add)
        .stroke();
}

function createHorizontalLineSeparator(doc, x, y, add) {
    doc
        .strokeColor("#FFFFFF")
        .lineWidth(1.0)
        .moveTo(x, y)
        .lineTo(x + add, y)
        .stroke();
}


function addWhiteLabelNetworkRow(invoice, lines, doc, invoiceTableTop, invoiceTableTopText) {
    const context = "Function addWhiteLabelNetworkRow"
    try {
        if (invoice.clientName === process.env.WhiteLabelGoCharge) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços na rede Go.Charge", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.goCharge_network.total_exc_vat)
                    } `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.goCharge_network.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else if (invoice.clientName === process.env.WhiteLabelHyundai) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços na rede Hyundai", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.hyundai_network.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.hyundai_network.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else if (invoice.clientName === process.env.WhiteLabelKLC) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços na rede KLC", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.klc_network.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.klc_network.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else if (invoice.clientName === process.env.WhiteLabelKinto) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços na rede KINTO", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.kinto_network.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.kinto_network.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        }
    } catch (error) {
        console.error(`[${context}]Error `, error);
    }
}

function addServicesRow(invoice, lines, doc, invoiceTableTop, invoiceTableTopText) {
    const context = "Function addServicesRow"
    try {
        if (invoice.clientName === process.env.WhiteLabelGoCharge) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços Go.Charge", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else if (invoice.clientName === process.env.WhiteLabelHyundai) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços Hyundai", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else if (invoice.clientName === process.env.WhiteLabelKLC) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços KLC", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else if (invoice.clientName === process.env.WhiteLabelKinto) {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços KINTO", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });

        } else {
            doc
                .rect(75, invoiceTableTop, 490, 20)
                .fillAndStroke('#f1f5fe')
                .fill('#353841')
                .stroke();

            doc
                .fillColor("#353841")
                .fontSize(10)
                .font('assets/fonts/Nunito.ttf')
                .text("Serviços EVIO", 85, invoiceTableTopText)
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });
        }
    } catch (error) {
        console.error(`[${context}]Error `, error);
        doc
            .rect(75, invoiceTableTop, 490, 20)
            .fillAndStroke('#f1f5fe')
            .fill('#353841')
            .stroke();

        doc
            .fillColor("#353841")
            .fontSize(10)
            .font('assets/fonts/Nunito.ttf')
            .text("Serviços EVIO", 85, invoiceTableTopText)
            .text(`${checkExcVat(lines.evio_services.total_exc_vat)} `, 340, invoiceTableTopText, { width: 90, align: "center" })
            .text(`${checkVatValue(lines.evio_services.vat)} `, 470, invoiceTableTopText, { width: 90, align: "center" });
    }
}

function checkRowHeightElement(element, rowHeight) {
    let x = 10;
    if (element) {
        if (element.length > 10) {
            let factor = Math.ceil(element.length / x);
            return rowHeight - ((x * factor)) + (10 / 2) + 6 + (2 * factor);
        } else {
            return rowHeight;
        }
    } else {
        return rowHeight;
    }
}

function roundValue(value, decimals = 2) {
    if (value == 0 || value == undefined || value === '') {
        return "-";
    }
    else {
        return Number(value.toFixed(decimals))
    }
}
module.exports = UtilsMobiE;