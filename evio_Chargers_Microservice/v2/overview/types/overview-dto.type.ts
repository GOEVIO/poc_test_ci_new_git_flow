import { YesNoType } from "./yes-no.type";
import { YesNoDashType } from "./yes-no-dash.type";

export type OverviewDtoType = {
  _id: string,
  hwId: string,
  createUser: string,
  createdAt: Date,
  numberOfPlugs: number,
  B2B2C: YesNoDashType,
  clientName: string,
  status: string,
  isActive: YesNoType,
  operationalStatus: string,
  monetization: YesNoType,
  lastHeartBeat: Date,
  customerName?: string,
  customerNif?: string,
  customerEmail?: string,
  lastMonetizationSession?: Date | undefined,
}