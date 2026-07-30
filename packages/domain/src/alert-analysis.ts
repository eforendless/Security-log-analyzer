import type { Alert, AlertSeverity } from './alert.js';

export class SecurityAnalysisProviderError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SecurityAnalysisProviderError';
  }
}

export interface AlertAnalysis {
  readonly alertId: string;
  readonly confidence: number;
  readonly createdAt: Date;
  readonly explanation: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly recommendations: readonly string[];
  readonly severity: AlertSeverity;
  readonly summary: string;
  readonly techniques: readonly MitreTechnique[];
}

export interface AlertAnalysisRepository {
  findByAlertId(alertId: string): Promise<AlertAnalysis | undefined>;
  save(analysis: AlertAnalysis): Promise<void>;
}

export interface MitreTechnique {
  readonly id: string;
  readonly name: string;
}

export interface RedactedAlertAnalysisInput {
  readonly alertId: string;
  readonly eventId: number;
  readonly host: string | undefined;
  readonly level: string;
  readonly message: string;
  readonly occurredAt: Date;
  readonly provider: string;
  readonly user: string | undefined;
}

export interface SecurityAnalysisProvider {
  analyze(input: RedactedAlertAnalysisInput): Promise<SecurityAnalysisResult>;
}

export interface SecurityAnalysisResult {
  readonly confidence: number;
  readonly explanation: string;
  readonly model: string;
  readonly recommendations: readonly string[];
  readonly severity: AlertSeverity;
  readonly summary: string;
  readonly techniques: readonly MitreTechnique[];
}

export interface SensitiveDataRedactor {
  redact(alert: Alert): RedactedAlertAnalysisInput;
}

export class SecurityAnalysisUnavailableError extends SecurityAnalysisProviderError {
  public constructor(message: string) {
    super(message);
    this.name = 'SecurityAnalysisUnavailableError';
  }
}
