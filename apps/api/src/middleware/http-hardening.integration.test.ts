import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    storageRoots.splice(0).map((storageRoot) => rm(storageRoot, { force: true, recursive: true })),
  );
});

describe('HTTP hardening', () => {
  it('provides liveness and readiness checks with security and request ID headers', async () => {
    const app = await createTestApp();

    const liveResponse = await request(app).get('/api/v1/health/live').expect(200);
    expect(liveResponse.body.status).toBe('ok');
    expect(liveResponse.headers['x-content-type-options']).toBe('nosniff');
    expect(liveResponse.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/u);

    const readyResponse = await request(app).get('/api/v1/health/ready').expect(200);
    expect(readyResponse.body.status).toBe('ready');
  });

  it('allows only explicitly configured CORS origins', async () => {
    const app = await createTestApp();

    const allowedResponse = await request(app)
      .get('/api/v1/health/live')
      .set('Origin', 'https://console.example.test')
      .expect(200);
    expect(allowedResponse.headers['access-control-allow-origin']).toBe(
      'https://console.example.test',
    );

    const deniedResponse = await request(app)
      .get('/api/v1/health/live')
      .set('Origin', 'https://untrusted.example.test')
      .expect(403);
    expect(deniedResponse.body.error.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('allows same-origin browser asset requests without a cross-origin allowlist entry', async () => {
    const app = await createTestApp();

    const response = await request(app)
      .get('/api/v1/health/live')
      .set('Host', '127.0.0.1:4000')
      .set('Origin', 'http://127.0.0.1:4000')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:4000');
  });

  it('rate limits application routes while allowing repeated health probes', async () => {
    const app = await createTestApp(1);

    await request(app).get('/api/v1/health/live').expect(200);
    await request(app).get('/api/v1/health/live').expect(200);
    await request(app).get('/api/v1/dashboard').expect(200);
    const limitedResponse = await request(app).get('/api/v1/dashboard').expect(429);
    expect(limitedResponse.body.error.code).toBe('RATE_LIMITED');
  });
});

async function createTestApp(rateLimitMaximumRequests = 120) {
  const uploadStorageDirectory = await mkdtemp(join(tmpdir(), 'security-log-analyzer-hardening-'));
  storageRoots.push(uploadStorageDirectory);

  return createApp({
    corsAllowedOrigins: ['https://console.example.test'],
    host: '127.0.0.1',
    maximumUploadBytes: 5 * 1024 * 1024,
    openAiApiKey: undefined,
    openAiModel: 'gpt-4.1-mini',
    openAiTimeoutMs: 15_000,
    port: 0,
    rateLimitMaximumRequests,
    rateLimitWindowMs: 60_000,
    requestLoggingEnabled: false,
    trustProxy: false,
    uploadStorageDirectory,
  });
}
