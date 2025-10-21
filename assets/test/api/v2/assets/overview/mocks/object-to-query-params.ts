function entryToQueryString(e: [string, unknown]): string {
  return `${e[0]}=${String(e[1])}`
}

export function objectToQueryString(obj: unknown): string {
  if (!obj) {
    return ''
  }
  return Object.entries(obj).map(entryToQueryString).join('&')
}
