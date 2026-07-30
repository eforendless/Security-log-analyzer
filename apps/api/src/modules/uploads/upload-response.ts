import type { LogUpload } from '@security-log-analyzer/domain';
import type { UploadResponse } from '@security-log-analyzer/contracts';

export function toUploadResponse(upload: LogUpload): UploadResponse {
  return {
    upload: {
      byteSize: upload.byteSize,
      createdAt: upload.createdAt.toISOString(),
      id: upload.id,
      mediaType: upload.mediaType,
      originalFileName: upload.originalFileName,
      sha256: upload.sha256,
      status: upload.status,
    },
  };
}
