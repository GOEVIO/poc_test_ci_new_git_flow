import { PaymentConditionsId } from "../../enums/payment-conditions.enum";

export interface UserIdToBillingInfo {
  user_id: string;
  invoice_id: string;
  name: string;
  vat_number: string;
  client_type: 'b2c' | 'b2b';
  street: string;
  number: string;
  floor: string;
  zip_code: string;
  purchase_order: string;
  payment_conditions_id: PaymentConditionsId | null;
  city: string;
  state: string;
  country: string;
  country_code: string;
}
