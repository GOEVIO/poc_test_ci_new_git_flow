const PDFDocument = require('pdfkit');
var moment = require('moment');

const ParticularContract = {

    base64_encode: function (file) {
        // convert binary data to base64 encoded string
        return fs.readFileSync(file, { encoding: 'base64' })
    },

    createParticularContract: function (contractInfo, language) {
        var context = "createParticularContract";
        return new Promise((resolve, reject) => {
            try {

                let doc = new PDFDocument({ bufferPages: true, margin: 50 });

                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    let pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });


                switch (language) {
                    case "en":
                        enGeneratePage1(doc, contractInfo);
                        enGeneratePage2(doc, contractInfo);
                        enGeneratePage3(doc, contractInfo);
                        enGeneratePage4(doc);
                        enGeneratePage5(doc);
                        break;
                    case "es":
                        esGeneratePage1(doc, contractInfo);
                        esGeneratePage2(doc, contractInfo);
                        esGeneratePage3(doc, contractInfo);
                        esGeneratePage4(doc);
                        esGeneratePage5(doc);
                        break;
                    case "fr":
                        frGeneratePage1(doc, contractInfo);
                        frGeneratePage2(doc, contractInfo);
                        frGeneratePage3(doc, contractInfo);
                        frGeneratePage4(doc);
                        frGeneratePage5(doc);
                        break;
                    default:
                        generatePage1(doc, contractInfo);
                        generatePage2(doc, contractInfo);
                        generatePage3(doc, contractInfo);
                        generatePage4(doc);
                        generatePage5(doc);
                        break
                }
                doc.end();
            }
            catch (error) {
                console.error(`[] Error `, error);
                reject(error.message);
            };
        });
    }

}


//PT
function generatePage1(doc, contractInfo) {

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(16)
        .font('assets/fonts/NunitoBold.ttf')
        .text('CONTRATO', 260, 320)
        .text('FORNECIMENTO DE ELETRICIDADE PARA A', 135, 345)
        .text('MOBILIDADE ELÉTRICA NA REDE MOBI.E', 145, 365);

    doc
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Contracto n.º: ', 70, 650)
        .text('Data: ', 70, 670)

        .fontSize(12)
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, 156, 651)
        .text('' + moment().format('DD / MM / YYYY'), 106, 671);

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('1', 70, 728);

}

