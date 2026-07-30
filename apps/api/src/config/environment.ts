import { resolve } from 'node:path';

export interface Environment {
  readonly corsAllowedOrigins?: readonly string[];
  host: string;
  maximumUploadBytes: number;
  openAiApiKey: string | undefined;
  openAiModel: string;
  openAiTimeoutMs: number;
  port: number;
  readonly rateLimitMaximumRequests?: number;
  readonly rateLimitWindowMs?: number;
  readonly requestLoggingEnabled?: boolean;
  readonly trustProxy?: boolean;
  uploadStorageDirectory: string;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_MAXIMUM_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_TIMEOUT_MS = 15_000;
const DEFAULT_PORT = 4000;
const DEFAULT_RATE_LIMIT_MAXIMUM_REQUESTS = 120;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  variableName: string,
): number {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${variableName} must be a positive integer.`);
  }

  return parsedValue;
}

export function loadEnvironment(environment: NodeJS.ProcessEnv = process.env): Environment {
  const host = environment.HOST?.trim() || DEFAULT_HOST;

  return {
    corsAllowedOrigins: parseOrigins(environment.CORS_ALLOWED_ORIGINS),
    host,
    maximumUploadBytes: parsePositiveInteger(
      environment.MAX_UPLOAD_BYTES,
      DEFAULT_MAXIMUM_UPLOAD_BYTES,
      'MAX_UPLOAD_BYTES',
    ),
    openAiApiKey: environment.OPENAI_API_KEY?.trim() || undefined,
    openAiModel: environment.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    openAiTimeoutMs: parsePositiveInteger(
      environment.OPENAI_TIMEOUT_MS,
      DEFAULT_OPENAI_TIMEOUT_MS,
      'OPENAI_TIMEOUT_MS',
    ),
    port: parsePort(environment.PORT),
    rateLimitMaximumRequests: parsePositiveInteger(
      environment.RATE_LIMIT_MAX_REQUESTS,
      DEFAULT_RATE_LIMIT_MAXIMUM_REQUESTS,
      'RATE_LIMIT_MAX_REQUESTS',
    ),
    rateLimitWindowMs: parsePositiveInteger(
      environment.RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
      'RATE_LIMIT_WINDOW_MS',
    ),
    requestLoggingEnabled: parseBoolean(environment.REQUEST_LOGGING_ENABLED, true),
    trustProxy: parseBoolean(environment.TRUST_PROXY, false),
    uploadStorageDirectory: resolve(environment.UPLOAD_STORAGE_DIR?.trim() || 'data/uploads'),
  };
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error('Boolean environment values must be either true or false.');
}

function parseOrigins(value: string | undefined): readonly string[] {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        throw new Error(`CORS_ALLOWED_ORIGINS contains an invalid origin: '${origin}'.`);
      }
    });
}
