import type {
  DashboardMetrics,
  LogUpload,
  RecentParsedUpload,
  UploadRepository,
} from '@security-log-analyzer/domain';

const RECENT_UPLOAD_LIMIT = 10;

export class GetDashboardMetrics {
  public constructor(private readonly uploadRepository: UploadRepository) {}

  public async execute(): Promise<DashboardMetrics> {
    const uploads = await this.uploadRepository.list();
    const parsedUploads = uploads.filter(isParsedUpload);

    return {
      parsedEventCount: sum(parsedUploads, (upload) => upload.parsing.summary.eventCount),
      parsedUploadCount: parsedUploads.length,
      recentParsedUploads: parsedUploads
        .sort(compareUploadsByRecency)
        .slice(0, RECENT_UPLOAD_LIMIT)
        .map(toRecentParsedUpload),
      skippedRecordCount: sum(parsedUploads, (upload) => upload.parsing.summary.skippedRecordCount),
      uploadedCount: uploads.filter((upload) => upload.status === 'uploaded').length,
      uploadCount: uploads.length,
    };
  }
}

function isParsedUpload(
  upload: LogUpload,
): upload is LogUpload & { parsing: NonNullable<LogUpload['parsing']> } {
  return upload.status === 'parsed' && upload.parsing !== undefined;
}

function compareUploadsByRecency(left: LogUpload, right: LogUpload): number {
  const byCreatedAt = right.createdAt.getTime() - left.createdAt.getTime();
  return byCreatedAt !== 0 ? byCreatedAt : right.id.localeCompare(left.id);
}

function sum<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}

function toRecentParsedUpload(
  upload: LogUpload & { parsing: NonNullable<LogUpload['parsing']> },
): RecentParsedUpload {
  return {
    createdAt: upload.createdAt,
    earliestOccurredAt: upload.parsing.summary.earliestOccurredAt,
    eventCount: upload.parsing.summary.eventCount,
    id: upload.id,
    latestOccurredAt: upload.parsing.summary.latestOccurredAt,
    originalFileName: upload.originalFileName,
    skippedRecordCount: upload.parsing.summary.skippedRecordCount,
  };
}
