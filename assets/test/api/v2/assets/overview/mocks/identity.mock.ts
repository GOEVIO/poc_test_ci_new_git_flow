import { ProjectedBillingProfile } from '@/api/v2/assets/overview/repository/billing-profiles.repository'
import { ProjectedClientType } from '@/api/v2/assets/overview/repository/clients.repository'
import { ProjectedUser } from '@/api/v2/assets/overview/repository/users.repostory'
import { YesNoDash } from '@/shared/types/yes-no-dash.type'

export const userMock: ProjectedUser = {
  _id: 'userId',
  name: 'username',
  email: 'usermail@mail.com',
  clientType: 'B2B',
}

export const clientMock: ProjectedClientType = {
  clientList: [{ userId: 'userId' }],
}

export const billingProfileMock: ProjectedBillingProfile = {
  nif: '99999990',
  userId: 'userId',
}

export const b2b2cMock: YesNoDash = '-'

export default {
  findUsers: jest.fn(),
  findBillingProfiles: jest.fn(),
}
