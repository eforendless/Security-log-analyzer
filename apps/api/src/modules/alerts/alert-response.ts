import type { Alert } from '@security-log-analyzer/domain';
import type { AlertDetail, AlertsResponse } from '@security-log-analyzer/contracts';

export function toAlertDetail(alert: Alert): AlertDetail {
  return {
    analysis:
      alert.analysis === undefined
        ? null
        : {
            confidence: alert.analysis.confidence,
            createdAt: alert.analysis.createdAt.toISOString(),
            explanation: alert.analysis.explanation,
            model: alert.analysis.model,
            promptVersion: alert.analysis.promptVersion,
            recommendations: [...alert.analysis.recommendations],
            severity: alert.analysis.severity,
            summary: alert.analysis.summary,
            techniques: alert.analysis.techniques.map((technique) => ({ ...technique })),
          },
    eventId: alert.evidence.eventId,
    host: alert.evidence.host ?? null,
    id: alert.id,
    level: alert.evidence.level,
    message: alert.evidence.message,
    occurredAt: alert.evidence.occurredAt.toISOString(),
    provider: alert.evidence.provider,
    severity: alert.severity,
    sourceRecord: alert.evidence.sourceRecord,
    status: alert.status,
    triageNote: alert.triageNote ?? null,
    triageUpdatedAt: alert.triageUpdatedAt?.toISOString() ?? null,
    uploadId: alert.uploadId,
    user: alert.evidence.user ?? null,
  };
}

export function toAlertsResponse(alerts: readonly Alert[]): AlertsResponse {
  return {
    alerts: alerts.map((alert) => {
      const detail = toAlertDetail(alert);

      return {
        eventId: detail.eventId,
        host: detail.host,
        id: detail.id,
        occurredAt: detail.occurredAt,
        provider: detail.provider,
        severity: detail.severity,
        status: detail.status,
      };
    }),
  };
}
