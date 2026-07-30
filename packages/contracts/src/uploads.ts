import { z } from 'zod';

export const acceptedTextFileExtensions = ['.txt', '.log', '.csv', '.json', '.xml'] as const;
export const acceptedLogFileExtensions = [...acceptedTextFileExtensions, '.evtx'] as const;
export const acceptedTextMimeTypes = [
  'text/plain',
  'text/csv',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
  'application/octet-stream',
] as const;

const acceptedExtensions = new Set<string>(acceptedTextFileExtensions);
const acceptedLogExtensions = new Set<string>(acceptedLogFileExtensions);
const acceptedMimeTypes = new Set<string>(acceptedTextMimeTypes);

export const uploadStatusSchema = z.enum(['uploaded', 'parsed']);

export const logParseSummarySchema = z.object({
  earliestOccurredAt: z.string().datetime().nullable(),
  eventCount: z.number().int().nonnegative(),
  eventsById: z.record(z.string(), z.number().int().nonnegative()),
  eventsByProvider: z.record(z.string(), z.number().int().nonnegative()),
  latestOccurredAt: z.string().datetime().nullable(),
  skippedRecordCount: z.number().int().nonnegative(),
});

export const uploadResponseSchema = z.object({
  upload: z.object({
    byteSize: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    id: z.string().uuid(),
    mediaType: z.string().min(1),
    originalFileName: z.string().min(1),
    parsingSummary: logParseSummarySchema.optional(),
    sha256: z.string().length(64),
    status: uploadStatusSchema,
  }),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export function isSupportedTextLogFile(fileName: string, mediaType: string): boolean {
  const extensionStart = fileName.lastIndexOf('.');
  const extension = extensionStart === -1 ? '' : fileName.slice(extensionStart).toLowerCase();

  return acceptedExtensions.has(extension) && acceptedMimeTypes.has(mediaType.toLowerCase());
}

export function isSupportedLogFile(fileName: string, mediaType: string): boolean {
  const extensionStart = fileName.lastIndexOf('.');
  const extension = extensionStart === -1 ? '' : fileName.slice(extensionStart).toLowerCase();
  const normalizedMediaType = mediaType.toLowerCase();

  if (!acceptedLogExtensions.has(extension)) {
    return false;
  }

  if (extension !== '.evtx') {
    return acceptedMimeTypes.has(normalizedMediaType);
  }

  return (
    normalizedMediaType === 'application/octet-stream' ||
    normalizedMediaType === 'application/x-evtx' ||
    normalizedMediaType === 'application/vnd.ms-eventlog'
  );
}
