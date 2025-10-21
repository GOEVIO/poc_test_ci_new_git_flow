import { MessageParamsEmail } from "./messageParamsEmail.interface";

export interface ISendMailOptions {
    to?: string; 
    cc?: string; 
    message: MessageParamsEmail; 
    type: string; 
}