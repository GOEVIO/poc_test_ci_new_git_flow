export interface IAddNewDriver {
    mobile: string,
    internationalPrefix: string
}

export interface IAddNewDriverPayload {
    drivers: Array<IAddNewDriver>
}

export interface EV {
  primaryEV: boolean;
  status: string;
  hasFleet: boolean;
  usageNumber: number;
  clientName: string;
  acceptKMs: boolean;
  updateKMs: boolean;
  _id: string;
  brand: string;
  model: string;
  version: string;
  evType: string;
  vehicleId: string;
  imageContent: string;
  fleet: string;
  licensePlate: string;
  country: string;
  otherInfo: string;
  listOfDrivers: Driver[];
  userId: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  invoiceCommunication: string;
  invoiceType: string;
}

interface Driver {
    period: {
      periodType: string;
    };
    _id: string;
    userId: string;
    name: string;
    paymenteBy: string;
    billingBy: string;
    internationalPrefix: string;
    mobile: string;
  }