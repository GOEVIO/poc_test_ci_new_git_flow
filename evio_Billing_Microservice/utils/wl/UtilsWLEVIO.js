const express = require('express');
const PDFDocument = require('pdfkit');
const MapingWLEmail = require('../../models/MapingWLEmail.json');
const addressS = require("../../services/address")

var UtilsEVIO = {
    createInvoicePDF(billingData, invoice, attach, clientName) {
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

                sessionSummary(doc, attach, invoice);

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

        //Utilizar um endpoint para ir buscar o email de suporte para o clientName recebido

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

function sessionSummary(doc, attach, invoice) {
    doc.addPage({
        size: 'legal',
        layout: 'landscape',
        margin: 10
    });

    let summaryTitle = sessionSummaryTitle(invoice)
    doc.fillColor("#353841")
        .fontSize(20)
        .font('assets/fonts/NunitoBold.ttf')
        .text(`Anexo - ${summaryTitle}`, 50, 50, { align: "left" });

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
    let width = 56;
    let x = 20;

    doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Data", x + width * 0, y, { width: width, align: "center" })
        .text("Início", x + width * 1, y, { width: width, align: "center" })
        .text("Duração", x + width * 2, y, { width: width, align: "center" })
        .text("Cidade", x + width * 3, y, { width: width, align: "center" })
        .text("Posto", x + width * 4, y, { width: width, align: "center" })
        .text("Matricula", x + width * 5, y, { width: width, align: "center" })
        .text("Energia Consumida (kWh)", x + width * 6, y - 13, { width: width, align: "center" })
        .text("Duração Carregamento (min)", x + width * 7, y - 13, { width: width + 15, align: "center" })
        .text("Duração pós Carregamento (min)", x + width * 8 + 15, y - 13, { width: width + 15, align: "center" })
        .text("Tarifa por kWh (€)", x + width * 9 + 30, y - 13, { width: width - 15, align: "center" })
        .text("Tarifa por min (€)", x + width * 10 + 15, y - 13, { width: width - 15, align: "center" })
        .text("Tarifa de Ativação (€)", x + width * 11, y - 7, { width: width, align: "center" })
        //.text("Parque Em Carregamento (€)", x + width * 11, y - 13, { width: width + 20, align: "center" })
        .text("Tarifa Uso Carregamento (€/min)", x + width * 12, y - 13, { width: width + 20, align: "center" })
        //.text("Parque Pós Carregamento (€)", x + width * 12 + 20, y - 13, { width: width + 20, align: "center" })
        .text("Tarifa Uso pós Carregamento (€/min)", x + width * 13 + 20, y - 13, { width: width + 20, align: "center" })
        .text("Total s/IVA (€)", x + width * 14 + 40, y - 7, { width: width - 20, align: "center" })
        .text("IVA (%)", x + width * 15 + 30, y, { width: width - 20, align: "center" })
        .text("Total c/IVA (€)", x + width * 16 + 20, y - 7, { width: width - 20, align: "center" });

    summaryTableRows(doc, attach, 215);
}

function summaryTableRows(doc, attach, height) {

    let data = attach.chargingSessions.lines;
    let row_height = 30;
    let nextPageLength = 530;

    data.forEach(line => {
        //Cria nova página se necessário 
        if (height > nextPageLength) {
            height = addNewSummaryPage(doc);
        }

        row_height = checkRowHeight(line, row_height);

        let y = height + (row_height / 2) - 6;
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

}

function createSummaryTableRow(doc, line, y, height, row_height) {

    let width = 56;
    let x = 20;

    doc
        .fillColor("#353841")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text(`${checkRowContent(line.date)}`, x + width * 0, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.startTime)}`, x + width * 1, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.duration)}`, x + width * 2, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.city)}`, x + width * 3, checkRowHeightElement(line.city, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.hwId)}`, x + width * 4, checkRowHeightElement(line.hwId, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.licensePlate)}`, x + width * 5, checkRowHeightElement(line.licensePlate, y), { width: width, align: "center" })
        .text(`${checkRowContent(line.totalPower)}`, x + width * 6, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.charging_duration)}`, x + width * 7, y, { width: width + 15, align: "center" })
        .text(`${checkRowContent(line.after_charging_duration)}`, x + width * 8 + 15, y, { width: width + 15, align: "center" })
        .text(`${checkRowContent(line.use_energy)}`, x + width * 9 + 30, y, { width: width - 15, align: "center" })
        .text(`${checkRowContent(line.use_time)}`, x + width * 10 + 15, y, { width: width - 15, align: "center" })
        .text(`${checkRowContent(line.opcFlatCost)}`, x + width * 11, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.charging_parking)}`, x + width * 12, y, { width: width + 20, align: "center" })
        .text(`${checkRowContent(line.charging_after_parking)}`, x + width * 13 + 20, y, { width: width + 20, align: "center" })
        .text(`${checkRowContent(line.total_exc_vat)}`, x + width * 14 + 40, y, { width: width - 20, align: "center" })
        .text(`${checkRowContent(line.vat)}`, x + width * 15 + 30, y, { width: width - 20, align: "center" })
        .text(`${checkRowContent(line.total_inc_vat)}`, x + width * 16 + 20, y, { width: width - 20, align: "center" });

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
    let width = 56;

    doc
        .fillColor("#FFFFFF")
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text("Data", x + width * 0, y, { width: width, align: "center" })
        .text("Início", x + width * 1, y, { width: width, align: "center" })
        .text("Duração", x + width * 2, y, { width: width, align: "center" })
        .text("Cidade", x + width * 3, y, { width: width, align: "center" })
        .text("Posto", x + width * 4, y, { width: width, align: "center" })
        .text("Matricula", x + width * 5, y, { width: width, align: "center" })
        .text("Energia Consumida (kWh)", x + width * 6, y - 13, { width: width, align: "center" })
        .text("Duração Carregamento (min)", x + width * 7, y - 13, { width: width + 15, align: "center" })
        .text("Duração pós Carregamento (min)", x + width * 8 + 15, y - 13, { width: width + 15, align: "center" })
        .text("Tarifa por kWh (€)", x + width * 9 + 30, y - 13, { width: width - 15, align: "center" })
        .text("Tarifa por min (€)", x + width * 10 + 15, y - 13, { width: width - 15, align: "center" })
        .text("Tarifa de Ativação (€)", x + width * 11, y - 7, { width: width, align: "center" })
        .text("Tarifa Uso Carregamento (€/min)", x + width * 12, y - 13, { width: width + 20, align: "center" })
        .text("Tarifa Uso pós Carregamento (€/min)", x + width * 13 + 20, y - 13, { width: width + 20, align: "center" })
        .text("Total s/IVA (€)", x + width * 14 + 40, y - 7, { width: width - 20, align: "center" })
        .text("IVA (%)", x + width * 15 + 30, y, { width: width - 20, align: "center" })
        .text("Total c/IVA (€)", x + width * 16 + 20, y - 7, { width: width - 20, align: "center" });

    //createLineSeparator(doc, 65 + 67, 165, height);
    //createLineSeparator(doc, 134 + 67, 165, height);
    //createLineSeparator(doc, 201 + 67, 165, height);
    //createLineSeparator(doc, 269 + 67, 165, height);
    //createLineSeparator(doc, 337 + 67, 165, height);
    //createLineSeparator(doc, 405 + 67, 165, height);
    //createLineSeparator(doc, 473 + 67, 165, height);
    //createLineSeparator(doc, 541 + 67, 165, height);
    //createLineSeparator(doc, 609 + 67, 165, height);
    //createLineSeparator(doc, 677 + 67, 165, height);
    //createLineSeparator(doc, 745 + 67, 165, height);
    //createLineSeparator(doc, 813 + 67, 165, height);

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
    } else {
        return rowHeight;
    }
}

function checkRowHeightElement(element, rowHeight) {
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
                .text(`${checkExcVat(lines.goCharge_network.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.goCharge_network.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.hyundai_network.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.hyundai_network.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.klc_network.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.klc_network.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.kinto_network.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.kinto_network.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

        }
    } catch (error) {
        console.error(`[${context}] Error `, error);
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
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });

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
                .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
                .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });
        }
    } catch (error) {
        console.error(`[${context}] Error `, error);
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
            .text(`${checkExcVat(lines.evio_services.total_exc_vat)}`, 340, invoiceTableTopText, { width: 90, align: "center" })
            .text(`${checkVatValue(lines.evio_services.vat)}`, 470, invoiceTableTopText, { width: 90, align: "center" });
    }
}

