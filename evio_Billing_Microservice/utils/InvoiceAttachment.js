const { defaultLanguage } = require('./constants');

const config = {
    footerText: {
        pt_PT: {
            renewableEnergyInfo: "Origem da energia",
            description: "A eletricidade que fornecemos na rede pública de carregamento em Portugal é de origem {bold}100% renovável{bold}, proveniente exclusivamente de centrais fotovoltaicas e, como resultado, os carregamentos efetuados geram {bold}0,00 kg de CO2{bold}.",
            learnMore: "Saiba mais em",
            cemeLink: "https://ceme.go-evio.com/pt/site-ceme",
            erseLink: "https://www.erse.pt/eletricidade/garantias-de-origem-e-rotulagem"
        },
        en_GB: {
            renewableEnergyInfo: "Electricity Source",
            description: "The electricity we supply through the public charging network in Portugal comes from {bold}100% renewable sources{bold}, exclusively from photovoltaic plants. As a result, EV charging generates {bold}0.00 kg of CO2{bold}.",
            learnMore: "Learn more at",
            cemeLink: "https://ceme.go-evio.com/en/site-ceme",
            erseLink: "https://www.erse.pt/en/electricity/guarantees-of-origin-and-labeling"
        }
    }
};

function loadFooterText(language) {
    return config.footerText[language];
}

function generateFooter(doc, language = defaultLanguage) {
    const footerText = loadFooterText(language);

    doc
        .fillColor("#353841")
        .font('assets/fonts/NunitoBold.ttf')
        .fontSize(10)
        .text(footerText.renewableEnergyInfo, 75, 600, { align: 'left' }) 
        .moveDown(0.5);

    const descriptionParts = footerText.description.split(/\{bold\}|\{\/bold\}/);

    descriptionParts.forEach((part, index) => {
        if (index % 2 === 1) {
            doc.font('assets/fonts/NunitoBold.ttf').text(part, { continued: true, align: 'left' });
        } else {
            doc.font('assets/fonts/Nunito.ttf').text(part, { continued: true, align: 'left' });
        }
    });
    doc.moveDown(2).text('');
    doc
        .font('assets/fonts/Nunito.ttf')
        .text(`${footerText.learnMore}: `, { continued: true, align: 'left', lineBreak: false })
        .fillColor('blue')
        .text(footerText.cemeLink, { link: footerText.cemeLink, underline: true, continued: true })
        .fillColor('black')
        .text(' e: ', { continued: true, underline: false }) 
        .fillColor('blue')
        .text('https://www.erse.pt', { link: footerText.erseLink, underline: true });
}

module.exports = { generateFooter };