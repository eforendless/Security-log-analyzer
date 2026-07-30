import {
  AlertValidationError,
  AnalyzeAlert,
  GetAlert,
  ListAlerts,
  UpdateAlertTriage,
} from '@security-log-analyzer/application';
import {
  alertResponseSchema,
  alertSeveritySchema,
  alertsResponseSchema,
  alertStatusSchema,
  updateAlertTriageRequestSchema,
} from '@security-log-analyzer/contracts';
import {
  BoundedSensitiveDataRedactor,
  LocalAlertAnalysisRepository,
  LocalAlertTriageRepository,
  LocalUploadRepository,
  OpenAiSecurityAnalysisProvider,
  UnavailableSecurityAnalysisProvider,
} from '@security-log-analyzer/infrastructure';
import { Router, type Request } from 'express';
import type { Environment } from '../../config/environment.js';
import { asyncRoute } from '../../middleware/async-route.js';
import { toAlertDetail, toAlertsResponse } from './alert-response.js';

export function createAlertsRouter(environment: Environment): Router {
  const router = Router();
  const uploadRepository = new LocalUploadRepository(environment.uploadStorageDirectory);
  const triageRepository = new LocalAlertTriageRepository(environment.uploadStorageDirectory);
  const analysisRepository = new LocalAlertAnalysisRepository(environment.uploadStorageDirectory);
  const listAlerts = new ListAlerts(uploadRepository, triageRepository);
  const getAlert = new GetAlert(uploadRepository, triageRepository, analysisRepository);
  const updateAlertTriage = new UpdateAlertTriage({
    now: () => new Date(),
    triageRepository,
    uploadRepository,
  });
  const analysisProvider =
    environment.openAiApiKey === undefined
      ? new UnavailableSecurityAnalysisProvider()
      : new OpenAiSecurityAnalysisProvider({
          apiKey: environment.openAiApiKey,
          model: environment.openAiModel,
          timeoutMs: environment.openAiTimeoutMs,
        });
  const analyzeAlert = new AnalyzeAlert({
    analysisRepository,
    now: () => new Date(),
    provider: analysisProvider,
    redactor: new BoundedSensitiveDataRedactor(),
    triageRepository,
    uploadRepository,
  });

  router.get(
    '/',
    asyncRoute(async (request, response) => {
      const alerts = await listAlerts.execute(readFilters(request));
      response.status(200).json(alertsResponseSchema.parse(toAlertsResponse(alerts)));
    }),
  );

  router.get(
    '/:alertId',
    asyncRoute(async (request, response) => {
      const alert = await getAlert.execute(readAlertId(request));
      response.status(200).json(alertResponseSchema.parse({ alert: toAlertDetail(alert) }));
    }),
  );

  router.patch(
    '/:alertId',
    asyncRoute(async (request, response) => {
      const parsedRequest = updateAlertTriageRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        throw new AlertValidationError('The alert triage request is invalid.');
      }

      const alert = await updateAlertTriage.execute({
        alertId: readAlertId(request),
        note: parsedRequest.data.note ?? undefined,
        status: parsedRequest.data.status,
      });

      response.status(200).json(alertResponseSchema.parse({ alert: toAlertDetail(alert) }));
    }),
  );

  router.post(
    '/:alertId/analysis',
    asyncRoute(async (request, response) => {
      const alertId = readAlertId(request);
      await analyzeAlert.execute(alertId);
      const alert = await getAlert.execute(alertId);
      response.status(200).json(alertResponseSchema.parse({ alert: toAlertDetail(alert) }));
    }),
  );

  return router;
}

function readAlertId(request: Request): string {
  const alertId = request.params.alertId;

  if (typeof alertId !== 'string' || alertId.trim() === '') {
    throw new AlertValidationError('The alert ID is required.');
  }

  return alertId;
}

function readFilters(request: Request) {
  const severity = parseSeverityQuery(request);
  const status = parseStatusQuery(request);
  const host = readOptionalQuery(request, 'host')?.trim();
  const from = parseDateQuery(request, 'from');
  const to = parseDateQuery(request, 'to');

  if (from !== undefined && to !== undefined && from > to) {
    throw new AlertValidationError("The 'from' timestamp must be before the 'to' timestamp.");
  }

  return {
    from,
    host: host === '' ? undefined : host,
    severity,
    status,
    to,
  };
}

function parseDateQuery(request: Request, key: 'from' | 'to'): Date | undefined {
  const value = readOptionalQuery(request, key);

  if (value === undefined) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AlertValidationError(`The '${key}' query value must be a valid timestamp.`);
  }

  return parsed;
}

function parseSeverityQuery(request: Request) {
  const value = readOptionalQuery(request, 'severity');

  if (value === undefined) {
    return undefined;
  }

  const parsed = alertSeveritySchema.safeParse(value);

  if (!parsed.success) {
    throw new AlertValidationError("The 'severity' query value is invalid.");
  }

  return parsed.data;
}

function parseStatusQuery(request: Request) {
  const value = readOptionalQuery(request, 'status');

  if (value === undefined) {
    return undefined;
  }

  const parsed = alertStatusSchema.safeParse(value);

  if (!parsed.success) {
    throw new AlertValidationError("The 'status' query value is invalid.");
  }

  return parsed.data;
}

function readOptionalQuery(
  request: Request,
  key: 'from' | 'host' | 'severity' | 'status' | 'to',
): string | undefined {
  const value = request.query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AlertValidationError(`The '${key}' query value must be a single string.`);
  }

  return value;
}
