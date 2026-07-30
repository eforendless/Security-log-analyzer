import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AlertStatus,
  AlertTriage,
  AlertTriageRepository,
} from '@security-log-analyzer/domain';

export class LocalAlertTriageRepository implements AlertTriageRepository {
  public constructor(private readonly storageRoot: string) {}

  public async findByAlertId(alertId: string): Promise<AlertTriage | undefined> {
    try {
      const content = await readFile(this.triagePath(alertId), 'utf8');
      return deserializeTriage(JSON.parse(content) as unknown, alertId);
    } catch (error: unknown) {
      if (isErrorWithCode(error, 'ENOENT')) {
        return undefined;
      }

      throw error;
    }
  }

  public async save(triage: AlertTriage): Promise<void> {
    await mkdir(this.triageDirectory, { recursive: true });

    const destinationPath = this.triagePath(triage.alertId);
    const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`;
    const serialized = JSON.stringify({
      ...triage,
      updatedAt: triage.updatedAt.toISOString(),
    });

    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, destinationPath);
  }

  private get triageDirectory(): string {
    return join(this.storageRoot, 'alert-triage');
  }

  private triagePath(alertId: string): string {
    return join(this.triageDirectory, `${createHash('sha256').update(alertId).digest('hex')}.json`);
  }
}

function deserializeTriage(value: unknown, expectedAlertId: string): AlertTriage {
  if (!isRecord(value)) {
    throw new Error('Stored alert triage metadata is invalid.');
  }

  const { alertId, note, status, updatedAt } = value;

  if (
    alertId !== expectedAlertId ||
    !isOptionalString(note) ||
    (status !== 'open' && status !== 'triaged') ||
    typeof updatedAt !== 'string'
  ) {
    throw new Error('Stored alert triage metadata is invalid.');
  }

  const parsedUpdatedAt = new Date(updatedAt);

  if (Number.isNaN(parsedUpdatedAt.getTime())) {
    throw new Error('Stored alert triage metadata contains an invalid timestamp.');
  }

  return {
    alertId,
    note,
    status: status as AlertStatus,
    updatedAt: parsedUpdatedAt,
  };
}

function isErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
