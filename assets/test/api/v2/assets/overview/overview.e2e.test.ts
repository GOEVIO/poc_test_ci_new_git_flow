import EvsMock, { evMock } from './mocks/evs.mock'
import IdentityMock, {
  billingProfileMock,
  clientMock,
  userMock,
} from './mocks/identity.mock'

jest.mock('evio-library-evs', () => EvsMock)
jest.mock('evio-library-identity', () => IdentityMock)

import { INestApplication } from '@nestjs/common'
import { Server } from 'net'
import * as request from 'supertest'
import { getAssetsTestingModule } from '../testing.module'
import {
  overviewDtoMock,
  paramsOverviewDtoMock,
  paramsQueryString,
} from './mocks/overview.mock'

describe('GET v2/assets/overview', () => {
  const path = '/assets/overview'
  let app: INestApplication<Server>

  beforeAll(async () => {
    const testModule = await getAssetsTestingModule()
    app = testModule.createNestApplication()

    await app.init()
  })

  afterAll(async () => {
    jest.clearAllMocks()
    await app.close()
  })

  beforeEach(() => {
    EvsMock.aggregateEvs.mockResolvedValueOnce([evMock])
    IdentityMock.findUsers.mockResolvedValueOnce([userMock, userMock])
    IdentityMock.findUsers.mockResolvedValueOnce([clientMock, clientMock])
    IdentityMock.findBillingProfiles.mockResolvedValueOnce([billingProfileMock])
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  test('Endpoint should exist', () => {
    return request(app.getHttpServer()).get(path).expect(200)
  })

  // Bad params cases
  test.each([
    ['?pageNumber=string'],
    ['?pageSize=nonnumber'],
    ['?dateFrom=nondate'],
    ['?dateThru=nondate'],
    ['?clientType=nonclienttype'],
  ])(
    'Given query %s, When get overview Should fail with status 400',
    async (query) => {
      const result = await request(app.getHttpServer()).get(path + query)
      expect(result.status).toBe(400)
    },
  )

  // Success cases
  test.each([
    ['', overviewDtoMock],
    [paramsQueryString, paramsOverviewDtoMock],
  ])(
    'Given query %s, When get overview Should return status 200, body %o',
    async (query, expected) => {
      const result = await request(app.getHttpServer()).get(path + query)
      expect(EvsMock.aggregateEvs).toHaveBeenCalledTimes(1)
      expect(IdentityMock.findUsers).toHaveBeenCalledTimes(2)
      expect(IdentityMock.findBillingProfiles).toHaveBeenCalledTimes(1)
      expect(result.status).toBe(200)
      expect(result.body).toEqual(expected)
    },
  )
})
