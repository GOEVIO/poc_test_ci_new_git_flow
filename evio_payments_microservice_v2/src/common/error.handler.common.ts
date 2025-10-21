export class ErrorHandlerCommon {
    static notfound(code: string, message: string, errorType: string) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 404,
            status: 404
        }
    }

    static unauthorized(code: string, message: string, errorType: string) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 401,
            status: 401
        }
    }

    static forbidden(code: string, message: string, errorType: string) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 403,
            status: 403
        }
    }

    static badrequest(code: string, message: string, errorType: string) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 400,
            status: 400
        }
    }

    static invalid(code: string, message: string, errorType: string, error?:any) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 400,
            status: 400, 
            origin: error
        }
    }

    static conflict(code: string, message: string, errorType: string) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 409,
            status: 409
        }
    }

    static internalservererror(code: string, message: string, errorType: string) {
        return {
            auth: false,
            message: message,
            code: code,
            errorType: errorType,
            statusCode: 500,
            status: 500
        }
    }
}