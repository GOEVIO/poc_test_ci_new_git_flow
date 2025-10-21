import { getChargerAndInfrastructure, getUsersMapByIdList } from "../repository";
import { createOCPPInvoiceDetails } from "./ocpp-create-invoice-details";
import { OCPPSessionCommandToOCPI, OCPPSessionStatusToOCPI } from "./ocpp-enums-to-ocpi-enums";

export const _applyOcppSpecificChanges = async (session, currentHistory, updatedHistory) => {
  if (!currentHistory) {
    const users = await getUsersMapByIdList([updatedHistory.chargerOwner]);
    updatedHistory.userChargerOwner = users[updatedHistory.chargerOwner];

    const { charger, infrastructure } = await getChargerAndInfrastructure(
      updatedHistory.hwId,
      session?.network
    );
  
    updatedHistory.charger = charger;
    updatedHistory.infrastructure = infrastructure;
  }

  updatedHistory.status = OCPPSessionStatusToOCPI[`_${updatedHistory?.status}`] || '';
  updatedHistory.command = OCPPSessionCommandToOCPI[`_${updatedHistory?.command}`] || '';
  updatedHistory.sessionId = updatedHistory?.sessionId ? String(updatedHistory?.sessionId) : '';
  updatedHistory.finalPrice = updatedHistory?.totalPrice?.incl_vat || 0;
  const invoiceDetails = await createOCPPInvoiceDetails(session);
  if (invoiceDetails) {
    updatedHistory.invoiceDetails = invoiceDetails;
  }

  const directFieldsOCPP = [
    'timeCharged',
    'batteryCharged',
    'totalPower',
    'tariffId',
    'rating',
    'transactionId',
    'acceptKMs',
    'updateKMs'
  ];

  directFieldsOCPP.forEach((field) => {
    updatedHistory[field] = session?.[field];
  });
}