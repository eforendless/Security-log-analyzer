import {
  AlertNotFoundError,
  AlertValidationError,
  UploadNotFoundError,
  UploadValidationError,
} from '@security-log-analyzer/application';
import {
  SecurityAnalysisProviderError,
  SecurityAnalysisUnavailableError,
  TextLogParseError,
} from '@security-log-analyzer/domain';
import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

function errorResponse(code: string, message: string): ErrorResponse {
  return { error: { code, message } };
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  void _next;

  if (error instanceof SyntaxError) {
    response
      .status(400)
      .json(errorResponse('INVALID_REQUEST', 'The request body must contain valid JSON.'));
    return;
  }

  if (error instanceof AlertValidationError) {
    response.status(400).json(errorResponse('INVALID_ALERT_REQUEST', error.message));
    return;
  }

  if (error instanceof AlertNotFoundError) {
    response.status(404).json(errorResponse('ALERT_NOT_FOUND', error.message));
    return;
  }

  if (error instanceof SecurityAnalysisUnavailableError) {
    response.status(503).json(errorResponse('AI_ANALYSIS_UNAVAILABLE', error.message));
    return;
  }

  if (error instanceof SecurityAnalysisProviderError) {
    response.status(502).json(errorResponse('AI_ANALYSIS_FAILED', error.message));
    return;
  }

  if (error instanceof UploadValidationError) {
    response.status(400).json(errorResponse('INVALID_UPLOAD', error.message));
    return;
  }

  if (error instanceof TextLogParseError) {
    response.status(422).json(errorResponse('INVALID_LOG_CONTENT', error.message));
    return;
  }

  if (error instanceof UploadNotFoundError) {
    response.status(404).json(errorResponse('UPLOAD_NOT_FOUND', error.message));
    return;
  }

  if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
    response
      .status(413)
      .json(errorResponse('FILE_TOO_LARGE', 'The uploaded file exceeds the allowed size.'));
    return;
  }

  if (error instanceof MulterError) {
    response.status(400).json(errorResponse('INVALID_UPLOAD', error.message));
    return;
  }

  console.error('Unhandled API error.', error);
  response.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.'));
};
