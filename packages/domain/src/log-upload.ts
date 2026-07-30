export const uploadStatuses = ['uploaded', 'parsed'] as const;

export type UploadStatus = (typeof uploadStatuses)[number];

export interface LogParseSummary {
  readonly earliestOccurredAt: Date | undefined;
  readonly eventCount: number;
  readonly eventsById: Readonly<Record<string, number>>;
  readonly eventsByProvider: Readonly<Record<string, number>>;
  readonly latestOccurredAt: Date | undefined;
  readonly skippedRecordCount: number;
}

export interface ParsedLog {
  readonly events: readonly SecurityEvent[];
  readonly summary: LogParseSummary;
}

export interface SecurityEvent {
  readonly eventId: number;
  readonly host: string | undefined;
  readonly level: string;
  readonly message: string;
  readonly occurredAt: Date;
  readonly provider: string;
  readonly sourceRecord: number;
  readonly user: string | undefined;
}

export interface LogUpload {
  readonly byteSize: number;
  readonly createdAt: Date;
  readonly id: string;
  readonly mediaType: string;
  readonly originalFileName: string;
  readonly parsing: ParsedLog | undefined;
  readonly sha256: string;
  readonly status: UploadStatus;
  readonly storedFileName: string;
}

export interface StoredUploadFile {
  readonly sha256: string;
  readonly storedFileName: string;
}

export interface UploadFileStorage {
  remove(storedFileName: string): Promise<void>;
  save(input: {
    content: Uint8Array;
    originalFileName: string;
    uploadId: string;
  }): Promise<StoredUploadFile>;
}

export interface LogParser {
  parse(input: {
    content: Uint8Array;
    mediaType: string;
    originalFileName: string;
  }): Promise<ParsedLog>;
}

export type TextLogParser = LogParser;

export class TextLogParseError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'TextLogParseError';
  }
}

export interface UploadRepository {
  findById(uploadId: string): Promise<LogUpload | undefined>;
  list(): Promise<readonly LogUpload[]>;
  save(upload: LogUpload): Promise<void>;
}
