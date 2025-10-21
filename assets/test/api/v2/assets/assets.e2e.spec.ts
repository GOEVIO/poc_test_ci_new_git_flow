import evsMock from './overview/mocks/evs.mock'
import identityMock from './overview/mocks/identity.mock'

jest.mock('axios')
jest.mock('evio-library-evs', () => evsMock)
jest.mock('evio-library-identity', () => identityMock)

import { INestApplication } from '@nestjs/common'
import { TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { App } from 'supertest/types'
import { getAssetsTestingModule } from './testing.module'

describe('AppController (e2e)', () => {
  let app: INestApplication<App>

  beforeEach(async () => {
    const moduleFixture: TestingModule = await getAssetsTestingModule()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    jest.clearAllMocks()
    await app.close()
  })

  it('/', () => {
    return request(app.getHttpServer()).get('/').expect(404)
  })
})
