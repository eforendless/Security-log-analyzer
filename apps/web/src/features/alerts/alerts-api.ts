import {
  alertResponseSchema,
  alertsResponseSchema,
  apiErrorResponseSchema,
  type AlertResponse,
  type AlertSeverity,
  type AlertsResponse,
  type AlertStatus,
} from '@security-log-analyzer/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export interface AlertFilters {
  readonly host?: string;
  readonly severity?: AlertSeverity;
  readonly status?: AlertStatus;
}

export async function analyzeAlert(alertId: string): Promise<AlertResponse> {
  return requestAlert(
    `${apiBaseUrl}/alerts/${encodeURIComponent(alertId)}/analysis`,
    'The alert could not be analyzed.',
    { method: 'POST' },
  );
}

export async function getAlert(alertId: string): Promise<AlertResponse> {
  return requestAlert(
    `${apiBaseUrl}/alerts/${encodeURIComponent(alertId)}`,
    'The alert could not be loaded.',
  );
}

export async function getAlerts(filters: AlertFilters = {}): Promise<AlertsResponse> {
  const query = new URLSearchParams();

  if (filters.host !== undefined && filters.host.trim() !== '') {
    query.set('host', filters.host.trim());
  }

  if (filters.severity !== undefined) {
    query.set('severity', filters.severity);
  }

  if (filters.status !== undefined) {
    query.set('status', filters.status);
  }

  const suffix = query.size === 0 ? '' : `?${query.toString()}`;
  const response = await fetch(`${apiBaseUrl}/alerts${suffix}`);
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throwApiError(body, 'The alerts could not be loaded.');
  }

  const result = alertsResponseSchema.safeParse(body);

  if (!result.success) {
    throw new Error('The API returned an invalid alerts response.');
  }

  return result.data;
}

export async function updateAlertTriage(
  alertId: string,
  input: { readonly note: string | null; readonly status: AlertStatus },
): Promise<AlertResponse> {
  return requestAlert(
    `${apiBaseUrl}/alerts/${encodeURIComponent(alertId)}`,
    'The alert triage could not be updated.',
    {
      body: JSON.stringify(input),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH',
    },
  );
}

async function requestAlert(
  url: string,
  fallbackMessage: string,
  init?: RequestInit,
): Promise<AlertResponse> {
  const response = await fetch(url, init);
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throwApiError(body, fallbackMessage);
  }

  const result = alertResponseSchema.safeParse(body);

  if (!result.success) {
    throw new Error('The API returned an invalid alert response.');
  }

  return result.data;
}

function throwApiError(body: unknown, fallbackMessage: string): never {
  const error = apiErrorResponseSchema.safeParse(body);
  throw new Error(error.success ? error.data.error.message : fallbackMessage);
}
