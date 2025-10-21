import {
  ChargingSessionReadRepository as OcpiSessionRepository,
  CdrReadRepository,
} from "evio-library-ocpi";
import Chargers, {
  ChargingSessionReadRepository as OcppSessionRepository,
} from "evio-library-chargers";
import Identity from "evio-library-identity";
import EVs from "evio-library-evs";
import {
  findOneTariffCEMEById,
  findOneScheduleCEME,
  findOneTariffTar,
  findOneListCEMEById,
  findTariffCEMEByIds,
} from "evio-library-publictariffs";
import PaymentsDB from "evio-library-payments";
import {
  BillingInfo,
  Networks,
  PaymentStatus,
  PaymentsMethods,
} from "evio-library-commons";

import { existsId } from "./constants";
import { IInvoice } from "evio-library-statistics";


export async function getChargingSession(
  type: "ocpi22" | "ocpp",
  sessionId: string
) {
  if (type === "ocpi22") {
    const result = await OcpiSessionRepository.findOneFullById(sessionId);
    if (!result) {
      throw `Not found ocpi session by id: ${sessionId}`;
    }
    return result;
  }

  if (type === "ocpp") {
    const result = await OcppSessionRepository.findOneById(sessionId);
    if (!result) {
      throw `Not found ocpp session by id: ${sessionId}`;
    }
    return result;
  }

  console.error("Receiving messages with wrong type", type);
  throw "This shouldnt happen";
}

export async function getCdrById(cdrId: string) {
  const result = await CdrReadRepository.findOneByCdrId(cdrId);
  if (!result) {
    return '-1'
  }
  return result;
}

export async function getPublicNetworkCharger(hwId: string) {
  const result = await Chargers.findPublicChargerByHWID(hwId);
  if (!result) {
    throw `Not found public charger by hwId: ${hwId}`;
  }
  return result;
}

async function _getInfrastructure(id) {
  if (!id) {
    return undefined;
  }
  try {
    return await Chargers.findInfrastructureById(id);
  } catch (e) {
    console.info("error getting infrastructure", id, e);
    return undefined;
  }
}

async function _getGroupsCSUsers(listOfGroups) {
  if (!listOfGroups?.length) {
    return listOfGroups;
  }
  const ids = listOfGroups.map((group) => group.groupId);
  const query = { _id: { $in: ids } };
  const dbGroups = await Identity.findGroupCSUser(query);

  // merge charger groups with db groups
  return dbGroups.map((dbGroup) => ({
    ...listOfGroups.find((group) => group.groupId === dbGroup._id),
    ...dbGroup,
  }));
}

export async function getChargerAndInfrastructure(hwId: string, network?: string) {
  const charger = await Chargers.findPrivateCharger({hwId, hasInfrastructure: true, operationalStatus: {$in: [ 'APPROVED', 'WAITINGAPROVAL' ]}});
  if (!charger) {
    throw `Not found private charger by hwId: ${hwId}`;
  }

  const [infrastructure, listOfGroups] = await Promise.all([
    _getInfrastructure(charger.infrastructure),
    _getGroupsCSUsers(charger.listOfGroups),
  ]);

  if(network && network === Networks.EVIO){
    charger.listOfGroups = listOfGroups
  }

  return { charger, infrastructure };
}

export async function getUsersMapByIdList(ids: string[]) {
  const cleanIdList = [...new Set(ids)] // remove duplicates
    .filter(existsId); // filter out -1, unknown and falsy
  const unexistingIds = ids.filter((id) => !cleanIdList.includes(id));

  const users = cleanIdList.length
    ? await Identity.findUsersByIds(cleanIdList)
    : [];

  const foundUsersIds = users.map((user) => user._id);

  if (users?.length < cleanIdList.length) {
    const usersNotFoundInDB = cleanIdList.filter(cleanId => !foundUsersIds.includes(cleanId));
    unexistingIds.push(...usersNotFoundInDB);
  }
  const cleanIdMap = foundUsersIds.reduce((acc, userId) => {
    acc[userId] = users.find((user) => user._id === userId) || null;
    return acc;
  }, {});

  const unexistingIdMap = unexistingIds.reduce((acc, id) => {
    acc[id] = "-1";
    return acc;
  }, {});

  const finalMap = ids.reduce((acc, id) => {
    acc[id] = cleanIdMap[id] || unexistingIdMap[id] || null;
    return acc;
  }, {});

  return finalMap;
}

async function _getFleet(ev) {
  if (!ev.fleet) {
    return "-1";
  }
  try {
    return await EVs.findFleetById(ev.fleet);
  } catch (e) {
    console.info("failed to find fleet by id", ev.fleet, e);
    return "-1";
  }
}

async function _getDriver(driver) {
  if (!driver?.driverId) {
    return driver;
  }

  const user = await Identity.findUserById(driver.driverId);
  if (!user) {
    return driver;
  }

  return { ...user, driverId: driver.driverId };
}

