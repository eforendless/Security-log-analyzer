import express, { type Express } from 'express';
import type { Environment } from './config/environment.js';
import { errorHandler } from './middleware/error-handler.js';
import { createHealthRouter } from './modules/health/health-router.js';
import { createUploadsRouter } from './modules/uploads/uploads-router.js';

export function createApp(environment: Environment): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use('/api/v1/health', createHealthRouter());
  app.use('/api/v1/uploads', createUploadsRouter(environment));
  app.use(errorHandler);

  return app;
}
