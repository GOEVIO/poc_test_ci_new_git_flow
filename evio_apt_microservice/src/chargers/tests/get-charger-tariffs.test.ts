import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AptChargerMockModule } from './mocks/charger-mock.module'
import { MockChargerTariffsResult } from './mocks/charger-tariffs-result.example'
import { LoggingInterceptor } from '../../core/interceptors/logging.interceptor'
import LoggerService from '../../core/services/logger'
import { ErrorFilter } from '../../core/filters/http-exception.filter'
import { AptChargerRepository } from '../charger.repository'
import { ChargersLibraryService } from '../../libraries/chargers-library.service'

describe('Get Charger tariffs', () => {
  let aptChargerRepository: AptChargerRepository
  let chargersLibraryService: ChargersLibraryService
  let app: INestApplication

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AptChargerMockModule],
    }).compile()
    aptChargerRepository =
      module.get<AptChargerRepository>(AptChargerRepository)
    chargersLibraryService = module.get<ChargersLibraryService>(
      ChargersLibraryService
    )
    app = module.createNestApplication()
    app.useGlobalInterceptors(new LoggingInterceptor(new LoggerService()))
    app.useGlobalFilters(new ErrorFilter(new LoggerService()))
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  // Service tests
  it('should be defined', () => {
    expect(aptChargerRepository).toBeDefined()
  })

  // Controller tests
  it('should be defined', () => {
    expect(app).toBeDefined()
  })

  it('should return a list of chargers with tariffs', async () => {
    const expectedResponse = {
      success: true,
      message: 'Charger details retrieved successfully',
      data: MockChargerTariffsResult,
    }

    jest
      .spyOn(chargersLibraryService, 'findChargersByAPT')
      .mockResolvedValueOnce(MockChargerTariffsResult.chargers[0])

    const response = await request(app.getHttpServer())
      .get('/050505/chargers')
      .expect(200)

    expect(response.body).toEqual(expectedResponse)
  })
})
