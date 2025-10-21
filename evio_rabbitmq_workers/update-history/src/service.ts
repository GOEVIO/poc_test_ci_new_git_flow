import {
  ChargerTypesMap,
  isNotEmptyObject,
  ThirdParties,
  DeviceTypes,
  verifyIsDeviceRequest,
} from 'evio-library-commons';
import {
  getContract,
  getEvAndFleet,
  getInvoiceAndBillingInfo,
  getPaymentBilling,
  getUsersMapByIdList,
} from './repository';
import { createHistoryObject, mapInvoiceLines } from 'evio-library-statistics';
import { _applyOcpiSpecificChanges } from './helpers/ocpi-apply-specific-changes';
import { _applyOcppSpecificChanges } from './helpers/ocpp-apply-specific-changes';
import { mapSessionBillingInfo } from './helpers/map-session-billing-info';
import { calculateEfficiencyAndOvercost } from './services/history';
import Identity from 'evio-library-identity';
import { APT_HOST } from './constants';
import axios from 'axios';

async function _setAPTUserInfo(updatedHistory, session) {
  updatedHistory.user = await Identity.findUserById(session.userId);

  try {
    const apt = await axios.get(
      `${APT_HOST}/apt/${updatedHistory?.user?.username}`,
    );
    const ownerId = apt?.data?.data?.apt_owner_id;
    updatedHistory.userEvOwner = await Identity.findUserById(ownerId);
    updatedHistory.evOwner = ownerId;
  } catch (e) {
    console.error(
      `Error fetching APT data for APT ${updatedHistory?.user?.username}:`,
      e,
    );
  }
}

async function _setQrCodeUserInfo(updatedHistory, session) {
  if (session?.userIdInfo?._id) {
    updatedHistory.userId = session.userIdInfo._id;
    updatedHistory.user = await Identity.findUserById(updatedHistory.userId);
  } else {
    updatedHistory.user = session?.userIdInfo;
  }
}

async function _setUsers(updatedHistory, session) {
  const { deviceType = '', isDevice = false } = verifyIsDeviceRequest(
    session?.createdWay,
  );
  if (isDevice && deviceType) {
    console.log(`Setting user information for deviceType: ${deviceType}`);
    const functionsDevices = {
      [DeviceTypes.APT]: _setAPTUserInfo,
      [DeviceTypes.QR_CODE]: _setQrCodeUserInfo,
    };
    await functionsDevices[deviceType]?.(updatedHistory, session);

    if (isNotEmptyObject(session.userIdWillPayInfo)) {
      updatedHistory.userWillPay = session.userIdWillPayInfo;
    }
  } else {
    const users = await getUsersMapByIdList([
      updatedHistory.userId,
      updatedHistory.userIdWillPay,
      updatedHistory.evOwner,
    ]);
    updatedHistory.user = users[updatedHistory.userId];
    updatedHistory.userWillPay = users[updatedHistory.userIdWillPay];
    updatedHistory.userEvOwner = users[updatedHistory.evOwner];
  }
}

async function _setEvs(updatedHistory) {
  if (updatedHistory.evId !== '-1') {
    const { ev, fleet } = await getEvAndFleet(updatedHistory.evId);

    if (ev) {
      updatedHistory.ev = ev;
      updatedHistory.fleet = fleet;
    }

    if (
      ev &&
      ev._id !== '-1' &&
      ev.listOfGroupDrivers?.length > 0 &&
      ev.userId !== updatedHistory.userId &&
      !ev.listOfDrivers?.some(
        (driver) => driver.userId === updatedHistory.userId,
      )
    ) {
      // find the group where the owner of the session is
      updatedHistory.groupDrivers =
        ev.listOfGroupDrivers.find((groupDriver) =>
          groupDriver?.listOfDrivers?.find(
            (driver) => driver.driverId === updatedHistory.userId,
          ),
        ) ?? null;
    }
  }
}

async function _setContract(
  updatedHistory,
  session,
  origin: 'ocpi22' | 'ocpp',
) {
  const { isDevice = false } = verifyIsDeviceRequest(session?.createdWay);
  if (!isDevice) {
    const idTag = origin === 'ocpi22' ? session?.token_uid : session?.idTag;
    if (idTag && idTag != '-1') {
      const contract = await getContract(idTag);
      updatedHistory.contract = contract;
      updatedHistory.cardNumber = contract?.cardNumber;
    }
  }
}

async function _setPaymentBilling(session, updatedHistory) {
  const paymentBillingInfo = await getPaymentBilling(session);

  updatedHistory.paymentBillingInfo = paymentBillingInfo;

  updatedHistory.paymentId = session?.paymentId;
  updatedHistory.paymentStatus = session?.paymentStatus;
  updatedHistory.paymentSubStatus = session?.paymentSubStatus;
}

