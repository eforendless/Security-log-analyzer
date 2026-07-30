import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiErrorResponseSchema, uploadResponseSchema } from '@security-log-analyzer/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    storageRoots.splice(0).map((storageRoot) => rm(storageRoot, { force: true, recursive: true })),
  );
});

describe('upload routes', () => {
  it('stores a supported text export and retrieves its upload status', async () => {
    const app = await createTestApp();
    const createResponse = await request(app)
      .post('/api/v1/uploads')
      .attach('file', await readFixture('sanitized-security-export.log'), {
        contentType: 'text/plain',
        filename: 'security-export.log',
      })
      .expect(201);
    const createdUpload = uploadResponseSchema.parse(createResponse.body).upload;

    expect(createdUpload.status).toBe('parsed');
    expect(createdUpload.sha256).toHaveLength(64);
    expect(createdUpload.parsingSummary).toEqual({
      earliestOccurredAt: '2026-07-30T12:00:00.000Z',
      eventCount: 2,
      eventsById: { '4624': 1, '4625': 1 },
      eventsByProvider: { 'Security-Auditing': 2 },
      latestOccurredAt: '2026-07-30T12:05:00.000Z',
      skippedRecordCount: 1,
    });

    const statusResponse = await request(app)
      .get(`/api/v1/uploads/${createdUpload.id}`)
      .expect(200);
    expect(uploadResponseSchema.parse(statusResponse.body).upload).toEqual(createdUpload);

    await request(app).get(`/files/${createdUpload.id}.log`).expect(404);
  });

  it('rejects unsupported upload formats before private storage', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v1/uploads')
      .attach('file', Buffer.from('binary content'), {
        contentType: 'application/octet-stream',
        filename: 'security.exe',
      })
      .expect(400);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('INVALID_UPLOAD');
  });

  it('accepts the EVTX media type before returning a typed invalid-content response', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v1/uploads')
      .attach('file', Buffer.from('not an EVTX file'), {
        contentType: 'application/octet-stream',
        filename: 'security.evtx',
      })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('INVALID_LOG_CONTENT');
  });

  it('accepts browser-provided generic MIME types for allowlisted text exports', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v1/uploads')
      .attach('file', await readFixture('sanitized-security-export.log'), {
        contentType: 'application/octet-stream',
        filename: 'security-export.log',
      })
      .expect(201);

    expect(uploadResponseSchema.parse(response.body).upload.status).toBe('parsed');
  });

  it.each([
    ['sanitized-security-export.csv', 'text/csv'],
    ['sanitized-security-export.json', 'application/json'],
    ['sanitized-security-export.xml', 'application/xml'],
  ])('parses the %s text export', async (fixtureName, mediaType) => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v1/uploads')
      .attach('file', await readFixture(fixtureName), {
        contentType: mediaType,
        filename: fixtureName,
      })
      .expect(201);

    const upload = uploadResponseSchema.parse(response.body).upload;
    expect(upload.status).toBe('parsed');
    expect(upload.parsingSummary?.eventCount).toBe(2);
    expect(upload.parsingSummary?.skippedRecordCount).toBe(0);
  });

  it('returns a typed parsing error for invalid structured content', async () => {
    const app = await createTestApp();
    const response = await request(app)
      .post('/api/v1/uploads')
      .attach('file', Buffer.from('{invalid'), {
        contentType: 'application/json',
        filename: 'invalid.json',
      })
      .expect(422);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('INVALID_LOG_CONTENT');
  });

  it('enforces the configured upload size limit', async () => {
    const app = await createTestApp(4);
    const response = await request(app)
      .post('/api/v1/uploads')
      .attach('file', Buffer.from('12345'), {
        contentType: 'text/plain',
        filename: 'security.log',
      })
      .expect(413);

    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('FILE_TOO_LARGE');
  });
});

async function createTestApp(maximumUploadBytes = 5 * 1024 * 1024) {
  const uploadStorageDirectory = await mkdtemp(join(tmpdir(), 'security-log-analyzer-'));
  storageRoots.push(uploadStorageDirectory);

  return createApp({
    host: '127.0.0.1',
    maximumUploadBytes,
    port: 0,
    uploadStorageDirectory,
  });
}

function readFixture(fileName: string): Promise<Buffer> {
  return readFile(new URL(`../../../../../tests/fixtures/${fileName}`, import.meta.url));
}
