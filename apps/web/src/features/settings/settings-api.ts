import {
  apiErrorResponseSchema,
  settingsResponseSchema,
  type SettingsResponse,
} from '@security-log-analyzer/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export async function getSettings(): Promise<SettingsResponse> {
  const response = await fetch(`${apiBaseUrl}/settings`);
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(body);
    throw new Error(error.success ? error.data.error.message : 'The settings could not be loaded.');
  }

  const result = settingsResponseSchema.safeParse(body);

  if (!result.success) {
    throw new Error('The API returned an invalid settings response.');
  }

  return result.data;
}