async function _getGroupDriver(groupDriver) {
  const dbGroupDriver = await EVs.findGroupDriverById(groupDriver.groupId);

  if (!dbGroupDriver) {
    return groupDriver;
  }

  dbGroupDriver.listOfDrivers = await Promise.all(
    dbGroupDriver.listOfDrivers?.map(_getDriver)
  );

  return dbGroupDriver;
}

async function _getListOfGroupDrivers(ev) {
  if (!ev.listOfGroupDrivers?.length) {
    return ev.listOfGroupDrivers;
  }

  return await Promise.all(ev.listOfGroupDrivers.map(_getGroupDriver));
}

export async function getEvAndFleet(evId: string) {
  const ev = await EVs.findEVById(evId);
  if (!ev) {
    return { ev: undefined, fleet: undefined };
  }
  const [fleet, listOfGroupDrivers] = await Promise.all([
    _getFleet(ev),
    _getListOfGroupDrivers(ev),
  ]);

  ev.listOfGroupDrivers = listOfGroupDrivers;
  return { ev, fleet };
}

async function _getTariffCEME(id) {
  const tariff = await findOneTariffCEMEById(id);
  if (!tariff) {
    return {};
  }
  const querySchedules = {
    country: tariff.country,
    tariffType: tariff.tariffType,
    cycleType: tariff.cycleType,
  };
  const queryTar = {
    country: tariff.country,
    tariffType: tariff.tariffType,
    active: true,
  };

  const [schedule, tar, CEME] = await Promise.all([
    findOneScheduleCEME(querySchedules),
    findOneTariffTar(queryTar),
    findOneListCEMEById(id),
  ]);

  if (CEME) {
    return {
      CEME,
      plan: tariff,
      schedule,
      tar,
    };
  }

  return {
    plan: tariff,
    schedule,
    tar,
  };
}

async function _findOneScheduleCEME(tariff) {
  const query = {
    country: tariff.country,
    tariffType: tariff.tariffType,
    cycleType: tariff.cycleType,
  };
  const schedule = await findOneScheduleCEME(query);
  if (schedule) {
    return {
      plan: tariff,
      schedule,
    };
  }
  return { plan: tariff };
}

async function _getTariffCEMERoaming(tariffRoaming) {
  const planIds = tariffRoaming.map((tariff) => tariff.planId);

  const tariffs = await findTariffCEMEByIds(planIds);
  if (!tariffs?.length) {
    return [];
  }

  return await Promise.all(tariffs.map(_findOneScheduleCEME));
}

export async function getContract(idTag) {
  try {
    const contract = await Identity.findContractByIdTag(idTag);
    if (!contract) {
      return "-1";
    }
    if (contract.tariff) {
      const [tariffInfo, tariffRoamingInfo] = await Promise.all([
        _getTariffCEME(contract.tariff.planId),
        _getTariffCEMERoaming(contract.tariffRoaming),
      ]);
      contract.tariffRoamingInfo = tariffRoamingInfo;

      if (tariffInfo && Object.keys(tariffInfo).length) {
        tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(
          (tariff) => (tariff.power = contract.tariff.power)
        );
        contract.tariffInfo = tariffInfo;
      } else {
        contract.tariffInfo = {};
      }
    }

    return contract;
  } catch (e) {
    console.info("Error getting contract", e);
    return "-1";
  }
}

export async function getPaymentBilling(session) {
  if (
    !session.paymentMethod ||
    [
      PaymentsMethods.NotPay,
      PaymentsMethods.unknown,
      PaymentsMethods.Unknown,
    ].includes(session.paymentMethod)
  ) {
    return BillingInfo.NotApplicable;
  }

  if (
    [
      PaymentsMethods.Platfond,
      PaymentsMethods.transfer,
      PaymentsMethods.Transfer,
    ].includes(session.paymentMethod) ||
    !session.paymentId ||
    session.paymentId === "-1"
  ) {
    return BillingInfo.ToProcess;
  }

  const payment = await PaymentsDB.findPaymentById(session.paymentId);

  if (!payment) {
    return BillingInfo.ToProcess;
  }

  if (payment.status === PaymentStatus.InPayment) {
    return BillingInfo.FailedPayment;
  }

  if (
    ![
      PaymentStatus.Canceled,
      PaymentStatus.PaidOut,
      PaymentStatus.Refund,
      PaymentStatus.WaitingCaptureByEVIO,
    ].includes(payment.status)
  ) {
    return BillingInfo.ToProcess;
  }

  if (payment.status === PaymentStatus.WaitingCaptureByEVIO) {
    return BillingInfo.BilledAndNotPaid;
  }

  if (!session.invoiceId || session.invoiceId === "-1") {
    return BillingInfo.Paid;
  }

  return BillingInfo.FailedBilling;
}

export async function getInvoiceAndBillingInfo(session): Promise<IInvoice> {
  if(!session.invoiceId || session.invoiceId == "-1"){
    return {
      processed: false,
      documentNumber: "",
    }
  }

  const invoice: IInvoice = {
    processed: true,
    documentNumber: session?.documentNumber || "",
  }
  return invoice
}