async function _setInvoice(session, updatedHistory, origin: 'ocpi22' | 'ocpp') {
  console.log(
    `Setting invoice information for session: ${session?._id}, invoiceNumber: ${session?.invoice?.documentNumber || session?.documentNumber}`,
  );
  let invoice = session?.invoice || null;
  if (!invoice) {
    invoice = await getInvoiceAndBillingInfo(session);
  }
  updatedHistory.sessionBillingInfo = mapSessionBillingInfo(
    { ...session, invoice },
    origin,
  );
  updatedHistory.invoiceId = session.invoiceId;
  updatedHistory.documentNumber =
    session?.documentNumber || invoice?.documentNumber;
  updatedHistory.invoice = invoice;
  updatedHistory.invoiceStatus =
    session?.invoiceStatus !== undefined
      ? session.invoiceStatus
      : !!invoice?.documentNumber;
}

async function _buildInvoiceDetailsFromInvoiceLines(session, updatedHistory) {
  if (!session) {
    console.warn('Session is undefined or null.');
    return;
  }

  const invoiceLines = session.invoiceLines || [];
  const invoiceProvider = session.invoiceProvider || ThirdParties.Magnifinance;

  if (invoiceLines.length) {
    updatedHistory.invoiceDetails = await mapInvoiceLines(
      invoiceLines,
      invoiceProvider,
    );
  } else {
    console.info('No invoice lines to process.');
  }
}

function _setCostPerkWhToEVIOSessions(session, updatedHistory) {
  const context = 'Function setCostPerkWhToEVIOSessions';

  if (
    !session?.totalPower ||
    session?.totalPower === 0 ||
    !session?.totalPrice
  ) {
    console.log(
      `[${context}] Invalid totalPower or totalPrice for session=${session?._id}, setting fallback values`,
    );
    updatedHistory.costPerkWh = { excl_vat: 0, incl_vat: 0 };
  } else {
    updatedHistory.costPerkWh = {
      excl_vat: session.totalPrice.excl_vat / (session.totalPower / 1000),
      incl_vat: session.totalPrice.incl_vat / (session.totalPower / 1000),
    };
  }
}

function _setCostPerkWhToOCPISessions(session, updatedHistory) {
  const context = 'Function setCostPerkWhToOCPISessions';
  const { finalPrices } = session;
  const { kwh } = session;

  if (!kwh || kwh === 0) {
    console.log(
      `[${context}] kwh is undefined or 0 for session=${session?._id}, setting fallback values`,
    );
    updatedHistory.costPerkWh = { excl_vat: 0, incl_vat: 0 };
  } else if (!finalPrices?.totalPrice) {
    console.log(
      `[${context}] finalPrices.totalPrice is undefined for session=${session?._id}, setting fallback values`,
    );
    updatedHistory.costPerkWh = { excl_vat: 0, incl_vat: 0 };
  } else {
    updatedHistory.costPerkWh = {
      excl_vat: finalPrices.totalPrice?.excl_vat / kwh,
      incl_vat: finalPrices.totalPrice?.incl_vat / kwh,
    };
  }
}

export async function buildHistoryUpdate(
  session: any,
  currentHistory: any | undefined | null,
  type: 'ocpi22' | 'ocpp',
) {
  const updatedHistory = currentHistory ?? createHistoryObject(session);
  const promises: Promise<void>[] = [];

  if (type === 'ocpi22') {
    promises.push(
      _applyOcpiSpecificChanges(session, currentHistory, updatedHistory),
      _buildInvoiceDetailsFromInvoiceLines(session, updatedHistory),
    );
    _setCostPerkWhToOCPISessions(session, updatedHistory);
  } else {
    promises.push(
      _applyOcppSpecificChanges(session, currentHistory, updatedHistory),
    );
    _setCostPerkWhToEVIOSessions(session, updatedHistory);
  }

  // only first time
  if (!currentHistory) {
    promises.push(
      _setUsers(updatedHistory, session),
      _setEvs(updatedHistory),
      _setContract(updatedHistory, session, type),
    );

    updatedHistory.network = ChargerTypesMap[updatedHistory.chargerType];
  }

  promises.push(
    _setPaymentBilling(session, updatedHistory),
    _setInvoice(session, updatedHistory, type),
  );

  await Promise.all(promises);

  if (
    updatedHistory?.status?.toLowerCase() === 'completed' &&
    updatedHistory?.totalPower > 0 &&
    updatedHistory?.timeCharged > 60
  ) {
    await _setEfficiencyAndOvercost(currentHistory, updatedHistory);
  }

  return updatedHistory;
}

async function _setEfficiencyAndOvercost(currentHistory, updatedHistory) {
  if (!currentHistory?.efficiency || !currentHistory?.overcost) {
    /*
      If the current history does not have efficiency or overcost,
      we calculate them based on the updated history.
      We neet do check if evInfo is set because we need batery capacity
      to calculate efficiency and overcost.
    */
    if (!updatedHistory.ev?.evInfo) {
      await _setEvs(updatedHistory);
    }
    const { efficiency, overcost } = await calculateEfficiencyAndOvercost(
      updatedHistory,
      updatedHistory.charger,
      updatedHistory.contract,
    );

    updatedHistory.efficiency = efficiency;
    updatedHistory.overcost = overcost;
  }
}
