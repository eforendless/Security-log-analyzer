import {
  apiErrorResponseSchema,
  dashboardResponseSchema,
  type DashboardResponse,
} from '@security-log-analyzer/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await fetch(`${apiBaseUrl}/dashboard`);
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error.message : 'The dashboard could not be loaded.',
    );
  }

  const result = dashboardResponseSchema.safeParse(body);

  if (!result.success) {
    throw new Error('The API returned an invalid dashboard response.');
  }

  return result.data;
}
