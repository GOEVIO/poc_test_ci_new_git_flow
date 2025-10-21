function getEmailHeaderKey(mailType) {
    const supportHeaderTypes = [
        'account_deletion_request_support',
        'account_deletion_refund_finance',
        'account_deletion_request_company_contract',
        'account_deletion_refund_finance_no_balance',
        'account_deletion_revert_support',
        'account_deletion_suspension_support',
        'account_deletion_suspension_fleet_owner',
        'account_deletion_restarted_support',
        'account_deletion_restarted_fleet_owner'
    ];
    return supportHeaderTypes.includes(mailType) 
        ? 'email_header_support' 
        : 'email_header';
}

module.exports = { getEmailHeaderKey }; 
