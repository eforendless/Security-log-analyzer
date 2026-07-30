import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import type { StoredUploadFile, UploadFileStorage } from '@security-log-analyzer/domain';

export class LocalUploadFileStorage implements UploadFileStorage {
  public constructor(private readonly storageRoot: string) {}

  public async remove(storedFileName: string): Promise<void> {
    await rm(join(this.filesDirectory, storedFileName), { force: true });
  }

  public async save(input: {
    content: Uint8Array;
    originalFileName: string;
    uploadId: string;
  }): Promise<StoredUploadFile> {
    await mkdir(this.filesDirectory, { recursive: true });

    const extension = this.safeExtension(input.originalFileName);
    const storedFileName = `${input.uploadId}${extension}`;
    const filePath = join(this.filesDirectory, storedFileName);

    await writeFile(filePath, input.content, { flag: 'wx' });

    return {
      sha256: createHash('sha256').update(input.content).digest('hex'),
      storedFileName,
    };
  }

  private get filesDirectory(): string {
    return join(this.storageRoot, 'files');
  }

  private safeExtension(fileName: string): string {
    const extension = extname(fileName).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : '';
  }
}
