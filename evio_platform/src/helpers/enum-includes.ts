export function enumHas<T extends Record<string, string | number>>(
  enumObj: T,
  value: string | number,
): boolean {
  return Object.values(enumObj).includes(value)
}

export function enumHasKey<T extends Record<string, string | number>>(
  enumObj: T,
  value: string,
): boolean {
  return Object.keys(enumObj).includes(value)
}
