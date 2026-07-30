export class UploadNotFoundError extends Error {
  public constructor(uploadId: string) {
    super(`Upload '${uploadId}' was not found.`);
    this.name = 'UploadNotFoundError';
  }
}

export class UploadValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}
