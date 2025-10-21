import { Test, TestingModule } from '@nestjs/testing'
import { PaymentController } from '../src/modules/payment/controllers/payment.controller'
import PaymentService from '../src/modules/payment/services/payment.service'
import { AptPreAuthorisationDto } from '../src/modules/payment/dto/apt-pre-authorisation.dto'
import AptStrategy from '../src/modules/payment/classes/apt-strategy.class'
import AdyenAptService from '../src/modules/payment/services/adyen-apt.service'
import { AdyenAdapter } from '../src/modules/payment/adapters/adyen.adapter'
import { PreAuthorizationRepository } from '../src/paymentsAdyen/repositories/preauthorization.repository'
import PaymentContext from '../src/modules/payment/classes/payment-context.class'
import { PaymentsRepository } from '../src/paymentsAdyen/repositories/payment.repository'
import { TransactionsRepository } from '../src/paymentsAdyen/repositories/transations.repository '
import { ConfigModule } from '@nestjs/config'
import {
  adjustPreAuthorisationSuccessResponse,
  cancelAuthoriseSuccessResponse,
  captureSuccessResponse,
  identifyUserSuccessResponse,
  preAuthorisationSuccessResponse,
  preAuthorisationFailureResponse,
  cancelAuthoriseFailureResponse,
  captureFailureResponse,
} from './helpers/mocked-responses'
import { AdjustPreAuthorisationDto } from '../src/modules/payment/dto/ajust-pre-authorisation.dto'
import { CancelPreAuthorisationDto } from '../src/modules/payment/dto/cancel-pre-authorisation.dto'
import { CaptureDto } from '../src/modules/payment/dto/capture.dto'
import { AptIdentifyUserDto } from '../src/modules/payment/dto/apt-identify-user.dto'
import { BadRequestException } from '@nestjs/common'
import config from '../src/core/config'
import { DtoRegistry } from '../src/modules/payment/registry/dto.registry'

