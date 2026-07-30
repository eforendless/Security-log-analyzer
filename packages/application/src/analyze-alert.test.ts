import type {
  AlertAnalysis,
  AlertAnalysisRepository,
  AlertTriageRepository,
  LogUpload,
  RedactedAlertAnalysisInput,
  SecurityAnalysisProvider,
  SensitiveDataRedactor,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { describe, expect, it } from 'vitest';
import { AnalyzeAlert } from './analyze-alert.js';

describe('AnalyzeAlert', () => {
  it('redacts projected evidence before provider invocation and persists the structured result', async () => {
    const uploadRepository: UploadRepository = {
      findById: async (uploadId) => (uploadId === upload.id ? upload : undefined),
      list: async () => [upload],
      save: async () => undefined,
    };
    const triageRepository: AlertTriageRepository = {
      findByAlertId: async () => undefined,
      save: async () => undefined,
    };
    const analysisRepository = new MemoryAnalysisRepository();
    const provider = new RecordingProvider();
    const redactor: SensitiveDataRedactor = {
      redact: (alert) => {
        expect(alert.evidence.message).toContain('correct-horse-battery-staple');
        return redactedInput;
      },
    };
    const analyzeAlert = new AnalyzeAlert({
      analysisRepository,
      now: () => new Date('2026-07-30T12:10:00.000Z'),
      provider,
      redactor,
      triageRepository,
      uploadRepository,
    });

    const analysis = await analyzeAlert.execute(redactedInput.alertId);

    expect(provider.input).toEqual(redactedInput);
    expect(analysis).toMatchObject({
      confidence: 0.82,
      model: 'test-model',
      severity: 'medium',
      techniques: [{ id: 'T1110', name: 'Brute Force' }],
    });
    expect(analysisRepository.saved).toEqual([analysis]);
  });
});

class MemoryAnalysisRepository implements AlertAnalysisRepository {
  public readonly saved: AlertAnalysis[] = [];

  public async findByAlertId(alertId: string): Promise<AlertAnalysis | undefined> {
    return this.saved.find((analysis) => analysis.alertId === alertId);
  }

  public async save(analysis: AlertAnalysis): Promise<void> {
    this.saved.push(analysis);
  }
}

class RecordingProvider implements SecurityAnalysisProvider {
  public input: RedactedAlertAnalysisInput | undefined;

  public async analyze(input: RedactedAlertAnalysisInput) {
    this.input = input;

    return {
      confidence: 0.82,
      explanation: 'The failed logon should be verified against expected account activity.',
      model: 'test-model',
      recommendations: ['Verify the account owner and source context.'],
      severity: 'medium' as const,
      summary: 'Repeated authentication failure requires review.',
      techniques: [{ id: 'T1110', name: 'Brute Force' }],
    };
  }
}

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

const upload: LogUpload = {
  byteSize: 200,
  createdAt: new Date('2026-07-30T12:06:00.000Z'),
  id: '00000000-0000-4000-8000-000000000000',
  mediaType: 'text/plain',
  originalFileName: 'security-export.log',
  parsing: {
    events: [
      {
        eventId: 4625,
        host: 'workstation-01',
        level: 'warning',
        message: 'token=correct-horse-battery-staple',
        occurredAt: new Date('2026-07-30T12:05:00.000Z'),
        provider: 'Security-Auditing',
        sourceRecord: 3,
        user: 'analyst',
      },
    ],
    summary: {
      earliestOccurredAt: new Date('2026-07-30T12:05:00.000Z'),
      eventCount: 1,
      eventsById: { '4625': 1 },
      eventsByProvider: { 'Security-Auditing': 1 },
      latestOccurredAt: new Date('2026-07-30T12:05:00.000Z'),
      skippedRecordCount: 0,
    },
  },
  sha256: 'a'.repeat(64),
  status: 'parsed',
  storedFileName: '00000000-0000-4000-8000-000000000000.log',
};
