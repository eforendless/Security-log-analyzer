import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogUpload, UploadRepository, UploadStatus } from '@security-log-analyzer/domain';

export class LocalUploadRepository implements UploadRepository {
  public constructor(private readonly storageRoot: string) {}

  public async findById(uploadId: string): Promise<LogUpload | undefined> {
    try {
      const content = await readFile(this.metadataPath(uploadId), 'utf8');
      return deserializeUpload(JSON.parse(content) as unknown);
    } catch (error: unknown) {
      if (isErrorWithCode(error, 'ENOENT')) {
        return undefined;
      }

      throw error;
    }
  }

  public async save(upload: LogUpload): Promise<void> {
    await mkdir(this.metadataDirectory, { recursive: true });

    const destinationPath = this.metadataPath(upload.id);
    const temporaryPath = `${destinationPath}.${crypto.randomUUID()}.tmp`;
    const serialized = JSON.stringify({
      ...upload,
      createdAt: upload.createdAt.toISOString(),
    });

    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, destinationPath);
  }

  private get metadataDirectory(): string {
    return join(this.storageRoot, 'metadata');
  }

  private metadataPath(uploadId: string): string {
    return join(this.metadataDirectory, `${uploadId}.json`);
  }
}

function deserializeUpload(value: unknown): LogUpload {
  if (!isRecord(value)) {
    throw new Error('Stored upload metadata is invalid.');
  }

  const { byteSize, createdAt, id, mediaType, originalFileName, sha256, status, storedFileName } =
    value;

  if (
    typeof byteSize !== 'number' ||
    !Number.isInteger(byteSize) ||
    byteSize < 0 ||
    typeof createdAt !== 'string' ||
    typeof id !== 'string' ||
    typeof mediaType !== 'string' ||
    typeof originalFileName !== 'string' ||
    typeof sha256 !== 'string' ||
    status !== 'uploaded' ||
    typeof storedFileName !== 'string'
  ) {
    throw new Error('Stored upload metadata is invalid.');
  }

  const parsedCreatedAt = new Date(createdAt);

  if (Number.isNaN(parsedCreatedAt.getTime())) {
    throw new Error('Stored upload metadata contains an invalid creation date.');
  }

  return {
    byteSize,
    createdAt: parsedCreatedAt,
    id,
    mediaType,
    originalFileName,
    sha256,
    status: status as UploadStatus,
    storedFileName,
  };
}

function isErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
