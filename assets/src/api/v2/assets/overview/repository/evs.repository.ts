import { PaginationDto } from '@/shared/pagination/pagination.dto'
import { aggregateEvs } from 'evio-library-evs'

export type GetEvsParams = {
  pagination: PaginationDto
  dateFrom?: Date
  dateThru?: Date
  createUser?: string
}

export type ProjectedEv = {
  createdAt: Date
  licensePlate: string
  clientName: string
  userId: string
  evType: string
  brand: string
  hasFleet: boolean
}

const projection = {
  _id: 0,
  createdAt: 1,
  userId: 1,
  licensePlate: 1,
  clientName: 1,
  evType: 1,
  brand: 1,
  hasFleet: 1,
}

function buildCreateUserMatcher(createUser?: string) {
  if (!createUser) {
    return {}
  }
  return { userId: createUser }
}

function buildDateMatcher(expression: string, date?: Date) {
  if (!date) {
    return {}
  }
  return { [expression]: date }
}

function buildDateMatchers(dateFrom?: Date, dateThru?: Date) {
  if (!dateFrom && !dateThru) {
    return {}
  }
  return {
    createdAt: {
      ...buildDateMatcher('$gt', dateFrom),
      ...buildDateMatcher('$lt', dateThru),
    },
  }
}

function buildMatchStep(dateFrom?: Date, dateThru?: Date, createUser?: string) {
  if (!dateFrom && !dateThru && !createUser) {
    return []
  }
  return [
    {
      $match: {
        ...buildCreateUserMatcher(createUser),
        ...buildDateMatchers(dateFrom, dateThru),
      },
    },
  ]
}

function buildPaginationSteps(pagination: PaginationDto) {
  if (pagination.pageNumber === -1 && pagination.pageSize === -1) {
    return []
  }

  const skip = (pagination.pageNumber - 1) * pagination.pageSize
  return [{ $skip: skip }, { $limit: pagination.pageSize }]
}

export async function getEvs({
  pagination,
  dateFrom,
  dateThru,
  createUser,
}: GetEvsParams): Promise<ProjectedEv[]> {
  const pipeline = [
    ...buildMatchStep(dateFrom, dateThru, createUser),
    ...buildPaginationSteps(pagination),
    { $project: projection },
  ]

  return (await aggregateEvs(pipeline)) as ProjectedEv[]
}
