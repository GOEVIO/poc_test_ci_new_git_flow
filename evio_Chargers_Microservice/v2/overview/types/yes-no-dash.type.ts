import { YesNoType } from './yes-no.type'

export type DashType = '-'

export type YesNoDashType = YesNoType | DashType

/**
 * Builds a YesNoDashType from a number
 */
function fromLength(length?: number): YesNoDashType {
  if (!length) {
    return 'NO'
  }
  if (length === 1) {
    return 'YES'
  }
  return '-'
}

export default {
  fromLength,
}
