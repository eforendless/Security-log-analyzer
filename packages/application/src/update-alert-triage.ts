import type {
  Alert,
  AlertStatus,
  AlertTriageRepository,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { AlertNotFoundError } from './alert-errors.js';
import { projectAlerts } from './alert-projection.js';

export interface UpdateAlertTriageInput {
  readonly alertId: string;
  readonly note: string | undefined;
  readonly status: AlertStatus;
}

interface UpdateAlertTriageDependencies {
  readonly now: () => Date;
  readonly triageRepository: AlertTriageRepository;
  readonly uploadRepository: UploadRepository;
}

export class UpdateAlertTriage {
  public constructor(private readonly dependencies: UpdateAlertTriageDependencies) {}

  public async execute(input: UpdateAlertTriageInput): Promise<Alert> {
    const exists = (
      await projectAlerts(this.dependencies.uploadRepository, this.dependencies.triageRepository)
    ).some((alert) => alert.id === input.alertId);

    if (!exists) {
      throw new AlertNotFoundError(input.alertId);
    }

    const updatedAt = this.dependencies.now();
    await this.dependencies.triageRepository.save({
      alertId: input.alertId,
      note: input.note,
      status: input.status,
      updatedAt,
    });

    const updatedAlert = (
      await projectAlerts(this.dependencies.uploadRepository, this.dependencies.triageRepository)
    ).find((alert) => alert.id === input.alertId);

    if (updatedAlert === undefined) {
      throw new AlertNotFoundError(input.alertId);
    }

    return updatedAlert;
  }
}
