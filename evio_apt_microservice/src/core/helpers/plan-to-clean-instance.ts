import { plainToInstance } from 'class-transformer'

export const plainToCleanInstance = <T>(
  cls: new () => T,
  plainObj: Record<string, any>
): T => {
  const removeNulls = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj
        .map(removeNulls)
        .filter((item) => item !== null && item !== undefined)
    } else if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .map(([key, value]) => [key, removeNulls(value)])
          .filter(([_, value]) => value !== null && value !== undefined)
      )
    }
    return obj
  }

  const cleaned = removeNulls(plainObj)
  return plainToInstance(cls, cleaned, {
    enableCircularCheck: true,
    excludeExtraneousValues: true,
    exposeUnsetFields: false,
  })
}
