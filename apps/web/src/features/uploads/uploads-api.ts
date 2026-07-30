import {
  apiErrorResponseSchema,
  type UploadResponse,
  uploadResponseSchema,
} from '@security-log-analyzer/contracts';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

export async function createUpload(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return requestUpload('/uploads', {
    body: formData,
    method: 'POST',
  });
}

export async function getUploadStatus(uploadId: string): Promise<UploadResponse> {
  return requestUpload(`/uploads/${uploadId}`, { method: 'GET' });
}

async function requestUpload(path: string, options: RequestInit): Promise<UploadResponse> {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const error = apiErrorResponseSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error.message : 'The upload request could not be completed.',
    );
  }

  const result = uploadResponseSchema.safeParse(body);

  if (!result.success) {
    throw new Error('The API returned an invalid upload response.');
  }

  return result.data;
}
