import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { ConnectionStationClient } from '../../clients/connection-station.client'
import { OcpiLibraryService } from '../../libraries/ocpi-library.service'
import { AptService } from '../../apt/apt.service'
import { ChargingSessionMockModule } from './mocks/charging-session-mock.module'
import { Apt } from '../../database/entities/apt.entity'
import { LoggingInterceptor } from '../../core/interceptors/logging.interceptor'
import LoggerService from '../../core/services/logger'
import { ErrorFilter } from '../../core/filters/http-exception.filter'

describe('start charging session', () => {
  let app: INestApplication
  let aptService: AptService
  let ocpiLibraryService: OcpiLibraryService
  let connectionStationClient: ConnectionStationClient
  const sessionData = {
    auth: 'true',
    code: '',
    message: 'Session created successfully, attempting to start command start',
    sessionId: '6899d07c189b880013bfc27e',
    hwId: 'CBC-00011',
    userId: '6895e74ccc69504e24bb6540',
    authorization_reference: '9oD3MYljRPTV2gske7BaYiAH',
  }
  const body = {
    chargerId: 'CBC-00011',
    plugId: 'CBC-00011-01-01',
    chargerType: '004',
  }

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ChargingSessionMockModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.useGlobalInterceptors(new LoggingInterceptor(new LoggerService()))
    app.useGlobalFilters(new ErrorFilter(new LoggerService()))
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    )
    await app.init()

    aptService = moduleRef.get<AptService>(AptService)
    ocpiLibraryService = moduleRef.get<OcpiLibraryService>(OcpiLibraryService)
    connectionStationClient = moduleRef.get<ConnectionStationClient>(
      ConnectionStationClient
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('should start a charging session successfully', async () => {
    const apt = { user_id: 'user-1' } as Apt
    const adHocContract = 'contract-1'

    jest.spyOn(aptService, 'findBySerialNumber').mockResolvedValue(apt)
    jest
      .spyOn(ocpiLibraryService, 'createAdHocContract')
      .mockResolvedValue(adHocContract)
    jest
      .spyOn(connectionStationClient, 'handleSession')
      .mockResolvedValue(sessionData)

    const response = await request(app.getHttpServer())
      .post('/charging-session/start?serial_number=7896')
      .send(body)
      .expect(201)

    expect(response.body).toEqual({
      success: true,
      message: 'Charging session started successfully',
      data: sessionData,
    })
  })

  it('should return 404 if APT not found', async () => {
    jest.spyOn(aptService, 'findBySerialNumber').mockResolvedValue(null)
    try {
      await request(app.getHttpServer())
        .post('/charging-session/start?serial_number=7896')
        .send(body)
        .expect(404)
    } catch (error: any) {
      expect(error.response).toEqual({
        success: false,
        message: 'APT not found',
        code: 'apt_not_found',
      })
    }
  })

  it('should return 500 if ad-hoc contract creation fails', async () => {
    jest
      .spyOn(aptService, 'findBySerialNumber')
      .mockResolvedValue({ user_id: 'user-1' } as Apt)
    jest
      .spyOn(ocpiLibraryService, 'createAdHocContract')
      .mockResolvedValue(null)

    try {
      await request(app.getHttpServer())
        .post('/charging-session/start?serial_number=7896')
        .send(body)
        .expect(500)
    } catch (error: any) {
      expect(error.response).toMatchObject({
        success: false,
        message: 'Failed to create ad-hoc contract',
        code: 'ad_hoc_contract_creation_failed',
      })
    }
  })
})
