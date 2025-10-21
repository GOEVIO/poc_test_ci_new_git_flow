import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AptMockModule } from './mocks/apt-mock.module'
import { AptService } from '../apt.service'
import { MockAptResultExample } from './mocks/apt-result.example'
import { LoggingInterceptor } from '../../core/interceptors/logging.interceptor'
import LoggerService from '../../core/services/logger'
import { ErrorFilter } from '../../core/filters/http-exception.filter'
import { AptRepository } from '../apt.repository'
import { Apt } from '../../database/entities/apt.entity'

describe('Get APTs', () => {
  let aptService: AptService
  let aptRepository: AptRepository
  let app: INestApplication

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AptMockModule],
    }).compile()
    aptService = module.get<AptService>(AptService)
    aptRepository = module.get<AptRepository>(AptRepository)
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
    expect(aptService).toBeDefined()
  })

  //create only get all service tests
  it('should return all APTs', async () => {
    const expectedResponse: Apt[] = [
      {
        ...MockAptResultExample,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    jest.spyOn(aptService, 'findAll').mockResolvedValueOnce(expectedResponse)

    const result = await aptService.findAll()
    expect(result).toEqual(expectedResponse)
  })

  it('should handle errors during retrieval', async () => {
    jest
      .spyOn(aptRepository, 'findAll')
      .mockRejectedValueOnce(new Error('Database error'))

    try {
      await aptService.findAll()
    } catch (error: any) {
      expect(error.response).toEqual({
        message: 'Database error',
        code: 'apt_not_found',
        success: false,
      })
    }
  })

  // Controller tests
  it('should be defined', () => {
    expect(app).toBeDefined()
  })

  it('should return all apts', async () => {
    const expectedResponse: Apt[] = [
      {
        ...MockAptResultExample,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    jest.spyOn(aptService, 'findAll').mockResolvedValueOnce(expectedResponse)

    const response = await request(app.getHttpServer()).get('').expect(200)

    expect(response.body).toEqual({
      success: true,
      message: 'APTs retrieved successfully',
      data: expectedResponse,
    })
  })

  it('should return an empty array if no apts are found', async () => {
    jest.spyOn(aptService, 'findAll').mockResolvedValueOnce([])

    const response = await request(app.getHttpServer()).get('').expect(404)

    expect(response.body).toEqual({
      success: false,
      message: 'No APTs found',
      code: 'apt_not_found',
    })
  })

  it('should return an empty array if no apts are found', async () => {
    jest.spyOn(aptService, 'findAll').mockResolvedValueOnce([])

    const response = await request(app.getHttpServer()).get('').expect(404)

    expect(response.body).toEqual({
      success: false,
      message: 'No APTs found',
      code: 'apt_not_found',
    })
  })

  it('should handle not found APTs correctly', async () => {
    jest.spyOn(aptService, 'findAll').mockResolvedValueOnce([])

    const response = await request(app.getHttpServer()).get('').expect(404)

    expect(response.body).toEqual({
      success: false,
      message: 'No APTs found',
      code: 'apt_not_found',
    })
  })

  // Tests find one by serial number
  it('should return an APT by serial number', async () => {
    const serial_number = '000353535'
    const expectedResponse: Apt = {
      ...MockAptResultExample,
      serial_number,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    jest
      .spyOn(aptService, 'findBySerialNumber')
      .mockResolvedValueOnce(expectedResponse)

    const response = await request(app.getHttpServer())
      .get(`/${serial_number}`)
      .expect(200)

    expect(response.body).toEqual({
      success: true,
      message: 'APT retrieved successfully',
      data: expectedResponse,
    })
  })

  it('should return 404 if APT not found by serial number', async () => {
    const serial_number = '000353535'
    jest.spyOn(aptService, 'findBySerialNumber').mockResolvedValueOnce(null)

    const response = await request(app.getHttpServer())
      .get(`/${serial_number}`)
      .expect(404)

    expect(response.body).toEqual({
      success: false,
      message: `APT with serial number ${serial_number} not found`,
      code: 'apt_not_found',
    })
  })

  it('should handle errors during APT retrieval by serial number', async () => {
    const serial_number = '000353535'
    jest
      .spyOn(aptService, 'findBySerialNumber')
      .mockRejectedValue(new Error('Database error'))

    try {
      await request(app.getHttpServer()).get(`/${serial_number}`).expect(500)
    } catch (error: any) {
      expect(error.response).toEqual({
        message: 'Database error',
        code: 'apt_not_found',
        success: false,
      })
    }
  })
})
