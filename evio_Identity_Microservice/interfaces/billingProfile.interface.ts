import { ObjectId } from "mongoose";
import { IAddressModel } from './users.interface'

export interface IBillingProfile {
    _id?: string | ObjectId;
    billingAddress?: IAddressModel;
    billingName?: string;
    billingPeriod?: string;
    clientName?: boolean;
    clientType?: string;
    createdAt?: string | Date;
    email?: string;
    invoiceWithoutPayment?: boolean;
    nif?: string;
    purchaseOrder?: string;
    updatedAt?: string | Date;
    userId?: string;
    viesVAT?: boolean;
    companyTaxIdNumber?: string;
    publicEntity?: boolean;
    name: string;
}