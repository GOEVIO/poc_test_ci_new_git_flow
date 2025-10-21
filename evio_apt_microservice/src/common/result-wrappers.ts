export type ServiceResult<T = void> = {
  success: boolean
  errorType?: string
  data?: T
  error?: Error
}

export type ControllerResult<T = void> = {
  success: boolean
  message: string
  code?: string // translation code, not status code.
  data?: T
  auth?: boolean
}

export function succeedWithData<T>(
  data: T,
  message = 'success'
): ControllerResult<T> {
  return { data, message, success: true }
}
