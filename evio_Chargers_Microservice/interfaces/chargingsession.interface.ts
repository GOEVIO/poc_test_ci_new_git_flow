export interface ICostDetails {
  activationFee: number;
  parkingDuringCharging: number;
  parkingAmount: number;
  timeCharged: number;
  totalTime: number;
  totalPower: number;
  costDuringCharge: number;
  timeDuringParking?: number;
}


export interface IPrice {
  excl_vat: number; 
  incl_vat: number;
}


export interface IGeometry {
  type: "Point";
  coordinates: [number, number];
}

export interface IPriceRound {
  round_granularity: string;
  round_rule: string;
}

export interface IStepRound {
  round_granularity: string;
  round_rule: string;
}

export interface IPriceComponent {
  type: string;
  price: number;
  vat: number;
  step_size: number;
  price_round: IPriceRound;
  step_round: IStepRound;
}

export interface IRestrictions {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  min_kwh: number;
  max_kwh: number;
  min_current: number;
  max_current: number;
  min_power: number;
  max_power: number;
  min_duration: number;
  max_duration: number;
  day_of_week: string[];
  reservation: string;
}

export interface ITariffElement {
  price_components: IPriceComponent[];
  restrictions: IRestrictions;
}

export interface IUomValue {
  uom: string;
  value: number;
}

export interface IEvioCommission {
  minAmount: IUomValue;
  transaction: IUomValue;
}

export interface ISalesTariffInner {
  activationFee: number;
  bookingAmount: IUomValue;
  chargingAmount: IUomValue;
  parkingDuringChargingAmount: IUomValue;
  parkingAmount: IUomValue;
  evioCommission: IEvioCommission;
}

export interface ISalesTariff {
  name: string;
  tariffType: string;
  tariff: ISalesTariffInner;
  billingType: string;
  type: string;
  currency: string;
  min_price: IPrice;
  max_price: IPrice;
  elements: ITariffElement[];
}

export interface IAddress {
  street: string;
  number: string;
  floor: string;
  zipCode: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
}

export interface IWeekScheduleTime {
  value: number;
  startTime: string;
  stopTime: string;
}

export interface IWeekScheduleItem {
  weekDay: string;
  scheduleTime: IWeekScheduleTime[];
}

export interface IPurchaseTariff {
  name: string;
  description: string;
  tariffType: string;
  userId: string;
  weekSchedule: IWeekScheduleItem[];
  purchaseTariffId: string;
}

export interface IEvKms {
  kms: number;
  kmsDate: Date;
  updatedKmsDate: Date;
}

export interface ICpoTariffId {
  tariffId: string;
  plugId: string;
}

export interface IInvoice {
  processed: boolean;
  documentNumber: string;
}

export interface ITimeCostPerMin {
  cost: number;
  startDate: Date;
  endDate: Date;
}

export interface ISessionSimulation {
  fallbackPower: number;
  estimatedEnergy: number;
  estimatedEnergyAtStart: number;
  fixedCost: number;
  timeCostPerMin: ITimeCostPerMin[];
  estimatedDuration: number;
  estimatedDurationAtStart: number;
  estimatedCost: number;
  estimatedCostAtStart: number;
  energyRemaining: number;
  costSoFar: number;
  costRemaining: number;
  calculatedAt: Date;
  estimationMode: string;
  stopTimeAtStart: Date;
  stopTime: Date;
}

export interface IReadingPoint {
  totalPower: number;
  instantPower: number;
  readDate: Date;
  communicationDate: Date;
  batteryCharged: number;
  instantVoltage: number;
  instantAmperage: number;
}

export interface IFeedbackItem {
  questionCode: string;
  value: number;
  auxiliaryText: string;
}

export interface IStopReason {
  reasonCode: string;
  reasonText: string;
}

export interface IAutoStop {
  uom: string;
  value: number;
}

export interface IFees {
  IEC: number;
  IVA: number;
  countryCode: string;
}

export interface INotificationHistoryItem {
  type: string;
  timestamp: string;
  totalPower: number;
}

export interface IChargingSession {
  _id: string;
  id: string;
  sessionId: number;
  hwId: string;
  idTag: string;
  cardNumber: string;
  plugId: string;
  userId: string;
  fleetId: string;
  deviceIdentifier: string;
  evId: string;
  invoice: IInvoice;
  invoiceType: string;
  invoiceCommunication: string;
  startDate: Date;
  stopDate: Date;
  localStartDate: Date;
  localStopDate: Date;
  clientType: string;
  command: string;
  chargerType: string;
  meterStart: number;
  meterStop: number;
  totalPower: number;
  sessionPrice: number;
  tariffId: string;
  tariff: ISalesTariff;
  estimatedPrice: number;
  totalPrice: IPrice;
  finalPrice: number;
  batteryCharged: number;
  timeLeft: number;
  timeCharged: number;
  CO2Saved: number;
  model: string;
  status: string;
  parkingStartDate: Date;
  parkingStopDate: Date;
  rating: number;
  bookingId: string;
  readingPoints: IReadingPoint[];
  feedBack: IFeedbackItem[];
  feedBackText: string;
  stoppedByOwner: boolean;
  stopReason: IStopReason;
  autoStop: IAutoStop;
  counter: number;
  downtime: number;
  uptime: number;
  paymentId: string;
  chargerOwner: string;
  evOwner: string;
  paymentMethod: string;
  paymentMethodId: string;
  walletAmount: number;
  reservedAmount: number;
  confirmationAmount: number;
  userIdWillPay: string;
  userIdToBilling: string;
  adyenReference: string;
  transactionId: string;
  paymentStatus: string;
  paymentType: string;
  paymentNotificationStatus: boolean;
  address: IAddress;
  timeZone: string;
  fees: IFees;
  invoiceId: string;
  invoiceStatus: boolean;
  authType: string;
  sessionSync: boolean;
  stopTransactionReceived: boolean;
  purchaseTariff: IPurchaseTariff;
  billingPeriod: string;
  purchaseTariffDetails: {
    excl_vat: number;
    incl_vat: number;
    kwhListAverage: number[];
  };
  clientName: string;
  endOfEnergyDate: string;
  freeOfCharge: boolean;
  createdWay: string;
  notes: string;
  b2bComissioned: boolean;
  network: string;
  country_code: string;
  party_id: string;
  cdr_token: Record<string, unknown>;
  auth_method: string;
  response_url_start: string;
  response_url_stop: string;
  authorization_reference: string;
  currency: string;
  location_id: string;
  evse_uid: string;
  connector_id: string;
  ocpiId: string;
  operatorId: string;
  cdrId: string;
  plafondId: string;
  syncToPlafond: boolean;
  evDetails: Record<string, unknown>;
  fleetDetails: Record<string, unknown>;
  userIdInfo: Record<string, unknown>;
  userIdWillPayInfo: Record<string, unknown>;
  userIdToBillingInfo: Record<string, unknown>;
  notificationsHistory: INotificationHistoryItem[];
  acceptKMs: boolean;
  updateKMs: boolean;
  evKms: IEvKms;
  cpoTariffIds: ICpoTariffId[];
  userCoordinates: IGeometry;
  sessionSimulation: ISessionSimulation;
  message: string;
  errorType: string;
  commandResponseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
