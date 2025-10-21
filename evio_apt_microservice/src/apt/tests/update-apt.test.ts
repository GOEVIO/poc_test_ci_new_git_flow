import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AptMockModule } from './mocks/apt-mock.module'
import { AptService } from '../apt.service'
import { BodyAptDto } from '../dtos'
import { MockAptResultExample } from './mocks/apt-result.example'
import { LoggingInterceptor } from '../../core/interceptors/logging.interceptor'
import LoggerService from '../../core/services/logger'
import { ErrorFilter } from '../../core/filters/http-exception.filter'
import { AptRepository } from '../apt.repository'
import { AptChargers } from '../../database/entities/apt-chargers.entity'
import { Apt } from '../../database/entities/apt.entity'

describe('Update APT', () => {
  let aptService: AptService
  let app: INestApplication
  let aptRepository: AptRepository

  const chargers: AptChargers = {
    hwId: MockAptResultExample.chargers?.[0]?.hwId || 'default-hwId',
    id: crypto.randomUUID(),
    charger_type: MockAptResultExample.chargers?.[0]?.charger_type || '004',
  }

  const body: BodyAptDto = {
    serial_number: MockAptResultExample.serial_number,
    model: MockAptResultExample.model,
    android_application_version:
      MockAptResultExample.android_application_version,
    brand: MockAptResultExample.brand,
    financial_provider: MockAptResultExample.financial_provider,
    firmware_version: MockAptResultExample.firmware_version,
    has_sim_card: MockAptResultExample.has_sim_card,
    description_of_the_agreement:
      MockAptResultExample.description_of_the_agreement,
    chargers: [chargers],
    networks_available: MockAptResultExample.networks_available,
    tariff_type: MockAptResultExample.tariff_type,
    client_name: MockAptResultExample.client_name,
    create_user_id: MockAptResultExample.create_user_id,
    apt_owner_id: MockAptResultExample.apt_owner_id,
  }

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

  it('should update an APT', async () => {
    const expectedResponse: any = {
      ...MockAptResultExample,
      chargers: body.chargers as AptChargers[],
    }

    jest.spyOn(aptRepository, 'update').mockResolvedValueOnce(expectedResponse)
    // Mock the existing apt object as the third argument
    const updatedApt = await aptService.update(
      body.serial_number,
      body,
      expectedResponse
    )
    expect(updatedApt).toEqual(expect.objectContaining(body))
    expect(updatedApt).toHaveProperty('serial_number', body.serial_number)
  })

  it('should throw an error if APT does not exist', async () => {
    jest.spyOn(aptRepository, 'update').mockResolvedValueOnce(null)
    try {
      await aptService.update('non-existing-serial', body, {} as Apt)
    } catch (error: any) {
      expect(error.response).toEqual({
        message: `APT with serial number non-existing-serial not found`,
        code: 'apt_not_found',
      })
    }
  })

  // Controller tests
  it('should update an APT via controller', async () => {
    const expectedResponse: any = {
      ...MockAptResultExample,
      chargers: body.chargers as AptChargers[],
    }
    jest
      .spyOn(aptRepository, 'findBySerialNumber')
      .mockResolvedValueOnce(expectedResponse)

    jest.spyOn(aptRepository, 'update').mockResolvedValueOnce(expectedResponse)

    const response = await request(app.getHttpServer())
      .put(`/apt/${body.serial_number}`)
      .send(body)
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(expect.objectContaining(body))
  })

  it('should return 404 if APT does not exist', async () => {
    jest.spyOn(aptRepository, 'findBySerialNumber').mockResolvedValueOnce(null)
    const response = await request(app.getHttpServer())
      .put(`/apt/non-existing-serial`)
      .send(body)
    expect(response.status).toBe(404)
  })

  it('should return 400 for invalid input', async () => {
    const invalidBody = { ...body, serial_number: 7, has_sim_card: '' }
    const response = await request(app.getHttpServer())
      .put(`/apt/${body.serial_number}`)
      .send(invalidBody)
    expect(response.status).toBe(400)
    expect(response.body.message).toContain('Serial Number must be a string')
    expect(response.body.message).toContain('Has SIM Card must be a boolean')
  })

  it('should return 400 for non-whitelisted properties', async () => {
    const invalidBody = { ...body, extraField: 'extraValue' }
    const response = await request(app.getHttpServer())
      .put(`/apt/${body.serial_number}`)
      .send(invalidBody)
    expect(response.status).toBe(400)
    expect(response.body.message).toContain(
      'property extraField should not exist'
    )
  })
})
