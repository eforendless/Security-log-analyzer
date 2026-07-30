import type {
  AlertAnalysis,
  AlertAnalysisRepository,
  AlertTriageRepository,
  SecurityAnalysisProvider,
  SensitiveDataRedactor,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { GetAlert } from './get-alert.js';

interface AnalyzeAlertDependencies {
  readonly analysisRepository: AlertAnalysisRepository;
  readonly now: () => Date;
  readonly provider: SecurityAnalysisProvider;
  readonly redactor: SensitiveDataRedactor;
  readonly triageRepository: AlertTriageRepository;
  readonly uploadRepository: UploadRepository;
}

export class AnalyzeAlert {
  public constructor(private readonly dependencies: AnalyzeAlertDependencies) {}

  public async execute(alertId: string): Promise<AlertAnalysis> {
    const alert = await new GetAlert(
      this.dependencies.uploadRepository,
      this.dependencies.triageRepository,
      this.dependencies.analysisRepository,
    ).execute(alertId);
    const result = await this.dependencies.provider.analyze(
      this.dependencies.redactor.redact(alert),
    );
    const analysis: AlertAnalysis = {
      alertId,
      confidence: result.confidence,
      createdAt: this.dependencies.now(),
      explanation: result.explanation,
      model: result.model,
      promptVersion: 'security-alert-v1',
      recommendations: result.recommendations,
      severity: result.severity,
      summary: result.summary,
      techniques: result.techniques,
    };

    await this.dependencies.analysisRepository.save(analysis);

    return analysis;
  }
}
