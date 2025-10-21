import SalesTariffModel from '../../models/salesTariff';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SalesTariffs, SessionStatusesNumberTypes } from "evio-library-commons";
import { ServerError, Conflict, NotFound, Forbidden } from '../helpers/error';
import { CreateSalesTariffParsed } from '../schemas/sales-tariff.schema';
import { sessionUsingTariff, updateTariffOnInternalCharger } from 'evio-library-chargers';
import { ISalesTariff, ISalesTariffMapped } from '../interfaces/sales-tariff.interface';

export async function getSalesTariffs(userId: string): Promise<ISalesTariffMapped[]> {
  const tariffs = await SalesTariffModel.findUserActiveTariffs(userId);
  return tariffs.map(mapTariff);
}

export async function getTariffDetail(id: string, userId: string): Promise<ISalesTariffMapped> {
  const tariff = await SalesTariffModel.findTariffById(id);
  if (!tariff || tariff.status === SalesTariffs.Status.Inactive) {
    throw NotFound({
      message: "Sales tariff not found",
    });
  }

  if (tariff.createUser !== userId) {
    throw Forbidden({
      message: "Forbidden access to sales tariff",
    });
  }

  return mapTariff(tariff);
}

export async function addSalesTariff(req: Request): Promise<ISalesTariffMapped> {
    
    const { body, headers} = req;
    const { userid:createUser, clientname:clientName } = headers as { userid: string, clientname: string };

    // Check if there's already a tariff with the same name for the same user
    const existsTariff = await SalesTariffModel.findUserActiveTariffByName(createUser, body.name);
    if (existsTariff) {
        throw Conflict({
            message: 'Sales tariff already exists with same name'
        });
    }

    // Create the new sales tariff
    const salesTariff = new SalesTariffModel(buildTariffObject(body, createUser, clientName));
    const result = await SalesTariffModel.create(salesTariff);
    if (!result) {
        throw ServerError({
            auth: false,
            code: 'server_error_sales_tariff_not_created',
            message: 'Sales tariff has not been created'
        });
    }

    return mapTariff(result);

}

export async function editSalesTariff(req: Request): Promise<ISalesTariffMapped> {
  const { body, headers } = req;
  const { userid: modifyUser } = headers as { userid: string };
  const tariffId = body._id;

  const existsTariff = await SalesTariffModel.findTariffById(tariffId);
  if (!existsTariff || existsTariff.status === SalesTariffs.Status.Inactive) {
    throw NotFound({
      message: "Sales tariff not found",
    });
  }

  if (existsTariff.createUser !== modifyUser) {
    throw Forbidden({
      message: "Forbidden access to sales tariff",
    });
  }

  const hasSameName = await SalesTariffModel.findUserActiveTariffByName(existsTariff.createUser, body.name);
  if (
    hasSameName &&
    String(hasSameName._id) !== tariffId
  ) {
    throw Conflict({
      message: "Sales tariff already exists with same name",
    });
  }

  const updatedTariff = await SalesTariffModel.updateTariffById(tariffId, {
    ...body,
    modifyUser,
    min_price: toExclVat(body.min_price),
    max_price: toExclVat(body.max_price),
  });

  await updateTariffOnChargers(updatedTariff);

  return mapTariff(updatedTariff);
}

export async function deleteSalesTariff(req: Request): Promise<void> {
  const { _id: tariffId } = req.params;
  const { userid: userId } = req.headers as { userid: string };

  const existsTariff = await SalesTariffModel.findTariffById(tariffId);
  if (!existsTariff || existsTariff.status === SalesTariffs.Status.Inactive) {
    throw NotFound({
      message: "Sales tariff not found",
    });
  }

  if (existsTariff.createUser !== userId) {
    throw Forbidden({
      message: "Forbidden access to sales tariff",
    });
  }

  const usedTariff = await tariffWasUsed(tariffId);

  usedTariff
    ? await SalesTariffModel.inactivateTariffById(tariffId)
    : await SalesTariffModel.removeTariffById(tariffId);

  await removeTariffFromChargers(tariffId);
}


function buildTariffObject(
  body: CreateSalesTariffParsed,
  createUser: string,
  clientName: string
) {
  const min_price = toExclVat(body.min_price);
  const max_price = toExclVat(body.max_price);
  return {
    ...body,
    createUser,
    clientName,
    id: uuidv4(),
    status: SalesTariffs.Status.Active,
    min_price,
    max_price,
  };
}

function mapTariff(tariff: ISalesTariff) : ISalesTariffMapped {
  return {
    _id: tariff?._id,
    name: tariff?.name,
    billingType: tariff?.billingType,
    type: tariff?.type,
    currency: tariff?.currency,
    elements: tariff?.elements,
    min_price: tariff?.min_price?.excl_vat ?? undefined,
    max_price: tariff?.max_price?.excl_vat ?? undefined,
  };
}

async function updateTariffOnChargers(tariff:ISalesTariff): Promise<void> {
  const data = {
    name: tariff.name,
    min_price: tariff.min_price,
    max_price: tariff.max_price,
    type: tariff.type,
    currency: tariff.currency,
    elements: tariff.elements
  }
  await updateTariffOnInternalCharger(String(tariff._id), data);
}

const toExclVat = (value?: number | null | undefined) =>
  value ? { excl_vat: value } : {};


async function tariffWasUsed(tariffId: string): Promise<boolean> {
  const allStatus = Object.values(SessionStatusesNumberTypes);
  const session = await sessionUsingTariff(tariffId, allStatus);
  return !!session
}

async function removeTariffFromChargers(tariffId: string): Promise<void> {
  const data = {
    tariffId: "",
    name: "",
    min_price: "",
    max_price: "",
    type: "",
    currency: "",
    elements: ""
  }
  await updateTariffOnInternalCharger(String(tariffId), data);
}