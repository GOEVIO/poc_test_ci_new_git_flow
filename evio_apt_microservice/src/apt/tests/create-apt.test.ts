import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { AptMockModule } from './mocks/apt-mock.module'
import { AptService } from '../apt.service'
import { IdentityLibraryService } from '../../libraries/identity-library.service'
import { BodyAptDto } from '../dtos'
import { CreateAptResponseDto } from '../dtos/create-apt.dto'
import { MockAptResultExample } from './mocks/apt-result.example'

describe('Create APT', () => {
  let aptService: AptService
  let identityLibraryService: IdentityLibraryService
  let app: INestApplication

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
    chargers:
      MockAptResultExample.chargers?.map((c) => ({
        hwId: c.hwId,
        charger_type: c.charger_type,
      })) || [],
    networks_available: MockAptResultExample.networks_available,
    tariff_type: MockAptResultExample.tariff_type,
    client_name: MockAptResultExample.client_name,
    ip: MockAptResultExample.ip,
    apt_owner_id: MockAptResultExample.apt_owner_id,
    create_user_id: MockAptResultExample.create_user_id,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AptMockModule],
    }).compile()
    aptService = module.get<AptService>(AptService)
    identityLibraryService = module.get<IdentityLibraryService>(
      IdentityLibraryService
    )
    app = module.createNestApplication()
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

  it('should create a new apt', async () => {
    const user_id = '123e4567-e89b-12d3-a456-426614174000'

    const expectedResponse: CreateAptResponseDto = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      serial_number: body.serial_number,
      user_id,
    }

    jest.spyOn(aptService, 'create').mockResolvedValueOnce(expectedResponse)

    const result: CreateAptResponseDto | null = await aptService.create({
      ...body,
    })

    expect(result).toEqual(expectedResponse)
    expect(aptService.create).toHaveBeenCalledWith({
      ...body,
    })
  })

  it('should throw an error if apt creation fails', async () => {
    jest
      .spyOn(aptService, 'create')
      .mockRejectedValue(new Error('Creation failed'))

    await expect(
      aptService.create({
        ...body,
      })
    ).rejects.toThrow('Creation failed')
  })

  it('POST /apt should create a new apt', async () => {
    const user_id = '123e4567-e89b-12d3-a456-426614174000'

    jest
      .spyOn(identityLibraryService, 'create')
      .mockResolvedValueOnce({ user_id })

    jest.spyOn(aptService, 'create').mockResolvedValueOnce({
      id: user_id,
      serial_number: body.serial_number,
      user_id,
    })

    await request(app.getHttpServer())
      .post('')
      .send(body)
      .expect(201)
      .expect({
        message: 'Apt created successfully',
        success: true,
        data: {
          id: user_id,
          serial_number: body.serial_number,
          user_id,
        },
      })
  })

  it('POST /apt should return an error if apt already exists', async () => {
    jest.spyOn(aptService, 'findBySerialNumber').mockResolvedValueOnce({
      id: '123e4567-e89b-12d3-a456-426614174000',
      serial_number: body.serial_number,
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      model: 'Model X',
      android_application_version: '1.0.0',
      brand: 'Brand Y',
      financial_provider: 'Provider Z',
      firmware_version: '1.0.0',
      has_sim_card: true,
      description_of_the_agreement: 'Agreement details',
      number_of_chargers: 2,
      chargers: [
        {
          hwId: 'charger1',
          id: '11111111-1111-1111-1111-111111111111',
          charger_type: '004',
        },
        {
          hwId: 'charger2',
          id: '22222222-2222-2222-2222-222222222222',
          charger_type: '004',
        },
      ],
      networks_available: ['Network1', 'Network2'],
      tariff_type: 'AD_HOC',
      client_name: 'EVIO',
      create_user_id: MockAptResultExample.create_user_id,
      apt_owner_id: MockAptResultExample.apt_owner_id,
    })

    await request(app.getHttpServer())
      .post('')
      .send(body)
      .expect(400)
      .expect({
        message: `APT with serial number ${body.serial_number} already exists`,
        code: 'apt_already_exists',
      })
  })
})
