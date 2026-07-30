import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  alertResponseSchema,
  alertsResponseSchema,
  apiErrorResponseSchema,
} from '@security-log-analyzer/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    storageRoots.splice(0).map((storageRoot) => rm(storageRoot, { force: true, recursive: true })),
  );
});

describe('alerts routes', () => {
  it('lists derived alerts, filters them, and exposes normalized evidence', async () => {
    const { app } = await createTestApp();
    await uploadFixture(app, 'sanitized-security-export.log', 'text/plain');

    const listResponse = await request(app).get('/api/v1/alerts').expect(200);
    const alerts = alertsResponseSchema.parse(listResponse.body).alerts;

    expect(alerts).toHaveLength(2);
    expect(alerts.map((alert) => alert.severity)).toEqual(['medium', 'informational']);

    const filteredResponse = await request(app)
      .get('/api/v1/alerts?severity=medium&host=workstation-01')
      .expect(200);
    const filteredAlerts = alertsResponseSchema.parse(filteredResponse.body).alerts;
    expect(filteredAlerts).toHaveLength(1);

    const detailResponse = await request(app)
      .get(`/api/v1/alerts/${filteredAlerts[0]?.id}`)
      .expect(200);
    expect(alertResponseSchema.parse(detailResponse.body).alert).toMatchObject({
      eventId: 4625,
      host: 'workstation-01',
      message: 'Failed logon',
      severity: 'medium',
      sourceRecord: 3,
      status: 'open',
      user: 'analyst',
    });
  });

  it('persists analyst triage state across application recreation and supports clearing notes', async () => {
    const { app, uploadStorageDirectory } = await createTestApp();
    await uploadFixture(app, 'sanitized-security-export.log', 'text/plain');
    const alertId = alertsResponseSchema.parse((await request(app).get('/api/v1/alerts')).body)
      .alerts[0]?.id;

    if (alertId === undefined) {
      throw new Error('Expected a derived alert.');
    }

    const updateResponse = await request(app)
      .patch(`/api/v1/alerts/${alertId}`)
      .send({ note: 'Reviewed by analyst', status: 'triaged' })
      .expect(200);
    expect(alertResponseSchema.parse(updateResponse.body).alert).toMatchObject({
      status: 'triaged',
      triageNote: 'Reviewed by analyst',
    });

    const recreatedApp = createApp({
      host: '127.0.0.1',
      maximumUploadBytes: 5 * 1024 * 1024,
      port: 0,
      uploadStorageDirectory,
    });
    const persistedResponse = await request(recreatedApp)
      .get(`/api/v1/alerts/${alertId}`)
      .expect(200);
    expect(alertResponseSchema.parse(persistedResponse.body).alert.status).toBe('triaged');

    const clearedResponse = await request(recreatedApp)
      .patch(`/api/v1/alerts/${alertId}`)
      .send({ note: null, status: 'open' })
      .expect(200);
    expect(alertResponseSchema.parse(clearedResponse.body).alert).toMatchObject({
      status: 'open',
      triageNote: null,
    });
  });

  it('returns typed errors for invalid requests and unknown alerts', async () => {
    const { app } = await createTestApp();

    const invalidFilter = await request(app).get('/api/v1/alerts?severity=urgent').expect(400);
    expect(apiErrorResponseSchema.parse(invalidFilter.body).error.code).toBe(
      'INVALID_ALERT_REQUEST',
    );

    const invalidPatch = await request(app)
      .patch('/api/v1/alerts/unknown')
      .send({ status: 'open' })
      .expect(400);
    expect(apiErrorResponseSchema.parse(invalidPatch.body).error.code).toBe(
      'INVALID_ALERT_REQUEST',
    );

    const missingAlert = await request(app).get('/api/v1/alerts/unknown').expect(404);
    expect(apiErrorResponseSchema.parse(missingAlert.body).error.code).toBe('ALERT_NOT_FOUND');
  });

  it('returns an empty analysis state and a typed unavailable response without server credentials', async () => {
    const { app } = await createTestApp();
    await uploadFixture(app, 'sanitized-security-export.log', 'text/plain');
    const alertId = alertsResponseSchema.parse((await request(app).get('/api/v1/alerts')).body)
      .alerts[0]?.id;

    if (alertId === undefined) {
      throw new Error('Expected a derived alert.');
    }

    const detailResponse = await request(app).get(`/api/v1/alerts/${alertId}`).expect(200);
    expect(alertResponseSchema.parse(detailResponse.body).alert.analysis).toBeNull();

    const analysisResponse = await request(app)
      .post(`/api/v1/alerts/${alertId}/analysis`)
      .expect(503);
    expect(apiErrorResponseSchema.parse(analysisResponse.body).error.code).toBe(
      'AI_ANALYSIS_UNAVAILABLE',
    );
  });
});

async function createTestApp() {
  const uploadStorageDirectory = await mkdtemp(join(tmpdir(), 'security-log-analyzer-alerts-'));
  storageRoots.push(uploadStorageDirectory);

  return {
    app: createApp({
      host: '127.0.0.1',
      maximumUploadBytes: 5 * 1024 * 1024,
      port: 0,
      uploadStorageDirectory,
    }),
    uploadStorageDirectory,
  };
}

async function uploadFixture(
  app: ReturnType<typeof createApp>,
  fixtureName: string,
  mediaType: string,
) {
  await request(app)
    .post('/api/v1/uploads')
    .attach('file', await readFixture(fixtureName), {
      contentType: mediaType,
      filename: fixtureName,
    })
    .expect(201);
}

function readFixture(fileName: string): Promise<Buffer> {
  return readFile(new URL(`../../../../../tests/fixtures/${fileName}`, import.meta.url));
}