function generatePage2(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    let startHeight = 120;
    let increaseHeight = 20;
    let x1_limit = 75;
    let x2_limit = 465;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    //Comercializador

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Comercializador de eletricidade para a mobilidade elétrica", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Denominação social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIO - Electrical Mobility, Lda', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight * 3);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight * 3);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Sede Social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Avenida Dom Afonso Henriques,', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('nº 1825', x_middle + 5, startHeight - 2 + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('4450-017 MATOSINHOS', x_middle + 5, startHeight - 4 + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('NIPC e Matrícula na CRC: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('515681890', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Capital social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('€ 50.000,00', x_middle + 5, startHeight + 1);

    /*
    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Representada por: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Carlos Almeida', x_middle + 5, startHeight + 1);
    */
    //Cliente

    startHeight = startHeight + 50;

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Cliente", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Nome/Denominação social: ', x1_limit + 5, startHeight + 1);

    let heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Morada/Sede social: ', x1_limit + 5, startHeight + 1);

    let full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }
    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('NIF/NIPC e Matrícula na CRC: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.nif, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.nif, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Capital social: ', x1_limit + 5, startHeight + 1);

    let cc = "";
    heightIncrease = checkStringLength(cc, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(cc, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {

        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Representada por: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Com poderes e na qualidade de: ', x1_limit + 5, startHeight + 1);

    let power = "";
    heightIncrease = checkStringLength(power, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(power, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Email: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.email, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.email, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    let address_string = "Morada para envio de correspondência e cartões (se aplicável):      ";
    heightIncreaseMax = checkStringLength(address_string, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text(address_string, x1_limit + 5, startHeight + 1, { width: 230 });

    full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }

    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease <= heightIncreaseMax) {
        heightIncrease = heightIncreaseMax;
    }

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    // Warning
    /*doc
        .fontSize(11)
        .font('assets/fonts/Nunito.ttf')
        .text('© Copyright EVIO - Electrical Mobility, Lda. 2021', 70, 635)
        .text('Este documento é propriedade da EVIO - Electrical Mobility, Lda., não podendo ser reproduzido, modificado ou divulgado a terceiros,'
            + ' sob qualquer forma, sem o prévio consentimento expresso da EVIO - Electrical Mobility, Lda.', 70, 655)
        .text('Este documento e o seu conteúdo são confidenciais.', 70, 705)
    */
    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('2', 70, 728);

}

function generatePage3(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Condições particulares de fornecimento de eletricidade '
            + 'para a mobilidade elétrica na rede MOBI.E', 125, 115,
            { width: 370, align: "center" });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('O contrato é composto pelas presentes Condições Particulares, '
            + 'pelas Condições Gerais e pelas Condições de Utilização da Rede de Mobilidade Elétrica. '
            + 'As características comerciais associadas aos produtos contratados estão '
            + 'disponíveis para consulta em', 70, 170,
            { align: 'justify' });

    doc
        .text('https://www.gocharge.pt', 173, 223, {
            link: 'https://www.gocharge.pt',
            underline: true
        })
        .text(' .', 255, 223,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('1.   Modos de fornecimento', 70, 260,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.1.', 90, 285)
        .text('O fornecimento de eletricidade para a mobilidade elétrica será efetuado '
            + 'mediante o uso da plataforma GO CHARGE, disponível em https://www.gocharge.pt, '
            + 'mais bem identificada e nos termos previstos nas Condições Gerais, '
            + 'e/ou de cartões de carregamento GO CHARGE e/ou CAETANO GO.', 125, 285,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.2.', 90, 390)
        .text('Os cartões de carregamento ficarão ativos a partir da data comunicada '
            + 'pela Entidade Gestora da Rede de Mobilidade Elétrica (EGME) ao CEME. ', 125, 390,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('2.   Condições comerciais', 70, 460,
            { align: 'justify' });


    let startHeight = 490;
    let increaseHeight = 20;
    let x1_limit = 95;
    let x2_limit = 448;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('N.º ID do Contrato', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Ciclo horário', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Bi-horário diário', x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Plano contratado', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIODB', x_middle + 5, startHeight + 2);

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('3.   Preço', 70, 570,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.1.', 90, 595)
        .text('Pelo fornecimento de eletricidade para a mobilidade elétrica '
            + ' objeto do presente Contrato, o Cliente obriga-se a pagar um preço global, em '
            + 'euros, que corresponde ao somatório dos valores resultantes da aplicação '
            + 'das componentes constantes dos números seguintes.', 125, 595,
            { align: 'justify' });



    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('3', 70, 728);

}

function generatePage4(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.2.', 90, 115)

        .text('Poderá  consultar  em ', 125, 115,
            { align: 'justify' })

        .text('https://ceme.go-evio.com/pt/site-ceme', 258, 115, {
            link: 'https://ceme.go-evio.com/pt/site-ceme',
            underline: true
        })

        .text(',  o  preço', 485, 115,
            { align: 'justify' })

        .text('da energia elétrica acordado para o presente Contrato ao qual '
            + 'acresce uma tarifa de ativação por cada carregamento. '
            + 'A estes montantes incide IVA à taxa legal em vigor.', 125, 133,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.3.', 90, 195)
        .text('Ao preço previsto em 3.2 serão somados os custos correspondentes (i) à remuneração '
            + 'devida a cada operador de ponto de carregamento (OPC) pelo acesso ao respetivo '
            + 'ponto (a qual pode variar entre os diferentes pontos de carregamento e que é divulgada '
            + 'ao Cliente em cada ponto de carregamento pelo respetivo OPC), (ii) às tarifas de acesso à rede '
            + 'de mobilidade elétrica em vigor aprovadas pela Entidade Reguladora dos Serviços Energéticos (ERSE), (iii) às tarifas '
            + 'da EGME aplicáveis aos OPC ou aos DPC, fixadas pela ERSE e (iv) outros impostos, taxas, encargos ou contribuições '
            + 'legalmente aplicáveis ao fornecimento de eletricidade para a mobilidade elétrica no momento da emissão '
            + 'da fatura.', 125, 195,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.4.', 90, 400)
        .text('A EVIO tem a faculdade de introduzir alterações no preço a pagar pelo Cliente, mediante prévia comunicação '
            + 'nos termos previstos nas Condições Gerais, nas seguintes situações:', 125, 400,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('a)', 125, 465)
        .font('assets/fonts/Nunito.ttf')
        .text('Alterações aprovadas pela ERSE nas tarifas de acesso às redes de energia elétrica para a mobilidade elétrica '
            + 'ou nas tarifas da EGME aplicáveis aos CEME e/ou aos OPC, quer seja ao seu valor ou à própria estrutura tarifária, '
            + 'nomeadamente pela sua recomposição ou introdução de novos componentes.', 140, 465,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('b)', 125, 565)
        .font('assets/fonts/Nunito.ttf')
        .text('Alteração dos custos de aquisição de energia elétrica.', 140, 565,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.5.', 90, 605)
        .text('A emissão de cartão digitais é gratuita. A GO CHARGE reserva-se ao direito de cobrar pela remissão de cartão físicos, '
            + 'incluindo o respetivo envio,  um custo de até 5€ por cartão. A GO CHARGE oferece o primeiro cartão físico para '
            + 'cada um dos veículos.', 125, 605,
            { align: 'justify' });



    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('4', 70, 728);

}

function generatePage5(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('4.   Modalidade de pagamento e faturação', 70, 115,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.1.', 90, 140)
        .text('As faturas são emitidas com o pagamento e de forma eletrónica para o endereço de e-mail indicado pelo Cliente '
            + 'nas presentes Condições Particulares.', 125, 140,
            { align: 'justify' });


    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.2.', 90, 205)
        .text('O pagamento será realizado após a utilização do serviço e após a '
            + 'recepção dos dados por parte MOBI.E.', 125, 205,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('5.   Duração do Contrato', 70, 270,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.1.', 90, 295)
        .text('O presente Contrato tem a duração de 12 meses, contados a partir da data de adesão do Cliente, '
            + 'efetivada através da subscrição das presentes Condições Particulares, sendo automática e sucessivamente '
            + 'renovado por iguais períodos caso nem o Cliente nem a EVIO se oponha à renovação, através de notificação '
            + 'escrita enviada à outra Parte, com uma antecedência mínima de 30 (trinta) dias relativamente à data do seu '
            + 'termo inicial ou de qualquer uma das suas renovações.', 125, 295,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.2.', 90, 445)
        .text('As Condições Gerais estabelecem as demais formas de cessação do contrato.',
            125, 445, { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('5', 70, 728);

}

//EN
function enGeneratePage1(doc, contractInfo) {

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(16)
        .font('assets/fonts/NunitoBold.ttf')
        .text('CONTRACT', 260, 320)
        .text('ELECTRICITY SUPPLY FOR ELECTRIC', 160, 345)
        .text('MOBILITY ON THE MOBI.E NETWORK', 155, 365);

    doc
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Contract no: ', 70, 650)
        .text('Date: ', 70, 670)

        .fontSize(12)
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, 156, 651)
        .text('' + moment().format('DD / MM / YYYY'), 106, 671);

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('1', 70, 728);

}

function enGeneratePage2(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    let startHeight = 120;
    let increaseHeight = 20;
    let x1_limit = 75;
    let x2_limit = 465;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    //Comercializador

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Electricity supplier for electric mobility", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Name / Corporate name: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIO - Electrical Mobility, Lda', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight * 3);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight * 3);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Head office: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Avenida Dom Afonso Henriques,', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('nº 1825', x_middle + 5, startHeight - 2 + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('4450-017 MATOSINHOS', x_middle + 5, startHeight - 4 + 1);

    startHeight = startHeight + increaseHeight;

    addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Individual/Corporate Taxpayer no. ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('515681890', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('and CRC Registration: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text("", x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Share capital: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('€ 50.000,00', x_middle + 5, startHeight + 1);


    //Cliente

    startHeight = startHeight + 50;

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Cliente", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Name / Corporate name: ', x1_limit + 5, startHeight + 1);

    let heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Address/ Head Office: ', x1_limit + 5, startHeight + 1);

    let full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }

    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Individual/Corporate Taxpayer no. ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.nif, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.nif, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('and CRC Registration: ', x1_limit + 5, startHeight + 1);

    let nif = ""
    heightIncrease = checkStringLength(nif, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(nif, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Share capital: ', x1_limit + 5, startHeight + 1);

    let cc = "";
    heightIncrease = checkStringLength(cc, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(cc, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {

        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Represented by: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.name, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Empowered by and in the capacity of: ', x1_limit + 5, startHeight + 1);

    let power = "";
    heightIncrease = checkStringLength(power, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(power, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Email: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.email, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.email, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    let address_string = "Address for correspondence and cards (if applicable):      ";
    heightIncreaseMax = checkStringLength(address_string, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text(address_string, x1_limit + 5, startHeight + 1, { width: 230 });

    full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }

    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease <= heightIncreaseMax) {
        heightIncrease = heightIncreaseMax;
    }

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    // Warning
    /*doc
        .fontSize(11)
        .font('assets/fonts/Nunito.ttf')
        .text('© Copyright EVIO - Electrical Mobility, Lda. 2021', 70, 635)
        .text('Este documento é propriedade da EVIO - Electrical Mobility, Lda., não podendo ser reproduzido, modificado ou divulgado a terceiros,'
            + ' sob qualquer forma, sem o prévio consentimento expresso da EVIO - Electrical Mobility, Lda.', 70, 655)
        .text('Este documento e o seu conteúdo são confidenciais.', 70, 705)
    */
    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('2', 70, 728);

}

function enGeneratePage3(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Particular conditions for electricity supply '
            + 'for electric mobility in the MOBI.E network', 125, 115,
            { width: 370, align: "center" });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('The contract is composed of the present Particular Conditions, '
            + 'the General Conditions, and the Conditions of Use of the Electric Mobility Network. '
            + 'The commercial characteristics associated to the contracted products are '
            + 'available for consultation at ', 70, 170,
            { align: 'justify' });

    doc
        .text('https://www.gocharge.pt', 173, 223, {
            link: 'https://www.gocharge.pt',
            underline: true
        })
        .text(' .', 255, 223,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('1.   Delivery modes', 70, 260,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.1.', 90, 285)
        .text('The supply of electricity for electric mobility will be carried out '
            + 'through the use of the GO CHARGE platform, available on https://www.gocharge.pt, '
            + 'better identified and in the terms provided in the General Conditions, '
            + 'and/or GO CHARGE and/or CAETANO GO recharging cards.', 125, 285,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.2.', 90, 390)
        .text('Charging cards will become active from the date communicated '
            + 'by the Electric Mobility Network Management Entity (EGME) to the CEME. ', 125, 390,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('2.   Commercial conditions', 70, 460,
            { align: 'justify' });


    let startHeight = 490;
    let increaseHeight = 20;
    let x1_limit = 95;
    let x2_limit = 448;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Contract ID No.', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Time cycle', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Bi-horário diário', x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Contracted plan', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIODB', x_middle + 5, startHeight + 2);

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('3.   Price', 70, 570,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.1.', 90, 595)
        .text('For the supply of electricity for electric mobility, '
            + 'object of the present Contract, the Customer undertakes to pay a global price, in '
            + 'euros, which corresponds to the sum of the values resulting from the application '
            + 'of the components of the following numbers.', 125, 595,
            { align: 'justify' });



    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('3', 70, 728);

}

function enGeneratePage4(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.2.', 90, 115)

        .text('You can consult on ', 125, 115,
            { align: 'justify' })

        .text('https://ceme.go-evio.com/pt/site-ceme', 258, 115, {
            link: 'https://ceme.go-evio.com/pt/site-ceme',
            underline: true
        })

        .text(', the price', 485, 115,
            { align: 'justify' })

        .text('of electricity agreed for the present Contract to which '
            + 'an activation fee for each charge is added. '
            + 'These amounts are subject to VAT at the legal rate in force.', 125, 133,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.3.', 90, 195)
        .text('The price referred to in 3.2, the costs corresponding to (i) the remuneration '
            + 'due to each recharging point operator (OPC) for access to the respective '
            + 'point (which may vary between the different recharging points and which is disclosed '
            + 'to the Customer at each recharging point by the respective OPC) will be added (ii) the electric mobility network access '
            + 'tariffs in force approved by the Energy Services Regulatory Authority (ERSE), (iii) the EGME '
            + 'tariffs applicable to OPCs or DPCs, set by ERSE and (iv) other taxes, fees, charges or contributions '
            + 'legally applicable to the supply of electricity for electric mobility at the time of issuing '
            + 'the invoice.', 125, 195,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.4.', 90, 400)
        .text('EVIO may introduce changes in the price to be paid by the Customer, '
            + 'subject to prior notice as provided in the General Conditions, in the following situations:', 125, 400,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('a)', 125, 465)
        .font('assets/fonts/Nunito.ttf')
        .text('Changes approved by ERSE in the tariffs for access to the electric energy networks for electric mobility '
            + 'or in the EGME tariffs applicable to CEME and/or OPC, either in their value or in the tariff structure itself, '
            + 'namely by their recomposition or introduction of new components;', 140, 465,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('b)', 125, 565)
        .font('assets/fonts/Nunito.ttf')
        .text('Change in the electric energy acquisition costs.', 140, 565,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.5.', 90, 605)
        .text('The issuance of digital cards is free. GO CHARGE reserves the right to charge a fee of up to 5 euros per '
            + 'card for the issuance of physical cards, including shipping. GO CHARGE offers the first physical card '
            + 'for each vehicle.', 125, 605,
            { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('4', 70, 728);

}

function enGeneratePage5(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('4.   Method of payment and invoicing', 70, 115,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.1.', 90, 140)
        .text('Invoices are issued with the payment and electronically to the e-mail address indicated by the Customer '
            + 'in these Special Conditions.', 125, 140,
            { align: 'justify' });


    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.2.', 90, 205)
        .text('Payment shall be made after the service has been used and after '
            + 'MOBI.E. has received the data.', 125, 205,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('5.   Duration of the contract', 70, 270,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.1.', 90, 295)
        .text('This Agreement shall be valid for a period of 12 months from the date of the Customer\'s '
            + 'subscription to these Particular Conditions and shall be automatically and successively '
            + 'renewed for equal periods if neither the Customer nor EVIO objects to the renewal by written notice '
            + 'to the other Party at least thirty (30) days prior to the date of its '
            + 'initial term or any of its renewals.', 125, 295,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.2.', 90, 445)
        .text('The General Conditions set out the other forms of termination of the contract.',
            125, 445, { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('5', 70, 728);

}

//ES
function esGeneratePage1(doc, contractInfo) {

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(16)
        .font('assets/fonts/NunitoBold.ttf')
        .text('CONTRATO', 260, 320)
        .text('SUMINISTRO DE ELECTRICIDAD PARA LA', 145, 345)
        .text('MOVILIDAD ELÉCTRICA EN LA RED MOBI.E', 140, 365);

    doc
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Contrato n.º: ', 70, 650)
        .text('Fecha: ', 70, 670)

        .fontSize(12)
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, 156, 651)
        .text('' + moment().format('DD / MM / YYYY'), 115, 671);

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('1', 70, 728);

}

function esGeneratePage2(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    let startHeight = 120;
    let increaseHeight = 20;
    let x1_limit = 75;
    let x2_limit = 465;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    //Comercializador

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Proveedor de electricidad para la movilidad eléctrica", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Nombre / Denominación social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIO - Electrical Mobility, Lda', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight * 3);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight * 3);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Sede central: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Avenida Dom Afonso Henriques,', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('nº 1825', x_middle + 5, startHeight - 2 + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('4450-017 MATOSINHOS', x_middle + 5, startHeight - 4 + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Registro TIN/NIPC y CRC: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('515681890', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Capital social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('€ 50.000,00', x_middle + 5, startHeight + 1);

    /*
    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Representada por: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Carlos Almeida', x_middle + 5, startHeight + 1);
    */

    //Cliente

    startHeight = startHeight + 50;

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Cliente", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Nombre / Denominación social: ', x1_limit + 5, startHeight + 1);

    let heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Dirección/ sede social: ', x1_limit + 5, startHeight + 1);

    let full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }
    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Registro NIF/IPC y CRC: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.nif, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.nif, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Capital social: ', x1_limit + 5, startHeight + 1);

    let cc = "";
    heightIncrease = checkStringLength(cc, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(cc, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {

        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Representado por: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Con el poder de y en la capacidad de: ', x1_limit + 5, startHeight + 1);

    let power = "";
    heightIncrease = checkStringLength(power, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(power, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Email: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.email, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.email, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    let address_string = "Dirección para la correspondencia y las tarjetas (si procede):      ";
    heightIncreaseMax = checkStringLength(address_string, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text(address_string, x1_limit + 5, startHeight + 1, { width: 230 });

    full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }

    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease <= heightIncreaseMax) {
        heightIncrease = heightIncreaseMax;
    }

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    // Warning
    /*doc
        .fontSize(11)
        .font('assets/fonts/Nunito.ttf')
        .text('© Copyright EVIO - Electrical Mobility, Lda. 2021', 70, 635)
        .text('Este documento é propriedade da EVIO - Electrical Mobility, Lda., não podendo ser reproduzido, modificado ou divulgado a terceiros,'
            + ' sob qualquer forma, sem o prévio consentimento expresso da EVIO - Electrical Mobility, Lda.', 70, 655)
        .text('Este documento e o seu conteúdo são confidenciais.', 70, 705)
    */
    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('2', 70, 728);

}

function esGeneratePage3(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Condiciones particulares del suministro de electricidad '
            + 'para la movilidad eléctrica en la red MOBI.E', 125, 115,
            { width: 370, align: "center" });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('El contrato se compone de las presentes Condiciones Particulares, '
            + 'las Condiciones Generales y las Condiciones de Uso de la Red de Movilidad Eléctrica. '
            + 'Las características comerciales asociadas a los productos contratados están '
            + 'disponibles para su consulta en', 70, 170,
            { align: 'justify' });

    doc
        .text('https://www.gocharge.pt', 290, 223, {
            link: 'https://www.gocharge.pt',
            underline: true
        })
        .text(' .', 255, 223,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('1.   Modos de entrega', 70, 260,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.1.', 90, 285)
        .text('El suministro de electricidad para la movilidad eléctrica se realizará '
            + 'mediante el uso de la plataforma GO CHARGE, disponible en https://www.gocharge.pt, '
            + 'mejor identificada y en los términos previstos en las Condiciones Generales, '
            + 'y/o las tarjetas de recarga GO CHARGE y/o CAETANO GO.', 125, 285,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.2.', 90, 390)
        .text('Las tarjetas de recarga se activarán a partir de la fecha comunicada '
            + 'por la Entidad Gestora de la Red de Movilidad Eléctrica (EMGE) al EMC. ', 125, 390,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('2.   Condiciones comerciales', 70, 460,
            { align: 'justify' });


    let startHeight = 490;
    let increaseHeight = 20;
    let x1_limit = 95;
    let x2_limit = 448;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Número de identificación del contrato', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Ciclo de tiempo', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Bi-horário diário', x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Plan contratado', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIODB', x_middle + 5, startHeight + 2);

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('3.   Precio', 70, 570,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.1.', 90, 595)
        .text('Por el suministro de electricidad para la movilidad eléctrica, '
            + 'objeto del presente Contrato, el Cliente se compromete a pagar un precio global, en '
            + 'euros, que corresponde a la suma de los valores resultantes de la aplicación '
            + 'de los componentes de los números siguientes.', 125, 595,
            { align: 'justify' });



    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('3', 70, 728);

}

function esGeneratePage4(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.2.', 90, 115)

        .text('Puede consultar en ', 125, 115,
            { align: 'justify' })

        .text('https://ceme.go-evio.com/pt/site-ceme', 240, 115, {
            link: 'https://ceme.go-evio.com/pt/site-ceme',
            underline: true
        })

        .text(', el precio ', 465, 115,
            { align: 'justify' })

        .text('de la electricidad acordado para el presente Contrato al que '
            + 'se añade una cuota de activación por cada cargo. '
            + 'Estos importes están sujetos al IVA al tipo legal vigente.', 125, 133,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.3.', 90, 195)
        .text('El precio mencionado en el punto 3.2, se añadirán los costes correspondientes a (i) la remuneración '
            + 'debida a cada operador de punto de recarga (OPC) por el acceso al punto '
            + 'respectivo (que puede variar entre los distintos puntos de recarga y que es comunicada '
            + 'al Cliente en cada punto de recarga por el OPC respectivo) (ii) las tarifas de acceso a la red '
            + 'de movilidad eléctrica vigentes aprobadas por la Autoridad Reguladora de los Servicios Energéticos (ERSE), (iii) las tarifas '
            + 'del EGME aplicables a los OPC o CPD, fijadas por ERSE y (iv) otros impuestos, tasas, cánones o contribuciones '
            + 'legalmente aplicables al suministro de electricidad para la movilidad eléctrica en el momento de la emisión de '
            + 'la factura.', 125, 195,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.4.', 90, 400)
        .text('EVIO podrá introducir cambios en el precio a pagar por el Cliente, previo aviso '
            + 'según lo previsto en las Condiciones Generales, en las siguientes situaciones:', 125, 400,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('a)', 125, 465)
        .font('assets/fonts/Nunito.ttf')
        .text('Cambios aprobados por ERSE en las tarifas de acceso a las redes de energía eléctrica para la movilidad eléctrica '
            + 'o en las tarifas EGME aplicables a CEME y/u OPC, ya sea en su valor o en la propia estructura tarifaria, '
            + 'concretamente por su recomposición o introducción de nuevos componentes;', 140, 465,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('b)', 125, 565)
        .font('assets/fonts/Nunito.ttf')
        .text('Cambio en los costes de adquisición de energía eléctrica.', 140, 565,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.5.', 90, 605)
        .text('La emisión de tarjetas digitales es gratuita. GO CHARGE se reserva el derecho de cobrar una tasa de hasta 5 euros por tarjeta '
            + 'para la emisión de tarjetas físicas, incluyendo el envío. GO CHARGE ofrece la primera tarjeta física '
            + 'para cada vehículo.', 125, 605,
            { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('4', 70, 728);

}

function esGeneratePage5(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('4.   Forma de pago y facturación', 70, 115,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.1.', 90, 140)
        .text('Las facturas se emiten con el pago y por vía electrónica a la dirección de correo electrónico indicada por el Cliente '
            + 'en estas Condiciones Particulares.', 125, 140,
            { align: 'justify' });


    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.2.', 90, 205)
        .text('El pago se realizará una vez utilizado el servicio y una '
            + 'vez que MOBI.E. haya recibido los datos.', 125, 205,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('5.   Duración del contrato', 70, 270,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.1.', 90, 295)
        .text('El presente Acuerdo tendrá una vigencia de 12 meses a partir de la fecha de '
            + 'suscripción de las presentes Condiciones Particulares por parte del Cliente y se renovará automática y sucesivamente '
            + 'por períodos iguales si ni el Cliente ni EVIO se oponen a la renovación mediante notificación '
            + 'escrita a la otra Parte con una antelación mínima de treinta (30) días a la fecha de su vigencia '
            + 'inicial o de cualquiera de sus renovaciones.', 125, 295,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.2.', 90, 445)
        .text('Las Condiciones Generales establecen las demás formas de resolución del contrato.',
            125, 445, { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('5', 70, 728);

}

//FR
function frGeneratePage1(doc, contractInfo) {

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(16)
        .font('assets/fonts/NunitoBold.ttf')
        .text('CONTRAT', 285, 320)
        .text('ALIMENTATION EN ÉLECTRICITÉ POUR LA', 160, 345)
        .text('MOBILITÉ ÉLECTRIQUE SUR LE RÉSEAU MOBI.E', 140, 365);

    doc
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Contrat n.º: ', 70, 650)
        .text('Date: ', 70, 670)

        .fontSize(12)
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, 156, 651)
        .text('' + moment().format('DD / MM / YYYY'), 106, 671);

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('1', 70, 728);

}

function frGeneratePage2(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    let startHeight = 120;
    let increaseHeight = 20;
    let x1_limit = 75;
    let x2_limit = 465;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    //Comercializador

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Fournisseur d'électricité pour la mobilité électrique", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Nom / Raison sociale: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIO - Electrical Mobility, Lda', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight * 3);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight * 3);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Siège social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Avenida Dom Afonso Henriques,', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('nº 1825', x_middle + 5, startHeight - 2 + 1);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('4450-017 MATOSINHOS', x_middle + 5, startHeight - 4 + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Enregistrement TIN/NIPC et CRC: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('515681890', x_middle + 5, startHeight + 1);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Le capital social: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('€ 50.000,00', x_middle + 5, startHeight + 1);

    /*
    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Representada por: ', x1_limit + 5, startHeight + 1);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Carlos Almeida', x_middle + 5, startHeight + 1);
    */

    //Cliente

    startHeight = startHeight + 50;

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#000000')
        .stroke()
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text("Cliente", x1_limit + 5, startHeight + 1, { lineBreak: false });

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);

    startHeight = startHeight + increaseHeight;

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Nom / Raison sociale: ', x1_limit + 5, startHeight + 1);

    let heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Adresse/siège social: ', x1_limit + 5, startHeight + 1);

    let full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }
    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Enregistrement TIN/NIPC et CRC: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.nif, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.nif, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Le capital social: ', x1_limit + 5, startHeight + 1);

    let cc = "";
    heightIncrease = checkStringLength(cc, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(cc, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {

        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Représenté par: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.name, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.name, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutBottom(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Habilitée par et en capacité de: ', x1_limit + 5, startHeight + 1);

    let power = "";
    heightIncrease = checkStringLength(power, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(power, x_middle + 5, startHeight + 1);

    if (heightIncrease === 0) {
        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLinesWithoutTop(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text('Email: ', x1_limit + 5, startHeight + 1);

    heightIncrease = checkStringLength(contractInfo.email, caracter_limit);
    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.email, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    let address_string = "Adresse pour la correspondance et les cartes (le cas échéant):      ";
    heightIncreaseMax = checkStringLength(address_string, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/NunitoBold.ttf')
        .text(address_string, x1_limit + 5, startHeight + 1, { width: 230 });

    full_address = "";
    if (contractInfo.address.street !== undefined) {
        full_address += contractInfo.address.street;
    }
    if (contractInfo.address.zipCode !== undefined) {
        full_address += " " + contractInfo.address.zipCode;
    }

    heightIncrease = checkStringLength(full_address, caracter_limit);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(full_address, x_middle + 5, startHeight + 1, { width: 230 });

    if (heightIncrease <= heightIncreaseMax) {
        heightIncrease = heightIncreaseMax;
    }

    if (heightIncrease === 0) {
        addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
        addLineSeparator(doc, x_middle, startHeight, increaseHeight);

        startHeight = startHeight + increaseHeight;
    }
    else {
        let dinamicHeight = increaseHeight + heightIncrease * increaseHeight;

        addLines(doc, x1_limit, startHeight, x2_limit, dinamicHeight);
        addLineSeparator(doc, x_middle, startHeight, dinamicHeight);

        startHeight = startHeight + dinamicHeight;
    }

    // Warning
    /*doc
        .fontSize(11)
        .font('assets/fonts/Nunito.ttf')
        .text('© Copyright EVIO - Electrical Mobility, Lda. 2021', 70, 635)
        .text('Este documento é propriedade da EVIO - Electrical Mobility, Lda., não podendo ser reproduzido, modificado ou divulgado a terceiros,'
            + ' sob qualquer forma, sem o prévio consentimento expresso da EVIO - Electrical Mobility, Lda.', 70, 655)
        .text('Este documento e o seu conteúdo são confidenciais.', 70, 705)
    */
    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('2', 70, 728);

}

function frGeneratePage3(doc, contractInfo) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 240, 50, { width: 175, height: 80 })

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('Conditions spécifiques de l\'approvisionnement en électricité '
            + 'pour la mobilité électrique dans le réseau MOBI.E', 125, 115,
            { width: 400, align: "center" });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('Le contrat est composé des présentes Conditions particulières, '
            + 'des Conditions générales et des Conditions d\'utilisation du réseau de mobilité électrique. '
            + 'Les caractéristiques commerciales associées aux produits sous contrat peuvent '
            + 'être consultées à l\'adresse', 70, 170,
            { align: 'justify' });

    doc
        .text('https://www.gocharge.pt.', 200, 223, {
            link: 'https://www.gocharge.pt',
            underline: true
        })
        .text(' .', 255, 223,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('1.   Les Modes de livraison', 70, 260,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.1.', 90, 285)
        .text('La fourniture d\'électricité pour la mobilité électrique s\'effectuera '
            + 'par l\'utilisation de la plateforme GO CHARGE, disponible sur https://www.gocharge.pt, '
            + 'mieux identifiée et dans les conditions prévues dans les Conditions Générales, '
            + 'et/ou des cartes de recharge GO CHARGE et/ou CAETANO GO.', 125, 285,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.2.', 90, 390)
        .text('Les cartes de recharge deviennent actives à partir de la date communiquée '
            + 'par l\'entité de gestion du réseau de mobilité électrique (EMGE) à l\'EMC. ', 125, 390,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('2.   Conditions commerciales', 70, 460,
            { align: 'justify' });


    let startHeight = 490;
    let increaseHeight = 20;
    let x1_limit = 95;
    let x2_limit = 448;
    let x_middle = x1_limit + (x2_limit / 2);
    let caracter_limit = 34;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('N° d\'identification du contrat', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text(contractInfo.contract_id, x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Cycle de temps', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Bi-horário diário', x_middle + 5, startHeight + 2);

    startHeight = startHeight + increaseHeight;

    addLines(doc, x1_limit, startHeight, x2_limit, increaseHeight);
    addLineSeparator(doc, x_middle, startHeight, increaseHeight);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('Plan contractuel', x1_limit + 5, startHeight + 2);

    doc
        .fontSize(13)
        .fill('#000000')
        .font('assets/fonts/Nunito.ttf')
        .text('EVIODB', x_middle + 5, startHeight + 2);

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('3.   Prix', 70, 570,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.1.', 90, 595)
        .text('Pour la fourniture d\'électricité destinée à la mobilité électrique,  '
            + 'objet du présent Contrat, le Client s\'engage à payer un prix global, en '
            + 'euros, qui correspond à la somme des valeurs résultant de l\'application '
            + 'des composantes des nombres suivants.', 125, 595,
            { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('3', 70, 728);

}

function frGeneratePage4(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.2.', 90, 115)

        .text('Vous pouvez consulter sur ', 125, 115,
            { align: 'justify' })

        .text('https://ceme.go-evio.com/pt/site-ceme', 280, 115, {
            link: 'https://ceme.go-evio.com/pt/site-ceme',
            underline: true
        })

        .text(', le ', 505, 115,
            { align: 'justify' })

        .text('prix de l\'électricité convenu pour le présent Contrat auquel '
            + 's\'ajoute une redevance d\'activation pour chaque charge. '
            + 'Ces montants sont soumis à la TVA au taux légal en vigueur.', 125, 133,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.3.', 90, 195)
        .text('Le prix visé au point 3.2, les coûts correspondant à (i) la rémunération '
            + 'due à chaque opérateur de point de recharge (OPC) pour l\'accès au point '
            + 'respectif (qui peut varier entre les différents points de recharge et qui est communiquée '
            + 'au Client à chaque point de recharge par l\'OPC respectif) seront additionnés (ii) les tarifs d\'accès au réseau '
            + 'de mobilité électrique en vigueur approuvés par l\'Autorité de régulation des services énergétiques (ERSE), (iii) les tarifs '
            + 'EGME applicables aux OPC ou DPC, fixés par l\'ERSE et (iv) les autres taxes, redevances, charges ou contributions '
            + 'légalement applicables à la fourniture d\'électricité pour la mobilité électrique au moment de l\'émission '
            + 'de la facture.', 125, 195,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.4.', 90, 400)
        .text('EVIO peut introduire des modifications du prix à payer par le Client, sous réserve '
            + 'du préavis prévu dans les Conditions Générales, dans les situations suivantes:', 125, 400,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('a)', 125, 465)
        .font('assets/fonts/Nunito.ttf')
        .text('Modifications approuvées par l\'ERSE des tarifs d\'accès aux réseaux d\'énergie électrique pour la mobilité électrique'
            + 'ou des tarifs EGME applicables aux CEME et/ou OPC, soit dans leur valeur, soit dans la structure tarifaire '
            + 'elle-même, notamment par leur recomposition ou l\'introduction de nouvelles composantes;', 140, 465,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('b)', 125, 565)
        .font('assets/fonts/Nunito.ttf')
        .text('Modification des coûts d\'acquisition de l\'énergie électrique.', 140, 565,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.5.', 90, 605)
        .text('L’émission de cartes numériques est gratuite. GO CHARGE se réserve le droit de facturer des frais allant jusqu\'à 5 euros  '
            + 'par carte pour l\'émission de cartes physiques, y compris les frais d\'expédition. GO CHARGE offre la première carte '
            + 'physique pour chaque véhicule.', 125, 605,
            { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('4', 70, 728);

}

function frGeneratePage5(doc) {

    doc.addPage({
        margins: {
            top: 50,
            bottom: 50,
            left: 70,
            right: 70
        }
    });

    doc
        .image("assets/images/sc.png", 235, 50, { width: 175, height: 80 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('4.   Mode de paiement et de facturation', 70, 115,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.1.', 90, 140)
        .text('Les factures sont émises avec le paiement et par voie électronique à l\'adresse électronique indiquée par le client '
            + 'dans les présentes conditions particulières.', 125, 140,
            { align: 'justify' });


    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.2.', 90, 205)
        .text('Le paiement sera effectué après l\'utilisation du service et après '
            + 'que MOBI.E. ait reçu les données.', 125, 205,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('5.   Durée du contrat', 70, 270,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.1.', 90, 295)
        .text('Le présent Contrat est valable pour une période de 12 mois à compter de la date de souscription '
            + 'par le Client aux présentes Conditions Particulières et sera automatiquement et successivement '
            + 'renouvelé pour des périodes égales si ni le Client ni EVIO ne s\'y oppose par notification '
            + 'écrite à l\'autre Partie au moins trente (30) jours avant la date de son terme '
            + 'initial ou de l\'un de ses renouvellements.', 125, 295,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.2.', 90, 425)
        .text('Les Conditions générales précisent les autres formes de résiliation du contrat.',
            125, 425, { align: 'justify' });

    doc
        .fontSize(10)
        .font('assets/fonts/Nunito.ttf')
        .text('5', 70, 728);

}

function addLines(doc, x, y, x2, height) {

    // 75 120 465 25
    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x, y + height)
        .stroke();

    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x2 + x, y)
        .lineTo(x2 + x, y + height)
        .stroke();

    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x2 + x, y)
        .stroke();

    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x, y + height)
        .lineTo(x2 + x, y + height)
        .stroke();

}

function addLinesWithoutBottom(doc, x, y, x2, height) {

    // 75 120 465 25
    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x, y + height)
        .stroke();

    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x2 + x, y)
        .lineTo(x2 + x, y + height)
        .stroke();

}

function addLinesWithoutTop(doc, x, y, x2, height) {

    // 75 120 465 25
    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x, y)
        .lineTo(x, y + height)
        .stroke();

    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(x2 + x, y)
        .lineTo(x2 + x, y + height)
        .stroke();

}

function addLineSeparator(doc, middle, y, height) {

    doc
        .strokeColor("#000000")
        .lineWidth(0.5)
        .moveTo(middle, y)
        .lineTo(middle, y + height)
        .stroke();

}

function checkStringLength(name, caracter_limit) {
    return Math.floor(name.length / caracter_limit);
}

module.exports = ParticularContract;