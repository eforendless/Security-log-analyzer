import type {
  Alert,
  RedactedAlertAnalysisInput,
  SensitiveDataRedactor,
} from '@security-log-analyzer/domain';

const MAXIMUM_MESSAGE_LENGTH = 2_000;

export class BoundedSensitiveDataRedactor implements SensitiveDataRedactor {
  public redact(alert: Alert): RedactedAlertAnalysisInput {
    return {
      alertId: alert.id,
      eventId: alert.evidence.eventId,
      host: alert.evidence.host === undefined ? undefined : '[REDACTED_HOST]',
      level: alert.evidence.level.slice(0, 120),
      message: redactMessage(alert.evidence.message),
      occurredAt: alert.evidence.occurredAt,
      provider: alert.evidence.provider.slice(0, 240),
      user: alert.evidence.user === undefined ? undefined : '[REDACTED_USER]',
    };
  }
}

export function redactMessage(value: string): string {
  const redacted = value
    .replace(
      /\b(?:api[_-]?key|authorization|password|secret|token)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi,
      '[REDACTED_SECRET]',
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/\b(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]*\b/gi, '[REDACTED_IP]')
    .replace(/[A-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*/gi, '[REDACTED_PATH]');

  return redacted.slice(0, MAXIMUM_MESSAGE_LENGTH);
}
