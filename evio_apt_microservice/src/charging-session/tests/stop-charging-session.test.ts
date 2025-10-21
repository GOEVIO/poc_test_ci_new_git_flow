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

describe('stop charging session', () => {
  let app: INestApplication
  let aptService: AptService
  let ocpiLibraryService: OcpiLibraryService
  let connectionStationClient: ConnectionStationClient
  const sessionData = {
    auth: 'true',
    code: '',
    message: 'Remote Stop accepted',
    sessionId: '6899d07c189b880013bfc27e',
  }
  const body = {
    chargerId: 'CBC-00011',
    plugId: 'CBC-00011-01-01',
    chargerType: '004',
    sessionId: '6899d07c189b880013bfc27e',
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

  it('should stop a charging session successfully', async () => {
    const apt = { user_id: 'user-1' } as Apt
    const session = { cdr_token: { uid: 'contract-1' } }

    jest.spyOn(aptService, 'findBySerialNumber').mockResolvedValue(apt)
    jest.spyOn(ocpiLibraryService, 'getSessionById').mockResolvedValue(session)
    jest
      .spyOn(connectionStationClient, 'handleSession')
      .mockResolvedValue(sessionData)

    const response = await request(app.getHttpServer())
      .post('/charging-session/stop?serial_number=7896')
      .send(body)
      .expect(201)

    expect(response.body).toEqual({
      success: true,
      message: 'Charging session stopped successfully',
      data: sessionData,
    })
  })

  it('should return 404 if APT not found', async () => {
    jest.spyOn(aptService, 'findBySerialNumber').mockResolvedValue(null)
    try {
      await request(app.getHttpServer())
        .post('/charging-session/stop?serial_number=7896')
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
    jest.spyOn(ocpiLibraryService, 'getSessionById').mockResolvedValue(null)

    try {
      await request(app.getHttpServer())
        .post('/charging-session/stop?serial_number=7896')
        .send(body)
        .expect(500)
    } catch (error: any) {
      expect(error.response).toMatchObject({
        success: false,
        message: 'Failed to retrieve session data',
        code: 'session_data_retrieval_failed',
      })
    }
  })
})
