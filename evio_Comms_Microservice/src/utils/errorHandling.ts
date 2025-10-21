import { Response } from 'express';

interface IError {
    statusCode: number,
    error: string | object | Array<unknown>,
    message?: string,
}

const newError = (statusCode: number, error: string | object | Array<unknown>): IError => (
    { statusCode, error }
);

const BadRequest = (error: string | object | Array<unknown>) => newError(400, error);

const Unauthorized = (error: string | object | Array<unknown>) => newError(401, error);

const Forbidden = (error: string | object | Array<unknown>) => newError(403, error);

const ServerError = (error: string | object | Array<unknown>) => newError(500, error);

const errorResponse = (res: Response, customError: IError | never, context: string) => {
    const error = customError.error ?? customError.message;
    const statusCode = customError.statusCode ?? 500;

    console.error(`[code:${statusCode}][${context}] Error `, error);
    return res.status(statusCode).send(error);
};

export {
    BadRequest,
    Unauthorized,
    Forbidden,
    ServerError,
    errorResponse
};