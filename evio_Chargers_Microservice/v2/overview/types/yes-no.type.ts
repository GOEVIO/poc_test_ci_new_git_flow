export type YesType = 'YES'
export type NoType = 'NO'

export type YesNoType = YesType | NoType

/**
 * Builds a YesNoType from any casted to boolean
 */
function fromBoolean(b: any): YesNoType {
  return Boolean(b) ? 'YES' : 'NO'
}

export default {
  fromBoolean,
}
