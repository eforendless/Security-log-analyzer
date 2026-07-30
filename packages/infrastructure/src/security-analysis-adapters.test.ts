import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Alert, RedactedAlertAnalysisInput } from '@security-log-analyzer/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalAlertAnalysisRepository } from './local-alert-analysis-repository.js';
import { OpenAiSecurityAnalysisProvider } from './openai-security-analysis-provider.js';
import { BoundedSensitiveDataRedactor } from './sensitive-data-redactor.js';

const storageRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    storageRoots.splice(0).map((storageRoot) => rm(storageRoot, { force: true, recursive: true })),
  );
});

describe('security analysis adapters', () => {
  it('redacts sensitive identifiers and bounds the evidence passed to a provider', () => {
    const input = new BoundedSensitiveDataRedactor().redact(createAlert());

    expect(input.host).toBe('[REDACTED_HOST]');
    expect(input.user).toBe('[REDACTED_USER]');
    expect(input.message).toContain('[REDACTED_SECRET]');
    expect(input.message).toContain('[REDACTED_EMAIL]');
    expect(input.message).toContain('[REDACTED_IP]');
    expect(input.message).toContain('[REDACTED_PATH]');
    expect(input.message).not.toContain('correct-horse-battery-staple');
    expect(input.message).not.toContain('analyst@example.test');
    expect(input.message).not.toContain('192.168.1.25');
  });

  it('accepts only a valid strict structured provider response', async () => {
    const provider = new OpenAiSecurityAnalysisProvider({
      apiKey: 'test-key',
      fetchImplementation: async (_input, init) => {
        const request = JSON.parse(String(init?.body)) as { input: unknown[] };
        expect(JSON.stringify(request.input)).not.toContain('correct-horse-battery-staple');

        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              confidence: 0.82,
              explanation: 'The failed logon should be verified against expected account activity.',
              recommendations: ['Verify the account owner and source context.'],
              severity: 'medium',
              summary: 'Repeated authentication failure requires review.',
              techniques: [{ id: 'T1110', name: 'Brute Force' }],
            }),
          }),
          { status: 200 },
        );
      },
      model: 'test-model',
    });

    await expect(provider.analyze(redactedInput)).resolves.toMatchObject({
      model: 'test-model',
      severity: 'medium',
      techniques: [{ id: 'T1110', name: 'Brute Force' }],
    });
  });

  it('rejects invalid provider output and persists validated analyses separately', async () => {
    const provider = new OpenAiSecurityAnalysisProvider({
      apiKey: 'test-key',
      fetchImplementation: async () =>
        new Response(JSON.stringify({ output_text: '{"severity":"urgent"}' }), { status: 200 }),
      model: 'test-model',
    });
    await expect(provider.analyze(redactedInput)).rejects.toThrow('invalid response');

    const storageRoot = await mkdtemp(join(tmpdir(), 'security-log-analyzer-analysis-'));
    storageRoots.push(storageRoot);
    const repository = new LocalAlertAnalysisRepository(storageRoot);
    const createdAt = new Date('2026-07-30T12:10:00.000Z');

    await repository.save({
      alertId: redactedInput.alertId,
      confidence: 0.82,
      createdAt,
      explanation: 'The failed logon should be verified against expected account activity.',
      model: 'test-model',
      promptVersion: 'security-alert-v1',
      recommendations: ['Verify the account owner and source context.'],
      severity: 'medium',
      summary: 'Repeated authentication failure requires review.',
      techniques: [{ id: 'T1110', name: 'Brute Force' }],
    });

    await expect(repository.findByAlertId(redactedInput.alertId)).resolves.toMatchObject({
      createdAt,
      model: 'test-model',
      severity: 'medium',
    });
  });

  it('includes only the upstream HTTP status when the provider rejects a request', async () => {
    const provider = new OpenAiSecurityAnalysisProvider({
      apiKey: 'test-key',
      fetchImplementation: async () => new Response('', { status: 401 }),
      model: 'test-model',
    });

    await expect(provider.analyze(redactedInput)).rejects.toThrow('HTTP 401');
  });
});

const redactedInput: RedactedAlertAnalysisInput = {
  alertId: 'alert-00000000-0000-4000-8000-000000000000-3',
  eventId: 4625,
  host: '[REDACTED_HOST]',
  level: 'warning',
  message: '[REDACTED_SECRET]',
  occurredAt: new Date('2026-07-30T12:05:00.000Z'),
  provider: 'Security-Auditing',
  user: '[REDACTED_USER]',
};

function createAlert(): Alert {
  return {
    evidence: {
      eventId: 4625,
      host: 'workstation-01',
      level: 'warning',
      message:
        'token=correct-horse-battery-staple from 192.168.1.25 analyst@example.test C:\\Users\\analyst\\secrets.txt',
      occurredAt: new Date('2026-07-30T12:05:00.000Z'),
      provider: 'Security-Auditing',
      sourceRecord: 3,
      user: 'analyst',
    },
    id: redactedInput.alertId,
    severity: 'medium',
    status: 'open',
    triageNote: undefined,
    triageUpdatedAt: undefined,
    uploadId: '00000000-0000-4000-8000-000000000000',
  };
}
