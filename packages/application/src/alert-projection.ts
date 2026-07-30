import type {
  Alert,
  AlertTriageRepository,
  LogUpload,
  UploadRepository,
} from '@security-log-analyzer/domain';
import { projectAlert } from '@security-log-analyzer/domain';

export async function projectAlerts(
  uploadRepository: UploadRepository,
  triageRepository: AlertTriageRepository,
): Promise<readonly Alert[]> {
  const uploads = await uploadRepository.list();
  const alertSources = uploads.flatMap((upload) => {
    if (upload.status !== 'parsed' || upload.parsing === undefined) {
      return [];
    }

    return upload.parsing.events.map((event) => ({ event, upload }));
  });
  const triages = await Promise.all(
    alertSources.map(async ({ event, upload }) => {
      const alertId = `alert-${upload.id}-${event.sourceRecord}`;
      return triageRepository.findByAlertId(alertId);
    }),
  );

  return alertSources.map(({ event, upload }, index) =>
    projectAlert(upload, event, triages[index]),
  );
}

export function compareAlertsByRecency(left: Alert, right: Alert): number {
  const byOccurredAt = right.evidence.occurredAt.getTime() - left.evidence.occurredAt.getTime();

  return byOccurredAt !== 0 ? byOccurredAt : right.id.localeCompare(left.id);
}

export function isParsedUpload(
  upload: LogUpload,
): upload is LogUpload & { parsing: NonNullable<LogUpload['parsing']> } {
  return upload.status === 'parsed' && upload.parsing !== undefined;
}
