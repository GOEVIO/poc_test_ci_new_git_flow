import { InvoiceCommunication } from "../../enums/invoice-communication.enum";
import { InvoiceType } from "../../enums/Invoice-type.enum";

interface Price {
  excl_vat: number;
  incl_vat: number;
}

interface FinalPrices {
  totalPrice: Price;
}

interface ChargingAmount {
  value: number;
  currency?: string;
}

interface TariffDetail {
  chargingAmount: ChargingAmount;
  parkingAmount: ChargingAmount;
  parkingDuringChargingAmount: ChargingAmount;
}

interface Tariff {
  tariffType: string;
  tariff: TariffDetail;
  parkingDuringChargingAmount: { value: number; };
  chargingAmount: { value: number; };
}

export interface Session {
  _id: string;
  id: string;
  userId: string;
  userIdToBilling: string;
  clientName: string;
  chargerType: string;
  billingPeriod: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'AD_HOC';
  invoiceType: InvoiceType;
  invoiceCommunication: InvoiceCommunication;
  userIdToBillingInfo: any;
  fees?: { IVA: number; countryCode: string };
  total_cost?: { excl_vat: number; incl_vat: number };
  finalPrices?: FinalPrices;
  totalPrice?: Price;
  currency?: string;
  viesVAT?: boolean;
  address?: { 
    street: string; 
    postalCode: string; 
    city: string; 
    country: string;
    countryCode: string; 
    state?: string;
    number?: string; 
    floor?: string 
  };
  cpoCountryCode?: string;
  country_code?: string;
  location_id: string;
  voltageLevel: string;
  kwh: number;
  totalPower: number;
  timeCharged: number;
  createdAt: string;
  start_date_time: string;
  startDate: string;
  local_start_date_time: string;
  end_date_time: string;
  stopDate: string,
  costDetails?: {
    activationFee?: number;
    totalPower?: number;
    totalPowerEmpty?: number;
    timeDuringParking?: number;
    costDuringCharge: number;
    timeCharged: number;
    parkingAmount?: number;
    parkingDuringCharging?: number;
  },
  hwId?: string;
  evDetails?: {
    licensePlate?: string;
    listOfGroupDrivers: Array<{
      name: string;
      _id: string;
      listOfDrivers: Array<{ _id: string; name: string }>;
    }>;
  };
  userIdInfo?: { _id: string; name: string;  };
  userIdWillPayInfo?: { _id: string; name: string; paymentPeriod: string;};
  tariffId?: string;
  tariff?: Tariff;
  network?: string;
  source?: string;
  paymentMethod?: string;
  createdWay?: string;
  fleetDetails?: {
    name: string;
  };
  cdr_token?: {
    _id: string;
    type: string;
    uuid: string;
    contract_id?: string;
  };
  cardNumber?: string;
  documentNumber?: string;
  paymentType?: string;
}