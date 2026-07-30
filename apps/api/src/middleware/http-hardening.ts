import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

export function createCorsMiddleware(allowedOrigins: readonly string[]): RequestHandler {
  const configuredOrigins = new Set(allowedOrigins);

  return (request, response, next) => {
    const origin = request.get('origin');

    if (origin === undefined) {
      next();
      return;
    }

    if (!configuredOrigins.has(origin)) {
      response.status(403).json({
        error: {
          code: 'CORS_ORIGIN_DENIED',
          message: 'This origin is not permitted to access the API.',
        },
      });
      return;
    }

    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'content-type, x-request-id');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');

    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }

    next();
  };
}

export function createRateLimitMiddleware(
  maximumRequests: number,
  windowMs: number,
): RequestHandler {
  return rateLimit({
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please retry later.',
        },
      });
    },
    legacyHeaders: false,
    limit: maximumRequests,
    skip: (request) => request.path.startsWith('/api/v1/health'),
    standardHeaders: 'draft-8',
    windowMs,
  });
}

export function createRequestContextMiddleware(enabled: boolean): RequestHandler {
  return (request, response, next) => {
    const suppliedRequestId = request.get('x-request-id');
    const requestId = isUuid(suppliedRequestId) ? suppliedRequestId : randomUUID();
    const path = request.originalUrl.split('?', 1)[0] ?? request.path;
    const startedAt = process.hrtime.bigint();

    response.setHeader('X-Request-Id', requestId);
    response.on('finish', () => {
      if (!enabled) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      console.info(
        JSON.stringify({
          durationMs: Math.round(durationMs),
          method: request.method,
          path,
          requestId,
          statusCode: response.statusCode,
        }),
      );
    });

    next();
  };
}

function isUuid(value: string | undefined): value is string {
  return (
    value !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  );
}
