export interface DashboardMetrics {
  readonly parsedEventCount: number;
  readonly parsedUploadCount: number;
  readonly recentParsedUploads: readonly RecentParsedUpload[];
  readonly skippedRecordCount: number;
  readonly uploadedCount: number;
  readonly uploadCount: number;
}

export interface RecentParsedUpload {
  readonly createdAt: Date;
  readonly earliestOccurredAt: Date | undefined;
  readonly eventCount: number;
  readonly id: string;
  readonly latestOccurredAt: Date | undefined;
  readonly originalFileName: string;
  readonly skippedRecordCount: number;
}
