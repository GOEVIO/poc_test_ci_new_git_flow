import { captureException } from '@sentry/node';
import type { Response } from 'express';

export type ErrorPayload = string | Record<string, unknown> | Array<any>;

export interface AppError {
  statusCode: number;
  error: ErrorPayload;
  context?: string;
}

export interface CustomErrorInput {
  statusCode?: number;
  error?: ErrorPayload;
  message?: string;
  context?: string;
}

const newError = (
  statusCode: number,
  error: ErrorPayload,
  context?: string
): AppError => ({
  statusCode,
  error,
  context,
});

export const BadRequest = (error: ErrorPayload, context?: string): AppError =>
  newError(400, error, context);

export const Unauthorized = (error: ErrorPayload, context?: string): AppError =>
  newError(401, error, context);

export const Forbidden = (error: ErrorPayload, context?: string): AppError =>
  newError(403, error, context);

export const NotFound = (error: ErrorPayload, context?: string): AppError =>
  newError(404, error, context);

export const Conflict = (error: ErrorPayload, context?: string): AppError =>
  newError(409, error, context);

export const ServerError = (error: ErrorPayload, context?: string): AppError =>
  newError(500, error, context);

export const errorResponse = (
  res: Response,
  customError: CustomErrorInput,
  context?: string
): Response => {
  const error: ErrorPayload | undefined =
    customError.error ?? customError.message;
  const statusCode = customError.statusCode ?? 500;
  const errorContext = customError.context ?? context;

  if (statusCode === 500) {
    captureException(new Error(`Error - ${String(error)} ${errorContext ?? ''}`));
  }

  console.error(`[code:${statusCode}][${errorContext}] Error`, error);
  return res.status(statusCode).send(error);
};
