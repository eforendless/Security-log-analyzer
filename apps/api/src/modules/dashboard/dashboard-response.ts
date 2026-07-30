import type { DashboardMetrics } from '@security-log-analyzer/domain';
import type { DashboardResponse } from '@security-log-analyzer/contracts';

export function toDashboardResponse(metrics: DashboardMetrics): DashboardResponse {
  return {
    dashboard: {
      recentParsedUploads: metrics.recentParsedUploads.map((upload) => ({
        createdAt: upload.createdAt.toISOString(),
        earliestOccurredAt: upload.earliestOccurredAt?.toISOString() ?? null,
        eventCount: upload.eventCount,
        id: upload.id,
        latestOccurredAt: upload.latestOccurredAt?.toISOString() ?? null,
        originalFileName: upload.originalFileName,
        skippedRecordCount: upload.skippedRecordCount,
      })),
      statistics: {
        parsedEventCount: metrics.parsedEventCount,
        parsedUploadCount: metrics.parsedUploadCount,
        skippedRecordCount: metrics.skippedRecordCount,
        uploadedCount: metrics.uploadedCount,
        uploadCount: metrics.uploadCount,
      },
    },
  };
}
