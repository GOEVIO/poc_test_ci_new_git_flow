import { jest } from '@jest/globals'

import { ProjectedClientType } from '../../../../v2/overview/repository/clients.repository'
import { ProjectedUserType } from '../../../../v2/overview/repository/users.repository'
import { ProjectedBillingProfileType } from '../../../../v2/overview/repository/billing-profiles.repository';
import { ChargerMock } from './chargers.mock';
import { MockQueryProjectAsyncFunction } from './mock-functions.t'

export const UserMock: ProjectedUserType = {
  _id: ChargerMock.createUser,
  name: 'name',
  email: 'email',
}

export const BillingProfileMock: ProjectedBillingProfileType = {
  userId: UserMock._id,
  nif: '999999990',
}

export const ClientMock: ProjectedClientType = {
  clientList: [{
    userId: UserMock._id,
  }]
}

export default {
  findBillingProfiles: <MockQueryProjectAsyncFunction>jest.fn(),
  findUsersByIds: <MockQueryProjectAsyncFunction>jest.fn(),
  findUsers: <MockQueryProjectAsyncFunction>jest.fn(),
}
