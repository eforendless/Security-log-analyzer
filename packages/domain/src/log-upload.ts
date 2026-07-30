export const uploadStatuses = ['uploaded'] as const;

export type UploadStatus = (typeof uploadStatuses)[number];

export interface LogUpload {
  readonly byteSize: number;
  readonly createdAt: Date;
  readonly id: string;
  readonly mediaType: string;
  readonly originalFileName: string;
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

export interface UploadRepository {
  findById(uploadId: string): Promise<LogUpload | undefined>;
  save(upload: LogUpload): Promise<void>;
}
