import { settingsResponseSchema } from '@security-log-analyzer/contracts';
import { Router } from 'express';
import type { Environment } from '../../config/environment.js';

export function createSettingsRouter(environment: Environment): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json(
      settingsResponseSchema.parse({
        settings: {
          aiAnalysis: {
            configured: environment.openAiApiKey !== undefined,
            model: environment.openAiModel,
            timeoutMs: environment.openAiTimeoutMs,
          },
          maximumUploadBytes: environment.maximumUploadBytes,
        },
      }),
    );
  });

  return router;
}
