import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Environment } from './config/environment.js';
import { errorHandler } from './middleware/error-handler.js';
import {
  createCorsMiddleware,
  createRateLimitMiddleware,
  createRequestContextMiddleware,
} from './middleware/http-hardening.js';
import { createAlertsRouter } from './modules/alerts/alerts-router.js';
import { createDashboardRouter } from './modules/dashboard/dashboard-router.js';
import { createHealthRouter } from './modules/health/health-router.js';
import { createUploadsRouter } from './modules/uploads/uploads-router.js';

export function createApp(environment: Environment): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', environment.trustProxy ?? false);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(createRequestContextMiddleware(environment.requestLoggingEnabled ?? false));
  app.use(createCorsMiddleware(environment.corsAllowedOrigins ?? []));
  app.use(
    createRateLimitMiddleware(
      environment.rateLimitMaximumRequests ?? 120,
      environment.rateLimitWindowMs ?? 60_000,
    ),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1/health', createHealthRouter(environment));
  app.use('/api/v1/alerts', createAlertsRouter(environment));
  app.use('/api/v1/dashboard', createDashboardRouter(environment));
  app.use('/api/v1/uploads', createUploadsRouter(environment));
  app.use(errorHandler);

  return app;
}
