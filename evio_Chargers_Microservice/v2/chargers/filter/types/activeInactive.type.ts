export type ActiveInactiveType = 'ACTIVE' | 'INACTIVE'

export function isActive(value?: string): boolean | undefined {
  const stringValue = String(value).toUpperCase()
  if (stringValue === 'ACTIVE') {
    return true
  }
  if (stringValue === 'INACTIVE') {
    return false
  }
  return undefined
}

export function ActiveInactiveFromBoolean(value?: boolean): ActiveInactiveType {
  return value
    ? 'ACTIVE'
    : 'INACTIVE'
}
