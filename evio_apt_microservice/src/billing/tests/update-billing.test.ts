import { Test, TestingModule } from '@nestjs/testing'
import { PaymentsLibraryService } from '../../libraries/payments/payments-library.service'
import { BillingMockModule } from './billing-mock.module'
import { PaymentsLibraryRepository } from 'src/libraries/payments/payments-library.repository'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'

describe('PaymentsLibraryService', () => {
  let paymentsLibraryService: PaymentsLibraryService
  let paymentsLibraryRepository: PaymentsLibraryRepository
  let app: INestApplication
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [BillingMockModule],
    }).compile()

    paymentsLibraryService = module.get<PaymentsLibraryService>(
      PaymentsLibraryService
    )
    paymentsLibraryRepository = module.get<PaymentsLibraryRepository>(
      PaymentsLibraryRepository
    )

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter()
    )
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('updatePreAuthorizationById', () => {
    it('should update pre-authorization by ID', async () => {
      const preAuthorizationId = 'test-id'
      const billingInfo = {
        billingInfo: { name: 'John Doe', email: 'john.doe@example.com' },
      }
      const expectedUpdateData = {
        preAuthorizationId,
        billingInfo: { name: 'John Doe', email: 'john.doe@example.com' },
      }
      jest
        .spyOn(paymentsLibraryRepository, 'updatePreAuthorizationById')
        .mockResolvedValue(expectedUpdateData)

      const result = await paymentsLibraryService.updatePreAuthorizationById(
        preAuthorizationId,
        billingInfo
      )

      expect(result).toEqual(expectedUpdateData)
    })
    it('should throw an error if update fails', async () => {
      const preAuthorizationId = 'test-id'
      const billingInfo = {
        billingInfo: { name: 'John Doe', email: 'john.doe@example.com' },
      }
      jest
        .spyOn(paymentsLibraryRepository, 'updatePreAuthorizationById')
        .mockRejectedValue(new Error('Update failed'))

      await expect(
        paymentsLibraryService.updatePreAuthorizationById(
          preAuthorizationId,
          billingInfo
        )
      ).rejects.toThrow('Update failed')
    })
  })
})
