import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as Sentry from '@sentry/node';

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
) => newError(StatusCodes.BAD_REQUEST, error, context);

const Unauthorized = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(StatusCodes.UNAUTHORIZED, error, context);

const NotFound = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(StatusCodes.NOT_FOUND, error, context);

const Forbidden = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(StatusCodes.FORBIDDEN, error, context);

const ServerError = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(StatusCodes.INTERNAL_SERVER_ERROR, error, context);

const Conflict = (
    error: string | object | Array<unknown>,
    context?:string
) => newError(StatusCodes.CONFLICT, error, context);

const errorResponse = (res: Response, customError: IError | never, context: string) => {
    const error = customError.error ?? customError.message;
    const statusCode = customError.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
    const errorContext = customError.context ?? context;

    if (statusCode >= 500) console.error(`[${errorContext}][code:${statusCode}] Error `, error);

    if (statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
        Sentry.captureException(error);
    }

    return res.status(statusCode).send(error);
};

export {
    BadRequest,
    Unauthorized,
    Forbidden,
    ServerError,
    errorResponse,
    NotFound,
    Conflict
};
