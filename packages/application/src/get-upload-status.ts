import type { LogUpload, UploadRepository } from '@security-log-analyzer/domain';
import { UploadNotFoundError } from './upload-errors.js';

export class GetUploadStatus {
  public constructor(private readonly uploadRepository: UploadRepository) {}

  public async execute(uploadId: string): Promise<LogUpload> {
    const upload = await this.uploadRepository.findById(uploadId);

    if (upload === undefined) {
      throw new UploadNotFoundError(uploadId);
    }

    return upload;
  }
}
