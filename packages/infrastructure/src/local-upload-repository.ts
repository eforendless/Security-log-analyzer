import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  LogParseSummary,
  LogUpload,
  ParsedLog,
  SecurityEvent,
  UploadRepository,
} from '@security-log-analyzer/domain';

export class LocalUploadRepository implements UploadRepository {
  public constructor(private readonly storageRoot: string) {}

  public async findById(uploadId: string): Promise<LogUpload | undefined> {
    try {
      const content = await readFile(this.metadataPath(uploadId), 'utf8');
      return deserializeUpload(JSON.parse(content) as unknown);
    } catch (error: unknown) {
      if (isErrorWithCode(error, 'ENOENT')) {
        return undefined;
      }

      throw error;
    }
  }

  public async save(upload: LogUpload): Promise<void> {
    await mkdir(this.metadataDirectory, { recursive: true });

    const destinationPath = this.metadataPath(upload.id);
    const temporaryPath = `${destinationPath}.${crypto.randomUUID()}.tmp`;
    const serialized = JSON.stringify({
      ...upload,
      createdAt: upload.createdAt.toISOString(),
    });

    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, destinationPath);
  }

  private get metadataDirectory(): string {
    return join(this.storageRoot, 'metadata');
  }

  private metadataPath(uploadId: string): string {
    return join(this.metadataDirectory, `${uploadId}.json`);
  }
}

function deserializeUpload(value: unknown): LogUpload {
  if (!isRecord(value)) {
    throw new Error('Stored upload metadata is invalid.');
  }

  const {
    byteSize,
    createdAt,
    id,
    mediaType,
    originalFileName,
    parsing,
    sha256,
    status,
    storedFileName,
  } = value;

  if (
    typeof byteSize !== 'number' ||
    !Number.isInteger(byteSize) ||
    byteSize < 0 ||
    typeof createdAt !== 'string' ||
    typeof id !== 'string' ||
    typeof mediaType !== 'string' ||
    typeof originalFileName !== 'string' ||
    typeof sha256 !== 'string' ||
    (status !== 'uploaded' && status !== 'parsed') ||
    typeof storedFileName !== 'string'
  ) {
    throw new Error('Stored upload metadata is invalid.');
  }

  const parsedLog = parsing === undefined ? undefined : deserializeParsedLog(parsing);

  if (status === 'parsed' && parsedLog === undefined) {
    throw new Error('Stored parsed upload metadata is invalid.');
  }

  const parsedCreatedAt = new Date(createdAt);

  if (Number.isNaN(parsedCreatedAt.getTime())) {
    throw new Error('Stored upload metadata contains an invalid creation date.');
  }

  return {
    byteSize,
    createdAt: parsedCreatedAt,
    id,
    mediaType,
    originalFileName,
    parsing: parsedLog,
    sha256,
    status,
    storedFileName,
  };
}

function deserializeParsedLog(value: unknown): ParsedLog {
  if (!isRecord(value) || !Array.isArray(value.events) || !isRecord(value.summary)) {
    throw new Error('Stored parsing metadata is invalid.');
  }

  return {
    events: value.events.map(deserializeSecurityEvent),
    summary: deserializeSummary(value.summary),
  };
}

function deserializeSecurityEvent(value: unknown): SecurityEvent {
  if (!isRecord(value)) {
    throw new Error('Stored security event metadata is invalid.');
  }

  const { eventId, host, level, message, occurredAt, provider, sourceRecord, user } = value;

  if (
    typeof eventId !== 'number' ||
    !Number.isSafeInteger(eventId) ||
    typeof level !== 'string' ||
    typeof message !== 'string' ||
    typeof occurredAt !== 'string' ||
    typeof provider !== 'string' ||
    typeof sourceRecord !== 'number' ||
    !Number.isSafeInteger(sourceRecord) ||
    !isOptionalString(host) ||
    !isOptionalString(user)
  ) {
    throw new Error('Stored security event metadata is invalid.');
  }

  return {
    eventId,
    host,
    level,
    message,
    occurredAt: deserializeDate(
      occurredAt,
      'Stored security event metadata contains an invalid timestamp.',
    ),
    provider,
    sourceRecord,
    user,
  };
}

function deserializeSummary(value: Record<string, unknown>): LogParseSummary {
  const {
    earliestOccurredAt,
    eventCount,
    eventsById,
    eventsByProvider,
    latestOccurredAt,
    skippedRecordCount,
  } = value;

  if (
    typeof eventCount !== 'number' ||
    !Number.isSafeInteger(eventCount) ||
    eventCount < 0 ||
    typeof skippedRecordCount !== 'number' ||
    !Number.isSafeInteger(skippedRecordCount) ||
    skippedRecordCount < 0 ||
    !isCountRecord(eventsById) ||
    !isCountRecord(eventsByProvider) ||
    !isOptionalDateString(earliestOccurredAt) ||
    !isOptionalDateString(latestOccurredAt)
  ) {
    throw new Error('Stored parsing summary metadata is invalid.');
  }

  return {
    earliestOccurredAt:
      earliestOccurredAt === undefined
        ? undefined
        : deserializeDate(earliestOccurredAt, 'Invalid earliest event timestamp.'),
    eventCount,
    eventsById,
    eventsByProvider,
    latestOccurredAt:
      latestOccurredAt === undefined
        ? undefined
        : deserializeDate(latestOccurredAt, 'Invalid latest event timestamp.'),
    skippedRecordCount,
  };
}

function deserializeDate(value: string, errorMessage: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(errorMessage);
  }

  return parsed;
}

function isCountRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (count) => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0,
    )
  );
}

function isOptionalDateString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
