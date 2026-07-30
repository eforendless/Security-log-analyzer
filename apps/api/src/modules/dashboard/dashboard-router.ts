import { GetDashboardMetrics } from '@security-log-analyzer/application';
import { dashboardResponseSchema } from '@security-log-analyzer/contracts';
import { LocalUploadRepository } from '@security-log-analyzer/infrastructure';
import { Router } from 'express';
import type { Environment } from '../../config/environment.js';
import { asyncRoute } from '../../middleware/async-route.js';
import { toDashboardResponse } from './dashboard-response.js';

export function createDashboardRouter(environment: Environment): Router {
  const router = Router();
  const uploadRepository = new LocalUploadRepository(environment.uploadStorageDirectory);
  const getDashboardMetrics = new GetDashboardMetrics(uploadRepository);

  router.get(
    '/',
    asyncRoute(async (_request, response) => {
      const metrics = await getDashboardMetrics.execute();
      response.status(200).json(dashboardResponseSchema.parse(toDashboardResponse(metrics)));
    }),
  );

  return router;
}
