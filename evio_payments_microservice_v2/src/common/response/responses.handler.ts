export class ErrorHandler {
  compose(error: any, data?: any) {
    if (error.errorType) {
      return {
        auth: false,
        status: error?.statusCode ?? error?.status,
        message: error?.message,
        errorType: error?.errorType,
        pspReference: error?.pspReference,
        origin: error?.origin,
        code: error?.code,
      }
    }

    return {
      auth: false,
      status: error.status ?? 500,
      message: error,
      code: error.code ?? 'server_internal_error',
    }
  }
}

export class SuccessHandler {
  composeWithInfo(status: number, code: string, message: string, info?: any) {
    var messageResponse = { auth: true, code, message, info }
    return messageResponse
  }

  composeWithoutInfo(status: number) {
    let successResponse: any
    successResponse = {
      auth: true,
      code: status,
      message: 'Operation was successful',
    }
    return successResponse
  }
}
