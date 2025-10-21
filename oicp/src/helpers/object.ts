export const sumObjectValues = (obj: Record<string, number>): number => {
  return Object.values(obj).reduce((a, b) => a + b, 0)
}

export const isEmptyObject = (obj): any => {
  for (let key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return false
    }
  }
  return true
}
