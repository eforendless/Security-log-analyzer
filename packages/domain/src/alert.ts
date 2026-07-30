import type { AlertAnalysis } from './alert-analysis.js';
import type { LogUpload, SecurityEvent } from './log-upload.js';

export const alertSeverities = ['informational', 'low', 'medium', 'high', 'critical'] as const;
export const alertStatuses = ['open', 'triaged'] as const;

export type AlertSeverity = (typeof alertSeverities)[number];
export type AlertStatus = (typeof alertStatuses)[number];

export interface Alert {
  readonly analysis?: AlertAnalysis;
  readonly evidence: AlertEvidence;
  readonly id: string;
  readonly severity: AlertSeverity;
  readonly status: AlertStatus;
  readonly triageNote: string | undefined;
  readonly triageUpdatedAt: Date | undefined;
  readonly uploadId: string;
}

export interface AlertEvidence {
  readonly eventId: number;
  readonly host: string | undefined;
  readonly level: string;
  readonly message: string;
  readonly occurredAt: Date;
  readonly provider: string;
  readonly sourceRecord: number;
  readonly user: string | undefined;
}

export interface AlertTriage {
  readonly alertId: string;
  readonly note: string | undefined;
  readonly status: AlertStatus;
  readonly updatedAt: Date;
}

export interface AlertTriageRepository {
  findByAlertId(alertId: string): Promise<AlertTriage | undefined>;
  save(triage: AlertTriage): Promise<void>;
}

export function deriveAlertId(uploadId: string, sourceRecord: number): string {
  return `alert-${uploadId}-${sourceRecord}`;
}

export function projectAlert(
  upload: LogUpload,
  event: SecurityEvent,
  triage: AlertTriage | undefined,
): Alert {
  return {
    evidence: {
      eventId: event.eventId,
      host: event.host,
      level: event.level,
      message: event.message,
      occurredAt: event.occurredAt,
      provider: event.provider,
      sourceRecord: event.sourceRecord,
      user: event.user,
    },
    id: deriveAlertId(upload.id, event.sourceRecord),
    severity: severityForEventLevel(event.level),
    status: triage?.status ?? 'open',
    triageNote: triage?.note,
    triageUpdatedAt: triage?.updatedAt,
    uploadId: upload.id,
  };
}

export function severityForEventLevel(level: string): AlertSeverity {
  switch (level.trim().toLowerCase()) {
    case 'information':
    case 'informational':
      return 'informational';
    case 'warning':
      return 'medium';
    case 'error':
      return 'high';
    case 'critical':
      return 'critical';
    default:
      return 'low';
  }
}
