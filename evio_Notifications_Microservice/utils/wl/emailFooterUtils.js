function setFooterTranslation(mail, clientNameKeyMappingWL, translations) {
    const mailTypes = new Set([
        'account_deletion_request',
        'account_deletion_request_support',
        'revert_deletion_account',
        'account_deletion_refund_finance',
        'account_deletion_refund_customer',
        'account_deletion_request_company_contract',
        'account_deletion_refund_finance_no_balance',
        'account_deletion_revert_support'
    ]);

    if (mailTypes.has(mail.type)) {
        const footerKey1 = `${clientNameKeyMappingWL}_footer_Newsletter_Unsubscribe1`;
        const footerKey2 = `${clientNameKeyMappingWL}_footer_Newsletter_Unsubscribe2`;

        const findTranslation = (key) => {
            const translation = translations.find(t => t.key === key);
            return translation ? translation.value : '';
        };

        mail.message[`footer_Newsletter_Unsubscribe1`] = findTranslation(footerKey1);
        mail.message[`footer_Newsletter_Unsubscribe2`] = findTranslation(footerKey2);
    }
}

module.exports = { setFooterTranslation };