const PDFDocument = require('pdfkit');
var moment = require('moment');

const ParticularContract = {

    base64_encode: function (file) {
        // convert binary data to base64 encoded string
        return fs.readFileSync(file, { encoding: 'base64' })
    },

    createParticularContract: function (contractInfo) {
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

                generatePage1(doc, contractInfo);
                generatePage2(doc, contractInfo);
                generatePage3(doc, contractInfo);
                generatePage4(doc);
                generatePage5(doc);

                doc.end();
            }
            catch (error) {
                console.error(`[] Error `, error);
                reject(error.message);
            };
        });
    }

}

function generatePage1(doc, contractInfo) {

    doc
        .image("assets/images/evio.png", 240, 50, { width: 125, height: 38 })

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
        .image("assets/images/evio.png", 240, 50, { width: 125, height: 38 })

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
        .fill('#14FFFB')
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

    //Cliente

    startHeight = startHeight + 50;

    doc
        .rect(x1_limit, startHeight, x2_limit, increaseHeight)
        .fillAndStroke('#a6a6a6')
        .fill('#14FFFB')
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
    doc
        .fontSize(11)
        .font('assets/fonts/Nunito.ttf')
        .text('© Copyright EVIO - Electrical Mobility, Lda. 2021', 70, 635)
        .text('Este documento é propriedade da EVIO - Electrical Mobility, Lda., não podendo ser reproduzido, modificado ou divulgado a terceiros,'
            + ' sob qualquer forma, sem o prévio consentimento expresso da EVIO - Electrical Mobility, Lda.', 70, 655)
        .text('Este documento e o seu conteúdo são confidenciais.', 70, 705)

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
        .image("assets/images/evio.png", 240, 50, { width: 125, height: 38 })

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
        .text('https://evio.pt/', 173, 223, {
            link: 'https://evio.pt/',
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
            + 'mediante o uso da plataforma EVIO, nos termos previstos nas Condições '
            + 'Gerais, e/ou de cartões de carregamento EVIO.', 125, 285,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('1.2.', 90, 350)
        .text('Os cartões de carregamento ficarão ativos a partir da data comunicada '
            + 'pela Entidade Gestora da Rede de Mobilidade Elétrica (EGME) à EVIO, que a '
            + 'comunicará ao Cliente.', 125, 350,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(14)
        .font('assets/fonts/NunitoBold.ttf')
        .text('2.   Condições comerciais', 70, 420,
            { align: 'justify' });


    let startHeight = 450;
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
        .text('3.   Preço', 70, 530,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.1.', 90, 555)
        .text('Pelo fornecimento de eletricidade para a mobilidade elétrica '
            + ' objeto do presente Contrato, o Cliente obriga-se a pagar um preço global, em '
            + 'euros, que corresponde ao somatório dos valores resultantes da aplicação '
            + 'das componentes constantes dos números seguintes.', 125, 555,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.2.', 90, 640)

        .text('Poderá  consultar  em ', 125, 640,
            { align: 'justify' })

        .text('https://ceme.go-evio.com/pt/site-ceme', 258, 640, {
            link: 'https://ceme.go-evio.com/pt/site-ceme',
            underline: true
        })

        .text(',  o  preço', 485, 640,
            { align: 'justify' })

        .text('da energia elétrica acordado para o presente Contrato ao qual '
            + 'acresce uma tarifa de ativação por cada carregamento. '
            + 'A estes montantes incide IVA à taxa legal em vigor.', 125, 658,
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
        .image("assets/images/evio.png", 235, 50, { width: 125, height: 38 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.3.', 90, 115)
        .text('Ao preço previsto em 3.2 serão somados os custos correspondentes (i) à remuneração '
            + 'devida a cada operador de ponto de carregamento (OPC) pelo acesso ao respetivo '
            + 'ponto (a qual pode variar entre os diferentes pontos de carregamento e que é divulgada '
            + 'ao Cliente em cada ponto de carregamento pelo respetivo OPC), (ii) às tarifas de acesso à rede '
            + 'de mobilidade elétrica em vigor aprovadas pela Entidade Reguladora dos Serviços Energéticos (ERSE), (iii) às tarifas '
            + 'da EGME aplicáveis aos OPC ou aos DPC, fixadas pela ERSE e (iv) outros impostos, taxas, encargos ou contribuições '
            + 'legalmente aplicáveis ao fornecimento de eletricidade para a mobilidade elétrica no momento da emissão '
            + 'da fatura.', 125, 115,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.4.', 90, 320)
        .text('A EVIO tem a faculdade de introduzir alterações no preço a pagar pelo Cliente, mediante prévia comunicação '
            + 'nos termos previstos nas Condições Gerais, nas seguintes situações:', 125, 320,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('a)', 125, 380)
        .font('assets/fonts/Nunito.ttf')
        .text('Alterações aprovadas pela ERSE nas tarifas de acesso às redes de energia elétrica para a mobilidade elétrica '
            + 'ou nas tarifas da EGME aplicáveis aos CEME e/ou aos OPC, quer seja ao seu valor ou à própria estrutura tarifária, '
            + 'nomeadamente pela sua recomposição ou introdução de novos componentes.', 140, 380,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoItalic.ttf')
        .text('b)', 125, 475)
        .font('assets/fonts/Nunito.ttf')
        .text('Alteração dos custos de aquisição de energia elétrica.', 140, 475,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('3.5.', 90, 505)
        .text('A emissão de cartão digitais é gratuita. A remissão de cartão físicos, incluindo o respetivo envio, tem '
            + ' um custo de 4€ por cartão. A EVIO oferece o primeiro cartão físico para '
            + 'cada um dos veículos.', 125, 505,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('4.   Modalidade de pagamento e faturação', 70, 570,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.1.', 90, 595)
        .text('Os pagamentos serão efetuados por débito no cartão de crédito ou da carteira. Nos pagamentos realizados através '
            + 'da carteira a taxa de ativação terá um desconto de 0,15€ em cada carregamento.', 125, 595,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.2.', 90, 662)
        .text('As faturas são emitidas com o pagamento e de forma eletrónica para o endereço de e-mail indicado pelo Cliente '
            + 'nas presentes Condições Particulares.', 125, 662,
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
        .image("assets/images/evio.png", 235, 50, { width: 125, height: 38 });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('4.3.', 90, 115)
        .text('O pagamento será realizado após a utilização do serviço e após a '
            + 'recepção dos dados por parte MOBI.E.', 125, 115,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/NunitoBold.ttf')
        .text('5.   Duração do Contrato', 70, 160,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.1.', 90, 185)
        .text('O presente Contrato tem a duração de 12 meses, contados a partir da data de adesão do Cliente, '
            + 'efetivada através da subscrição das presentes Condições Particulares, sendo automática e sucessivamente '
            + 'renovado por iguais períodos caso nem o Cliente nem a EVIO se oponha à renovação, através de notificação '
            + 'escrita enviada à outra Parte, com uma antecedência mínima de 30 (trinta) dias relativamente à data do seu '
            + 'termo inicial ou de qualquer uma das suas renovações.', 125, 185,
            { align: 'justify' });

    doc
        .fillColor("#353841")
        .fontSize(13)
        .font('assets/fonts/Nunito.ttf')
        .text('5.2.', 90, 320)
        .text('As Condições Gerais estabelecem as demais formas de cessação do contrato.',
            125, 320, { align: 'justify' });

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