import paymentLibrary from "evio-library-payments";
import { ErrorHandlerCommon } from "src/common/error.handler.common";

export class PaymentsMethodService {
    constructor() {}

    static async retrievePaymentMethodByUserIdwithConfigs(userId: string): Promise<any> {
        // retrieve the payment method config for a determined user
        const paymentMethodConfig =  await paymentLibrary.retrievePaymentMethodByUserIdwithConfigs(userId);
        if(!paymentMethodConfig || paymentMethodConfig.paymentMethods == null || paymentMethodConfig.paymentMethods.length == 0) {
            throw ErrorHandlerCommon.notfound('server_paymentMethod_required', 'No payment method found', 'Not found');
        }
        const { paymentMethods } = paymentMethodConfig;
        
        // retrieve payment method that are approved
        const defaultPaymentMethod = paymentMethods.find((paymentMethod: any) => ['APPROVED', 'EXPIRED_MONTH'].includes(paymentMethod.status) && paymentMethod.defaultPaymentMethod);
        const currentPaymentMethod = defaultPaymentMethod ?? paymentMethods.find((paymentMethod: any) => ['APPROVED', 'EXPIRED_MONTH'].includes(paymentMethod.status));
        
        if(!currentPaymentMethod) return null;
        
        currentPaymentMethod.recurringProcessingModel = paymentMethodConfig?.recurringProcessingModel ?? 'UnscheduledCardOnFile'

        return currentPaymentMethod;
    }
}