import { BillingEnums } from '../utils/enums/billingEnums.js';

const allowedBillingStatuses = (): string[] => {
    return Object.values(BillingEnums.Status);
}


function isValidBillingStatus(status: string | string[]): boolean {

    const receivedBillingStatus = Array.isArray(status)
    ? status
    : [status]; 

    return receivedBillingStatus.filter(
        status => !allowedBillingStatuses().includes(status)
    ).length === 0;
 
}

export { isValidBillingStatus, allowedBillingStatuses };