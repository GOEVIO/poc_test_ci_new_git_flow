import { MessageParamsEmail } from "./messageParamsEmail.interface";

export interface ISendMailParams {
    mailOptions: {
        to?: string; 
        cc?: string; 
        userEmail?: string;
        message: MessageParamsEmail; 
        type: string; 
    },
    clientName: string
}