function sessionSummaryTitle(invoice) {
    try {
        if (invoice.clientName === process.env.WhiteLabelGoCharge) {
            if (invoice.chargerType === process.env.chargerTypeGoCharge) {
                return 'Detalhes de serviços na rede Go.Charge'
            } else if (invoice.chargerType === process.env.chargerTypeHyundai || invoice.chargerType === process.env.chargerTypeKLC || invoice.chargerType === process.env.chargerTypeKinto) {
                return 'Detalhes de serviços em outras redes'
            } else {
                return 'Detalhes de serviços na rede EVIO'
            }
        } else if (invoice.clientName === process.env.WhiteLabelHyundai) {
            if (invoice.chargerType === process.env.chargerTypeHyundai) {
                return 'Detalhes de serviços na rede Hyundai'
            } else if (invoice.chargerType === process.env.chargerTypeGoCharge || invoice.chargerType === process.env.chargerTypeKLC || invoice.chargerType === process.env.chargerTypeKinto) {
                return 'Detalhes de serviços em outras redes'
            } else {
                return 'Detalhes de serviços na rede EVIO'
            }
        } else if (invoice.clientName === process.env.WhiteLabelKLC) {
            if (invoice.chargerType === process.env.chargerTypeKLC) {
                return 'Detalhes de serviços na rede KLC'
            } else if (invoice.chargerType === process.env.chargerTypeGoCharge || invoice.chargerType === process.env.chargerTypeHyundai || invoice.chargerType === process.env.chargerTypeKinto) {
                return 'Detalhes de serviços em outras redes'
            } else {
                return 'Detalhes de serviços na rede EVIO'
            }
        } else if (invoice.clientName === process.env.WhiteLabelKinto) {
            if (invoice.chargerType === process.env.chargerTypeKinto) {
                return 'Detalhes de serviços na rede KINTO'
            } else if (invoice.chargerType === process.env.chargerTypeGoCharge || invoice.chargerType === process.env.chargerTypeHyundai || invoice.chargerType === process.env.chargerTypeKLC) {
                return 'Detalhes de serviços em outras redes'
            } else {
                return 'Detalhes de serviços na rede EVIO'
            }
        } else {
            return 'Detalhes de serviços na rede EVIO'
        }
    } catch (error) {
        return 'Detalhes de serviços na rede EVIO'
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
module.exports = UtilsEVIO;