import type {
  Alert,
  AlertAnalysisRepository,
  AlertTriageRepository,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { AlertNotFoundError } from './alert-errors.js';
import { projectAlerts } from './alert-projection.js';

export class GetAlert {
  public constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly triageRepository: AlertTriageRepository,
    private readonly analysisRepository?: AlertAnalysisRepository,
  ) {}

  public async execute(alertId: string): Promise<Alert> {
    const alert = (await projectAlerts(this.uploadRepository, this.triageRepository)).find(
      (candidate) => candidate.id === alertId,
    );

    if (alert === undefined) {
      throw new AlertNotFoundError(alertId);
    }

    const analysis = await this.analysisRepository?.findByAlertId(alertId);

    return analysis === undefined ? alert : { ...alert, analysis };
  }
}
