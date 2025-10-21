const express = require('express');
const PDFDocument = require('pdfkit');
const addressS = require("../services/address")

var UtilsGireve = {
    createInvoicePDF(billingData, invoice, attach) {
        return new Promise((resolve, reject) => {
            try {

                let doc = new PDFDocument({ bufferPages: true, margin: 50 });

                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    let pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                generateHeader(doc, billingData);
                generateInvoiceSummary(doc, invoice, attach);

                doc.end();
            }
            catch (error) {
                console.error(`[] Error `, error);
                reject(error.message);
            };
        });
    }
}

function generateHeader(doc, billingData) {

    let address = addressS.parseAddressToString(billingData.billingAddress)

    doc
        .image("assets/images/evio.png", 50, 45, { width: 70, height: 20 })
        .fillColor("#353841")
        .font('assets/fonts/Nunito.ttf')
        .fontSize(10)

        .text("Av. Dom Afonso Henriques 1825 4450-017 Matosinhos", 50, 80)
        .text("Portugal", 50, 95)
        .text("T. +351 220 164 800", 50, 110)
        .text("support@go-evio.com", 50, 125)

        .text(`${billingData.billingName}`, 200, 150, { align: "right" })
        .text(address, 200, 165, { align: "right" })
}

function generateInvoiceSummary(doc, invoice, attach) {
    doc
        .fillColor("#353841")
        .fontSize(20)
        .font('assets/fonts/NunitoBold.ttf')
        .text(`Anexo - Resumo da FATURA ${invoice.documentNumber}`, 50, 195 /*200*/);

    doc
        .rect(50, 230, 515, 80)
        .fillAndStroke('#f1f5fe')
        .fill('#353841')
        .stroke()
        .fontSize(12)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Resumo de Sessões de Carregamento", 65, 240, { lineBreak: false });

    let header = attach.chargingSessions.header;

    doc
        .fontSize(11)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Sessões", 90, 268, { align: "left" })
        .font('assets/fonts/Nunito.ttf')
        .text(header.sessions, 90, 286, { align: "left" })

        .font('assets/fonts/NunitoBold.ttf')
        .text("Tempo de carregamento", 240, 268, { align: "left" })
        .font('assets/fonts/Nunito.ttf')
        .text(header.totalTime, 240, 286, { align: "left" })

        .font('assets/fonts/NunitoBold.ttf')
        .text("Energia", 460, 268, { align: "left" })
        .font('assets/fonts/Nunito.ttf')
        .text(header.totalEnergy, 460, 286, { align: "left" });

    summaryTableHeader(doc, attach);
}

function summaryTableHeader(doc, attach) {

    let height = 36;

    doc
        .rect(50, 310, 515, height)
        .fillAndStroke('#71778a')
        .fill('#353841')
        .stroke();

    let y = 322;
    let width = 51.5;
    let x = 50
    doc
        .fillColor("#FFFFFF")
        .fontSize(11)
        .font('assets/fonts/Nunito.ttf')
        .text("Data", x + width * 0, y, { width: width, align: "center" })
        .text("Início", x + width * 1, y, { width: width, align: "center" })
        .text("Duração", x + width * 2, y, { width: width, align: "center" })
        .text("País", x + width * 3, y, { width: width, align: "center" })
        .text("Posto", x + width * 4, y, { width: width, align: "center" })
        .text("Rede", x + width * 5, y, { width: width, align: "center" })
        .text("Tempo (€)", x + width * 6, y, { width: width, align: "center" })
        .text("Energia (€)", x + width * 7, y - 9, { width: width, align: "center" })
        .text("Flat (€)", x + width * 8, y, { width: width, align: "center" })
        .text("Total S/IVA", x + width * 9, y - 9, { width: width, align: "center" });

    summaryTableRows(doc, attach, 346);
}

function summaryTableRows(doc, attach, height) {

    let data = attach.chargingSessions.lines;
    let row_height = 30;

    data.forEach(line => {

        //Cria nova página se necessário 
        /*if (height > 515) {
            height = addNewSummaryPage(doc);
        }*/

        row_height = checkRowHeight(line, row_height);

        let y = height + (row_height / 2) - 4;
        createSummaryTableRow(doc, line, y, height, row_height);
        height += row_height;
        row_height = 30;
    });

    let footer = attach.chargingSessions.footer;
    doc
        .fillColor("#353841")
        .font('assets/fonts/Nunito.ttf')
        .fontSize(12)
        .text("Sub-Total", 430, height + 10, { width: 90, align: "left" })
        .text(`${roundValue(footer.total_exc_vat)}€`, 470, height + 10, { width: 90, align: "right" })

        .font('assets/fonts/NunitoBold.ttf')
        .fontSize(13)
        .text("Total C/IVA", 430, height + 30, { width: 90, align: "left" })
        .text(`${roundValue(footer.total_inc_vat)}€`, 470, height + 30, { width: 90, align: "right" })
        .moveDown();

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

function createSummaryTableRow(doc, line, y, height, row_height) {

    let width = 51.5;
    let x = 50;

    doc.fillColor("#353841")
        .fontSize(9)
        .font('assets/fonts/Nunito.ttf')
        .text(`${checkRowContent(line.date)}`, x + width * 0, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.startTime)}`, x + width * 1, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.duration)}`, x + width * 2, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.country)}`, x + width * 3, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.hwId)}`, x + width * 4, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.partyId)}`, x + width * 5, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.timeCost)}`, x + width * 6, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.energyCost)}`, x + width * 7, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.flatCost)}`, x + width * 8, y, { width: width, align: "center" })
        .text(`${checkRowContent(line.total_exc_vat)}`, x + width * 9, y, { width: width, align: "center" });

    doc
        .strokeColor("#8e96ae")
        .lineWidth(0.1)
        .moveTo(x, height + row_height)
        .lineTo((x + width * 9) + width, height + row_height)
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

function roundValue(value, decimals = 2) {
    if (value == 0 || value == undefined || value === '') {
        return "-";
    }
    else {
        return Number(value.toFixed(decimals))
    }
}
module.exports = UtilsGireve;