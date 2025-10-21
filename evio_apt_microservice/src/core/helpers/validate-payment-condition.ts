import { isEmptyObject } from 'evio-library-commons'

export const validatePaymentCondition = (
  preAuthorization: any
): { valid: boolean; message: string; code: string } => {
  if (!preAuthorization) {
    return {
      valid: false,
      message: 'Invalid payment condition, not found pre authorization',
      code: 'not_found_pre_authorization',
    }
  }

  if (typeof preAuthorization !== 'object') {
    return {
      valid: false,
      message: 'Invalid format payment condition',
      code: 'invalid_format_pre_authorization',
    }
  }

  if (isEmptyObject(preAuthorization)) {
    return {
      valid: false,
      message: 'Invalid payment condition, empty pre authorization',
      code: 'pre_authorization_empty',
    }
  }

  if (!preAuthorization.active) {
    return {
      valid: false,
      message: 'Invalid payment condition, pre authorization is not active',
      code: 'pre_authorization_not_active',
    }
  }

  if (
    !preAuthorization.expireDate ||
    new Date(preAuthorization.expireDate) < new Date()
  ) {
    return {
      valid: false,
      message: 'Invalid payment condition, pre authorization is expired',
      code: 'pre_authorization_expired',
    }
  }

  return {
    valid: true,
    message: 'Valid payment condition',
    code: 'valid_payment_condition',
  }
}
