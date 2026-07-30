import { mkdir } from 'node:fs/promises';
import { Router } from 'express';
import type { Environment } from '../../config/environment.js';
import { asyncRoute } from '../../middleware/async-route.js';

const healthResponse = {
  status: 'ok',
  service: 'AI Security Log Analyzer API',
  version: '1.0.1',
} as const;

export function createHealthRouter(environment: Environment): Router {
  const router = Router();

  router.get('/live', (_request, response) => {
    response.status(200).json(healthResponse);
  });

  router.get(
    '/ready',
    asyncRoute(async (_request, response) => {
      await mkdir(environment.uploadStorageDirectory, { recursive: true });
      response.status(200).json({ ...healthResponse, status: 'ready' });
    }),
  );

  router.get(
    '/',
    asyncRoute(async (_request, response) => {
      await mkdir(environment.uploadStorageDirectory, { recursive: true });
      response.status(200).json({ ...healthResponse, status: 'ready' });
    }),
  );

  return router;
}
