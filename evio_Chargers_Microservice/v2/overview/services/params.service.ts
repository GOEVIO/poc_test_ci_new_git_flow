import { Request } from 'express'
import { safeParseString, safeParseDate } from 'evio-library-commons'

import { FiltersType } from '../types/filters.type'

export function getFilters(query: Request['query']): FiltersType {
  return {
    createUser: safeParseString(query['createUser']),
    dateFrom: safeParseDate(query['dateFrom']),
    dateThru: safeParseDate(query['dateThru'])
  }
}
