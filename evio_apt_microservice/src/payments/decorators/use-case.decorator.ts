import { SetMetadata } from '@nestjs/common'
export const USE_CASE_KEY = 'payment:useCase'
export const UseCase = (useCase: string) => SetMetadata(USE_CASE_KEY, useCase)
