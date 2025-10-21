const getEmailHeaderKeyMap = (clientNameKeyMappingWL) => ({
    account_deletion_request_support: `${clientNameKeyMappingWL}_email_header_support`,
    account_deletion_refund_finance: `${clientNameKeyMappingWL}_email_header_support`
});

module.exports = { getEmailHeaderKeyMap };