import type { LogUpload } from '@security-log-analyzer/domain';
import type { UploadResponse } from '@security-log-analyzer/contracts';

export function toUploadResponse(upload: LogUpload): UploadResponse {
  const parsingSummary =
    upload.parsing === undefined
      ? {}
      : {
          parsingSummary: {
            earliestOccurredAt: upload.parsing.summary.earliestOccurredAt?.toISOString() ?? null,
            eventCount: upload.parsing.summary.eventCount,
            eventsById: upload.parsing.summary.eventsById,
            eventsByProvider: upload.parsing.summary.eventsByProvider,
            latestOccurredAt: upload.parsing.summary.latestOccurredAt?.toISOString() ?? null,
            skippedRecordCount: upload.parsing.summary.skippedRecordCount,
          },
        };

  return {
    upload: {
      byteSize: upload.byteSize,
      createdAt: upload.createdAt.toISOString(),
      id: upload.id,
      mediaType: upload.mediaType,
      originalFileName: upload.originalFileName,
      ...parsingSummary,
      sha256: upload.sha256,
      status: upload.status,
    },
  };
}
