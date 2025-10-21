import { Request, Response } from 'express'

import { getChargersOverview } from './services/overview.service'
import { getFilters } from './services/params.service'

export async function getOverview(req: Request, res: Response) {
  const filters = getFilters(req.query)
  const results = await getChargersOverview(filters)

  return res.status(200).send({
    filters,
    total: results.length,
    results,
  })
}