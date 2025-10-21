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

describe('Delete APT', () => {
  let aptService: AptService
  let app: INestApplication
  let aptRepository: AptRepository

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AptMockModule],
    }).compile()
    aptService = module.get<AptService>(AptService)
    aptRepository = module.get<AptRepository>(AptRepository)
    app = module.createNestApplication()
    app.useGlobalInterceptors(new LoggingInterceptor(new LoggerService()))
    app.useGlobalFilters(new ErrorFilter(new LoggerService()))
    app.setGlobalPrefix('apt/')
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

  it('should delete an apt by serial number', async () => {
    const serial_number = MockAptResultExample.serial_number

    jest
      .spyOn(aptRepository, 'findBySerialNumber')
      .mockResolvedValueOnce(MockAptResultExample)
    jest.spyOn(aptRepository, 'delete').mockResolvedValueOnce()

    const response = await request(app.getHttpServer())
      .delete(`/apt/${serial_number}`)
      .expect(200)

    expect(response.status).toBe(200)
    expect(aptRepository.delete).toHaveBeenCalledWith(serial_number)
  })

  it('should return 404 if apt does not exist', async () => {
    const serial_number = 'non-existing-serial-number'

    jest.spyOn(aptRepository, 'findBySerialNumber').mockResolvedValueOnce(null)

    const response = await request(app.getHttpServer())
      .delete(`/apt/${serial_number}`)
      .expect(404)

    expect(response.status).toBe(404)
    expect(response.body.message).toContain(
      'APT with serial number non-existing-serial-number not found'
    )
  })

  it('should return 500 if an error occurs', async () => {
    const serial_number = MockAptResultExample.serial_number

    jest
      .spyOn(aptRepository, 'findBySerialNumber')
      .mockResolvedValueOnce(MockAptResultExample)
    jest
      .spyOn(aptRepository, 'delete')
      .mockRejectedValueOnce(new Error('APT not deleted'))

    const response = await request(app.getHttpServer())
      .delete(`/apt/${serial_number}`)
      .expect(500)

    console.table(response.body)

    expect(response.status).toBe(500)
    expect(response.body.message).toContain('APT not deleted')
  })
})
