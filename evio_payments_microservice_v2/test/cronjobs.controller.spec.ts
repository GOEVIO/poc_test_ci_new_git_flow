import { Test, TestingModule } from '@nestjs/testing'
import { CronjobsController } from '../src/modules/cronjobs/cronjobs.controller'
import { PreAuthorizationRepository } from 'src/paymentsAdyen/repositories/preauthorization.repository'
import { CronService } from 'src/modules/cronjobs/cronjobs.service'
import AdyenAptService from 'src/modules/payment/services/adyen-apt.service'
import { InternalServerErrorException } from '@nestjs/common/exceptions/internal-server-error.exception'

describe('CronjobsController', () => {
  let controller: CronjobsController
  let preAuthorizationRepository: PreAuthorizationRepository
  let preAuthList = [
    {
      adyenReference: 'PSP12345',
      transactionId: 'TX12345',
      amount: { value: 2000, currency: 'EUR' },
      expireDate: new Date(Date.now()),
      blobPreAuthorization: '<blob>',
    },
  ]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CronjobsController],
      providers: [
        CronService,
        { provide: AdyenAptService, useValue: { updatePreAuthorisationApt: jest.fn() } },
        {
          provide: PreAuthorizationRepository,
          useValue: {
            findNextToExpire: jest.fn().mockResolvedValue(preAuthList),
          },
        },
      ],
    }).compile()
    controller = module.get<CronjobsController>(CronjobsController)
    preAuthorizationRepository = module.get<PreAuthorizationRepository>(PreAuthorizationRepository)
  })

  it('should return list of pre-authorizations', async () => {
    const result = await controller.extendPreAuthorisation()
    expect(result).toEqual(preAuthList)
  })

  it('error fetching the database', async () => {
    jest.spyOn(preAuthorizationRepository, 'findNextToExpire').mockRejectedValueOnce(new Error('Database error'))
    await expect(controller.extendPreAuthorisation()).rejects.toThrow(InternalServerErrorException)
  })
})
