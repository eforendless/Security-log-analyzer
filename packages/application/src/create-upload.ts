import type {
  LogUpload,
  LogParser,
  UploadFileStorage,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { UploadValidationError } from './upload-errors.js';

export interface CreateUploadInput {
  readonly content: Uint8Array;
  readonly mediaType: string;
  readonly originalFileName: string;
}

interface CreateUploadDependencies {
  readonly createUploadId: () => string;
  readonly fileStorage: UploadFileStorage;
  readonly maximumUploadBytes: number;
  readonly now: () => Date;
  readonly parser: LogParser;
  readonly uploadRepository: UploadRepository;
}

export class CreateUpload {
  public constructor(private readonly dependencies: CreateUploadDependencies) {}

  public async execute(input: CreateUploadInput): Promise<LogUpload> {
    this.validate(input);

    const id = this.dependencies.createUploadId();
    const storedFile = await this.dependencies.fileStorage.save({
      content: input.content,
      originalFileName: input.originalFileName,
      uploadId: id,
    });
    try {
      const parsing = await this.dependencies.parser.parse({
        content: input.content,
        mediaType: input.mediaType,
        originalFileName: input.originalFileName,
      });
      const upload: LogUpload = {
        byteSize: input.content.byteLength,
        createdAt: this.dependencies.now(),
        id,
        mediaType: input.mediaType,
        originalFileName: input.originalFileName,
        parsing,
        sha256: storedFile.sha256,
        status: 'parsed',
        storedFileName: storedFile.storedFileName,
      };

      await this.dependencies.uploadRepository.save(upload);
      return upload;
    } catch (error: unknown) {
      await this.dependencies.fileStorage.remove(storedFile.storedFileName);
      throw error;
    }
  }

  private validate(input: CreateUploadInput): void {
    if (input.originalFileName.trim() === '') {
      throw new UploadValidationError('A file name is required.');
    }

    if (input.mediaType.trim() === '') {
      throw new UploadValidationError('A file media type is required.');
    }

    if (input.content.byteLength === 0) {
      throw new UploadValidationError('The uploaded file is empty.');
    }

    if (input.content.byteLength > this.dependencies.maximumUploadBytes) {
      throw new UploadValidationError(
        `The uploaded file exceeds the ${this.dependencies.maximumUploadBytes}-byte limit.`,
      );
    }
  }
}
