import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      res.status(status).json(toErrorBody(response, status));
      return;
    }

    this.logger.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    } satisfies ErrorBody);
  }
}

function toErrorBody(response: unknown, status: number): ErrorBody {
  if (typeof response === 'object' && response !== null && 'error' in response) {
    return response as ErrorBody;
  }

  if (typeof response === 'string') {
    return { error: { code: defaultCode(status), message: response } };
  }

  if (typeof response === 'object' && response !== null && 'message' in response) {
    const msg = (response as { message: unknown }).message;
    return {
      error: {
        code: defaultCode(status),
        message: Array.isArray(msg) ? msg.join(', ') : String(msg),
      },
    };
  }

  return { error: { code: defaultCode(status), message: HttpStatus[status] ?? 'Error' } };
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'ERROR';
  }
}
