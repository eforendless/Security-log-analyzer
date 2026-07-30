import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dashboardResponseSchema } from '@security-log-analyzer/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    storageRoots.splice(0).map((storageRoot) => rm(storageRoot, { force: true, recursive: true })),
  );
});

describe('dashboard route', () => {
  it('returns empty dashboard statistics for a fresh storage root', async () => {
    const app = await createTestApp();
    const response = await request(app).get('/api/v1/dashboard').expect(200);

    expect(dashboardResponseSchema.parse(response.body)).toEqual({
      dashboard: {
        recentParsedUploads: [],
        statistics: {
          parsedEventCount: 0,
          parsedUploadCount: 0,
          skippedRecordCount: 0,
          uploadedCount: 0,
          uploadCount: 0,
        },
      },
    });
  });

  it('aggregates parsed upload summaries and orders recent activity by upload time', async () => {
    const app = await createTestApp();
    const firstUpload = await uploadFixture(app, 'sanitized-security-export.log', 'text/plain');
    const secondUpload = await uploadFixture(
      app,
      'sanitized-security-export.json',
      'application/json',
    );

    const response = await request(app).get('/api/v1/dashboard').expect(200);
    const dashboard = dashboardResponseSchema.parse(response.body).dashboard;

    expect(dashboard.statistics).toEqual({
      parsedEventCount: 4,
      parsedUploadCount: 2,
      skippedRecordCount: 1,
      uploadedCount: 0,
      uploadCount: 2,
    });
    expect(dashboard.recentParsedUploads.map((upload) => upload.id)).toEqual([
      secondUpload.upload.id,
      firstUpload.upload.id,
    ]);
    expect(dashboard.recentParsedUploads[0]).toMatchObject({
      eventCount: 2,
      originalFileName: 'sanitized-security-export.json',
      skippedRecordCount: 0,
    });
  });
});

async function createTestApp() {
  const uploadStorageDirectory = await mkdtemp(join(tmpdir(), 'security-log-analyzer-dashboard-'));
  storageRoots.push(uploadStorageDirectory);

  return createApp({
    host: '127.0.0.1',
    maximumUploadBytes: 5 * 1024 * 1024,
    port: 0,
    uploadStorageDirectory,
  });
}

async function uploadFixture(
  app: ReturnType<typeof createApp>,
  fixtureName: string,
  mediaType: string,
) {
  const response = await request(app)
    .post('/api/v1/uploads')
    .attach('file', await readFixture(fixtureName), {
      contentType: mediaType,
      filename: fixtureName,
    })
    .expect(201);

  return response.body as { upload: { id: string } };
}

function readFixture(fileName: string): Promise<Buffer> {
  return readFile(new URL(`../../../../../tests/fixtures/${fileName}`, import.meta.url));
}
