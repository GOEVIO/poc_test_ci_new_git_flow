import { Response } from 'express';
import { captureException } from "@sentry/node";

interface IError {
    statusCode: number,
    error: string | object | Array<unknown>,
    message?: string,
    context?: string
}

const newError = (
    statusCode: number,
    error: string | object | Array<unknown>,
    context?: string
): IError => (
    { statusCode, error, context }
);

const BadRequest = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(400, error, context);

const Unauthorized = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(401, error, context);

const NotFound = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(404, error, context);

const Forbidden = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(403, error, context);

const ServerError = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(500, error, context);

const errorResponse = (res: Response, customError: IError | never, context: string) => {
    const error = customError.error ?? customError.message;
    const statusCode = customError.statusCode ?? 500;
    const errorContext = customError.context ?? context;
    if(statusCode == 500)captureException(new Error(`Error - ${error} ${errorContext}`))
    console.error(`[code:${statusCode}][${errorContext}] Error `, error);
    return res.status(statusCode).send(error);
};

export {
    BadRequest,
    Unauthorized,
    Forbidden,
    ServerError,
    errorResponse,
    NotFound
};
