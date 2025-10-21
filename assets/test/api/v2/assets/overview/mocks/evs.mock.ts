import { ProjectedEv } from '@/api/v2/assets/overview/repository/evs.repository'

export const evMock: ProjectedEv = {
  createdAt: new Date(),
  licensePlate: 'ABC-132',
  clientName: 'EVIO',
  userId: 'userId',
  evType: 'evType',
  brand: 'brand',
  hasFleet: true,
}

export default {
  aggregateEvs: jest.fn(),
}
