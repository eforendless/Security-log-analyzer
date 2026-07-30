import { resolve } from 'node:path';

export interface Environment {
  host: string;
  maximumUploadBytes: number;
  port: number;
  uploadStorageDirectory: string;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_MAXIMUM_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_PORT = 4000;

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
    host,
    maximumUploadBytes: parsePositiveInteger(
      environment.MAX_UPLOAD_BYTES,
      DEFAULT_MAXIMUM_UPLOAD_BYTES,
      'MAX_UPLOAD_BYTES',
    ),
    port: parsePort(environment.PORT),
    uploadStorageDirectory: resolve(environment.UPLOAD_STORAGE_DIR?.trim() || 'data/uploads'),
  };
}
