import { Router } from 'express';

const healthResponse = {
  status: 'ok',
  service: 'AI Security Log Analyzer API',
  version: '1.0.0',
} as const;

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(healthResponse);
  });

  return router;
}
