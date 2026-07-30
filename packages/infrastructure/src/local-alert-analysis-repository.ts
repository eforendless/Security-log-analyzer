import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AlertAnalysis,
  AlertAnalysisRepository,
  AlertSeverity,
  MitreTechnique,
} from '@security-log-analyzer/domain';

const validSeverities = new Set<AlertSeverity>([
  'informational',
  'low',
  'medium',
  'high',
  'critical',
]);

export class LocalAlertAnalysisRepository implements AlertAnalysisRepository {
  public constructor(private readonly storageRoot: string) {}

  public async findByAlertId(alertId: string): Promise<AlertAnalysis | undefined> {
    try {
      const content = await readFile(this.analysisPath(alertId), 'utf8');
      return deserializeAnalysis(JSON.parse(content) as unknown, alertId);
    } catch (error: unknown) {
      if (isErrorWithCode(error, 'ENOENT')) {
        return undefined;
      }

      throw error;
    }
  }

  public async save(analysis: AlertAnalysis): Promise<void> {
    await mkdir(this.analysisDirectory, { recursive: true });

    const destinationPath = this.analysisPath(analysis.alertId);
    const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`;
    const serialized = JSON.stringify({
      ...analysis,
      createdAt: analysis.createdAt.toISOString(),
    });

    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, destinationPath);
  }

  private get analysisDirectory(): string {
    return join(this.storageRoot, 'alert-analysis');
  }

  private analysisPath(alertId: string): string {
    return join(
      this.analysisDirectory,
      `${createHash('sha256').update(alertId).digest('hex')}.json`,
    );
  }
}

function deserializeAnalysis(value: unknown, expectedAlertId: string): AlertAnalysis {
  if (!isRecord(value)) {
    throw new Error('Stored alert analysis is invalid.');
  }

  const {
    alertId,
    confidence,
    createdAt,
    explanation,
    model,
    promptVersion,
    recommendations,
    severity,
    summary,
    techniques,
  } = value;

  if (
    alertId !== expectedAlertId ||
    !isConfidence(confidence) ||
    typeof createdAt !== 'string' ||
    !isNonEmptyString(explanation) ||
    !isNonEmptyString(model) ||
    !isNonEmptyString(promptVersion) ||
    !isStringArray(recommendations) ||
    typeof severity !== 'string' ||
    !validSeverities.has(severity as AlertSeverity) ||
    !isNonEmptyString(summary) ||
    !isMitreTechniques(techniques)
  ) {
    throw new Error('Stored alert analysis is invalid.');
  }

  const parsedCreatedAt = new Date(createdAt);

  if (Number.isNaN(parsedCreatedAt.getTime())) {
    throw new Error('Stored alert analysis contains an invalid timestamp.');
  }

  return {
    alertId,
    confidence,
    createdAt: parsedCreatedAt,
    explanation,
    model,
    promptVersion,
    recommendations,
    severity: severity as AlertSeverity,
    summary,
    techniques,
  };
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isMitreTechniques(value: unknown): value is readonly MitreTechnique[] {
  return (
    Array.isArray(value) &&
    value.every(
      (technique) =>
        isRecord(technique) && isNonEmptyString(technique.id) && isNonEmptyString(technique.name),
    )
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}
