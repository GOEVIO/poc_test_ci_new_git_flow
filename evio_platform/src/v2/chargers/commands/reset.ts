import { enumHasKey } from '@/helpers/enum-includes'
import {
  ResetParameters,
  UpperCaseResetParameters,
} from '../enum/reset-parameters'
import { BadRequestException } from "@nestjs/common";

export function reset(): never
export function reset(resetParameter: ResetParameters): ResetParameters
export function reset(
    resetParameter: ResetParameters | undefined,
): ResetParameters | never
export function reset(
    resetParameter?: ResetParameters,
): ResetParameters | never {
  if (
      !resetParameter ||
      !enumHasKey(ResetParameters, resetParameter.toUpperCase())
  ) {
    throw new BadRequestException('Action parameter "Soft" or "Hard" is required')
  }
  return ResetParameters[
      resetParameter.toUpperCase() as UpperCaseResetParameters
      ]
}
