import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import config from '../config';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    sendError(
      res,
      'VALIDATION_ERROR',
      'Validation failed',
      422,
      err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
    );
    return;
  }

  // Custom AppError
  if (err instanceof AppError) {
    sendError(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      sendError(res, 'DUPLICATE_ENTRY', 'Resource already exists', 409);
      return;
    }
    if (prismaError.code === 'P2025') {
      sendError(res, 'NOT_FOUND', 'Resource not found', 404);
      return;
    }
  }

  // Default error
  const message = config.nodeEnv === 'production' ? 'Internal server error' : err.message;
  sendError(res, 'INTERNAL_ERROR', message, 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  sendError(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
};
