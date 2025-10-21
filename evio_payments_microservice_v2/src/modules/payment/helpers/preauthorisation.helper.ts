export function mapExpireDays(preAuthExpiration, paymentMethod): number {
  return preAuthExpiration[paymentMethod] ?? preAuthExpiration.default
}
