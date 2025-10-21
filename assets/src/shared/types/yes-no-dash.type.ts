export type YesNoDash = 'YES' | 'NO' | '-'

export function yesNoDashFromLength(length: number): YesNoDash {
  if (!length) {
    return 'NO'
  }
  if (length === 1) {
    return 'YES'
  }
  return '-'
}
