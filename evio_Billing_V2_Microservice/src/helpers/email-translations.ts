// TO-DO: Apply the translations in weblate
export function getInvoiceEmailTranslations(name: string, company: string) {
    const ptTranslation = {
        emailTitle: 'Fatura e Resumo da Sessão',
        emailHeader: `Caro(a) ${name},`,
        emailBody: `Obrigado por utilizar a ${company} e contribuir para um futuro mais sustentável. Em anexo encontra a sua fatura e o relatório completo da sessão de carregamento.`,
    };

    const enTranslation = {
        emailTitle: 'Invoice and Session Summary',
        emailHeader: `Dear ${name},`,
        emailBody: `Thank you for using ${company} and contributing to a more sustainable future. Attached you’ll find your invoice and a detailed report of your charging session.`,
    };

    const esTranslation = {
        emailTitle: 'Factura y Resumen de la Sesión',
        emailHeader: `Estimado/a ${name},`,
        emailBody: `Gracias por utilizar ${company} y contribuir a un futuro más sostenible. Adjuntamos su factura y el informe completo de su sesión de carga.`,
    };

    const frTranslation = {
        emailTitle: 'Facture et Résumé de la Session',
        emailHeader: `Cher/Chère ${name},`,
        emailBody: `Merci d'utiliser ${company} et de contribuer à un avenir plus durable. Vous trouverez en pièce jointe votre facture et le rapport détaillé de votre session de recharge.`,
    };

    return {
        PT_PT: ptTranslation,
        PT: ptTranslation,
        EN_GB: enTranslation,
        EN: enTranslation,
        ES_ES: esTranslation,
        ES: esTranslation,
        FR_FR: frTranslation,
        FR: frTranslation,
    };
}

export function getCreditNoteEmailTranslations(name: string, company: string) {
    const ptTranslation = {
        emailTitle: 'Nota de Crédito e Resumo da Sessão',
        emailHeader: `Caro(a) ${name},`,
        emailBody: `Obrigado por utilizar a ${company} e contribuir para um futuro mais sustentável. Em anexo encontra a sua nota de crédito e o relatório completo da sessão de carregamento.`,
    };

    const enTranslation = {
        emailTitle: 'Credit Note and Session Summary',
        emailHeader: `Dear ${name},`,
        emailBody: `Thank you for using ${company} and contributing to a more sustainable future. Attached you’ll find your credit note and a detailed report of your charging session.`,
    };

    const esTranslation = {
        emailTitle: 'Nota de Crédito y Resumen de la Sesión',
        emailHeader: `Estimado/a ${name},`,
        emailBody: `Gracias por utilizar ${company} e contribuir a um futuro mais sustentável. Adjuntamos su nota de crédito e el informe completo de su sesión de carga.`,
    };

    const frTranslation = {
        emailTitle: 'Note de Crédit et Résumé de la Session',
        emailHeader: `Cher/Chère ${name},`,
        emailBody: `Merci d'utiliser ${company} et de contribuer à un avenir plus durable. Vous trouverez en pièce jointe votre note de crédit et le rapport détaillé de votre session de recharge.`,
    };

    return {
        PT_PT: ptTranslation,
        PT: ptTranslation,
        EN_GB: enTranslation,
        EN: enTranslation,
        ES_ES: esTranslation,
        ES: esTranslation,
        FR_FR: frTranslation,
        FR: frTranslation,
    };
}