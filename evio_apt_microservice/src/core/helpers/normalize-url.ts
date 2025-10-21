export const normalizeURL = (host: string, path: string): string => {
  const normalizedHost = host.endsWith('/') ? host.slice(0, -1) : host
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedHost}${normalizedPath}`
}