describe('PaymentController-APT', () => {
  let controller: PaymentController
  let service: PaymentService
  let aptStrategy: AptStrategy
  let adyenAdapter: AdyenAdapter
  let preAuthorizationRepository: PreAuthorizationRepository

  beforeEach(async () => {
    const mockPreAuthorisationId = 'mocked-pre-auth-id'
    const mockPaymentId = 'mocked-payment-id'
    const mockTransactionId = 'mocked-transaction-id'
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [config],
        }),
      ],
      controllers: [PaymentController],
      providers: [
        {
          provide: AdyenAdapter,
          useValue: {
            preAuthoriseApt: jest.fn().mockResolvedValue(preAuthorisationSuccessResponse),
            updatePreAuthorisationApt: jest.fn().mockResolvedValue(adjustPreAuthorisationSuccessResponse),
            cancelPreAuthorisation: jest.fn().mockResolvedValue(cancelAuthoriseSuccessResponse),
            capture: jest.fn().mockResolvedValue(captureSuccessResponse),
            identifyUserApt: jest.fn().mockResolvedValue(identifyUserSuccessResponse),
          },
        },
        PaymentContext,
        AptStrategy,
        AdyenAptService,
        {
          provide: PreAuthorizationRepository,
          useValue: {
            insert: jest.fn().mockResolvedValue({ id: mockPreAuthorisationId }),
            updateByReferenceId: jest.fn().mockResolvedValue(true),
            findOne: jest.fn().mockResolvedValue({ id: mockPreAuthorisationId }),
          },
        },
        { provide: PaymentsRepository, useValue: { insert: jest.fn().mockResolvedValue({ id: mockPaymentId }) } },
        { provide: TransactionsRepository, useValue: { insert: jest.fn().mockResolvedValue({ id: mockTransactionId }) } },
        PaymentService,
        DtoRegistry,
      ],
    }).compile()

    preAuthorizationRepository = module.get<PreAuthorizationRepository>(PreAuthorizationRepository)
    adyenAdapter = module.get<AdyenAdapter>(AdyenAdapter)
    controller = module.get<PaymentController>(PaymentController)
    service = module.get<PaymentService>(PaymentService)
    aptStrategy = module.get<AptStrategy>(AptStrategy)
  })

  it('POST /preauthorisation with success', async () => {
    service.setStrategy(aptStrategy)
    const dto: AptPreAuthorisationDto = new AptPreAuthorisationDto()
    dto.amount = 40
    dto.currency = 'EUR'
    dto.serial = 'S1U2-000573232202276'

    const response = await controller.preAuthorise(dto)
    expect(response).toHaveProperty('SaleToPOIResponse.PaymentResponse.PaymentResult.PaymentInstrumentData')
    expect(response).toHaveProperty('preAuthorisationId')
    expect(response).toHaveProperty('userCardHash')
    expect(response?.SaleToPOIResponse?.PaymentResponse?.Response?.Result).toBe('Success')
  })

  it('POST /preauthorisation with failure', async () => {
    service.setStrategy(aptStrategy)
    const dto: AptPreAuthorisationDto = new AptPreAuthorisationDto()
    dto.amount = 40
    dto.currency = 'EUR'
    dto.serial = 'S1U2-000573232202276'

    jest.spyOn(adyenAdapter, 'preAuthoriseApt').mockResolvedValueOnce(preAuthorisationFailureResponse)

    await expect(controller.preAuthorise(dto)).rejects.toThrow(BadRequestException)
  })

  it('PATCH /preauthorisation with success', async () => {
    service.setStrategy(aptStrategy)
    const dto: AdjustPreAuthorisationDto = new AdjustPreAuthorisationDto()
    dto.amount = 5000
    dto.currency = 'EUR'
    dto.originalReference = 'VPSBFF7C4F7B6R75'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'
    dto.adjustAuthorisationData = 'mocked-blob'

    const response = await controller.updatePreAuthorisation(dto)
    expect(response.response).toBe('Authorised')
  })

  it('PATCH /preauthorisation with failure -- no preAuthorisation found', async () => {
    service.setStrategy(aptStrategy)
    const dto: AdjustPreAuthorisationDto = new AdjustPreAuthorisationDto()
    dto.amount = 5000
    dto.currency = 'EUR'
    dto.originalReference = 'VPSBFF7C4F7B6R75'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'
    dto.adjustAuthorisationData = 'mocked-blob'

    jest.spyOn(preAuthorizationRepository, 'findOne').mockResolvedValueOnce(null)

    await expect(controller.updatePreAuthorisation(dto)).rejects.toThrow(BadRequestException)
  })

  it('PATCH /preauthorisation with failure -- adyen response', async () => {
    service.setStrategy(aptStrategy)
    const dto: AdjustPreAuthorisationDto = new AdjustPreAuthorisationDto()
    dto.amount = 5000
    dto.currency = 'EUR'
    dto.originalReference = 'VPSBFF7C4F7B6R75'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'
    dto.adjustAuthorisationData = 'mocked-blob'

    jest.spyOn(adyenAdapter, 'updatePreAuthorisationApt').mockResolvedValueOnce(preAuthorisationFailureResponse)

    await expect(controller.updatePreAuthorisation(dto)).rejects.toThrow(BadRequestException)
  })

  it('DELETE /preauthorisation with success', async () => {
    service.setStrategy(aptStrategy)
    const dto: CancelPreAuthorisationDto = new CancelPreAuthorisationDto()
    dto.originalReference = 'VPSBFF7C4F7B6R75'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'

    const response = await controller.cancelPreAuthorisation(dto)
    expect(response.pspReference).toBe('VPSBFF7C4F7B6R75')
    expect(response.response).toBe('[cancel-received]')
  })

  it('DELETE /preauthorisation with failure -- no preAuthorisation found', async () => {
    service.setStrategy(aptStrategy)
    const dto: CancelPreAuthorisationDto = new CancelPreAuthorisationDto()
    dto.originalReference = 'VPSBFF7C4F7B6R75'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'

    jest.spyOn(preAuthorizationRepository, 'findOne').mockResolvedValueOnce(null)
    await expect(controller.cancelPreAuthorisation(dto)).rejects.toThrow(BadRequestException)
  })

  it('DELETE /preauthorisation with failure -- adyen response', async () => {
    service.setStrategy(aptStrategy)
    const dto: CancelPreAuthorisationDto = new CancelPreAuthorisationDto()
    dto.originalReference = 'VPSBFF7C4F7B6R75'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'

    jest.spyOn(adyenAdapter, 'cancelPreAuthorisation').mockResolvedValueOnce(cancelAuthoriseFailureResponse)

    await expect(controller.cancelPreAuthorisation(dto)).rejects.toThrow(BadRequestException)
  })

  it('POST /capture with success', async () => {
    service.setStrategy(aptStrategy)
    const dto: CaptureDto = new CaptureDto()
    dto.amount = 1000
    dto.currency = 'EUR'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'
    dto.originalReference = 'VPSBFF7C4F7B6R75'

    const response = await controller.capture(dto)
    expect(response.pspReference).toBe('VPSBFF7C4F7B6R75')
    expect(response.response).toBe('[capture-received]')
  })

  it('POST /capture with failure -- no preAuthorisation found', async () => {
    service.setStrategy(aptStrategy)
    const dto: CaptureDto = new CaptureDto()
    dto.amount = 1000
    dto.currency = 'EUR'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'
    dto.originalReference = 'VPSBFF7C4F7B6R75'

    jest.spyOn(preAuthorizationRepository, 'findOne').mockResolvedValueOnce(null)

    await expect(controller.capture(dto)).rejects.toThrow(BadRequestException)
  })

  it('POST /capture with failure -- adyen response', async () => {
    service.setStrategy(aptStrategy)
    const dto: CaptureDto = new CaptureDto()
    dto.amount = 1000
    dto.currency = 'EUR'
    dto.merchantReference = '0198a7e0-cee8-722e-851f-fd3ea74b6760'
    dto.originalReference = 'VPSBFF7C4F7B6R75'

    jest.spyOn(adyenAdapter, 'capture').mockResolvedValueOnce(captureFailureResponse)

    await expect(controller.capture(dto)).rejects.toThrow(BadRequestException)
  })

  it('POST /identify with success', async () => {
    service.setStrategy(aptStrategy)
    const dto: AptIdentifyUserDto = new AptIdentifyUserDto()
    dto.serial = 'S1U2-000573232202276'

    const response = await controller.identify(dto)
    expect(response).toHaveProperty('userCardHash')
  })

  it('POST /identify with failure', async () => {
    service.setStrategy(aptStrategy)
    const dto: AptIdentifyUserDto = new AptIdentifyUserDto()
    dto.serial = 'S1U2-000573232202276'

    jest.spyOn(adyenAdapter, 'identifyUserApt').mockRejectedValueOnce(new Error())

    await expect(controller.identify(dto)).rejects.toThrow(BadRequestException)
  })
})
