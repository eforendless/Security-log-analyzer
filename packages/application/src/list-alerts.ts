import type {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertTriageRepository,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { compareAlertsByRecency, projectAlerts } from './alert-projection.js';

export interface ListAlertsInput {
  readonly from?: Date;
  readonly host?: string;
  readonly severity?: AlertSeverity;
  readonly status?: AlertStatus;
  readonly to?: Date;
}

export class ListAlerts {
  public constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly triageRepository: AlertTriageRepository,
  ) {}

  public async execute(input: ListAlertsInput = {}): Promise<readonly Alert[]> {
    const alerts = await projectAlerts(this.uploadRepository, this.triageRepository);

    return alerts.filter((alert) => matchesFilters(alert, input)).sort(compareAlertsByRecency);
  }
}

function matchesFilters(alert: Alert, input: ListAlertsInput): boolean {
  if (input.severity !== undefined && alert.severity !== input.severity) {
    return false;
  }

  if (input.status !== undefined && alert.status !== input.status) {
    return false;
  }

  if (
    input.host !== undefined &&
    alert.evidence.host?.toLocaleLowerCase() !== input.host.toLocaleLowerCase()
  ) {
    return false;
  }

  if (input.from !== undefined && alert.evidence.occurredAt < input.from) {
    return false;
  }

  return input.to === undefined || alert.evidence.occurredAt <= input.to;
}
