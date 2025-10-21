import { Request, Response, NextFunction } from 'express'

export type GetChargersParamsSortOrderType = 1 | -1

export type GetChargersParamsSortSortType = 'chargerId' | 'chargerName' | 'location' | 'state' | 'accessibility' | 'status' | 'plugId' | 'qrCode'

const sortFieldMap: Record<string, string> = {
  chargerId: 'hwId',
  chargerName: 'name',
  location: 'infrastructure',
  state: 'active',
  accessibility: 'accessType',
  status: 'status',
  plugId: 'plugs.plugId',
  qrCode: 'plugs.qrCodeId',
};

function toOrder(order?: string): GetChargersParamsSortOrderType {
  return order === 'desc' ? -1 : 1;
}

export function parseGetChargersParamsSort(req: Request, _res: Response, next: NextFunction) {
  const sort = String(req.query['sort'])
  const order = String(req.query['order'])

  const internalField = sortFieldMap[sort] || 'name';

  req.query['_sort'] = internalField;
  req.query['_order'] = String(toOrder(order));

  return next()
}
