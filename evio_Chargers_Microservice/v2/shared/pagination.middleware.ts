import { Request, Response, NextFunction } from 'express'

export function parsePagination(req: Request, _res: Response, next: NextFunction) {
  const page = String(req.query['page'] || '1')
  const limit = String(req.query['limit'] || '10')
  const skip = String((parseInt(page) - 1) * parseInt(limit))

  req.query['_limit'] = limit
  req.query['_skip'] = skip

  return next()
}