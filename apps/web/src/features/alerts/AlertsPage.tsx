import { useEffect, useState } from 'react';
import { Filter, RefreshCw, Save, ShieldAlert, Sparkles } from 'lucide-react';
import type {
  AlertDetail,
  AlertSeverity,
  AlertsResponse,
  AlertStatus,
} from '@security-log-analyzer/contracts';
import {
  analyzeAlert,
  getAlert,
  getAlerts,
  updateAlertTriage,
  type AlertFilters,
} from './alerts-api';

const severityOptions: readonly AlertSeverity[] = [
  'informational',
  'low',
  'medium',
  'high',
  'critical',
];
const statusOptions: readonly AlertStatus[] = ['open', 'triaged'];

const severityStyles: Record<AlertSeverity, string> = {
  critical: 'border-rose-400/45 bg-rose-400/10 text-rose-200',
  high: 'border-orange-400/45 bg-orange-400/10 text-orange-200',
  informational: 'border-slate-600 bg-slate-800/70 text-slate-300',
  low: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  medium: 'border-amber-400/45 bg-amber-400/10 text-amber-200',
};

export function AlertsPage(): React.JSX.Element {
  const [alerts, setAlerts] = useState<AlertsResponse['alerts']>([]);
  const [filters, setFilters] = useState<AlertFilters>({});
  const [hostFilter, setHostFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertDetail | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [triageNote, setTriageNote] = useState('');
  const [triageStatus, setTriageStatus] = useState<AlertStatus>('open');

  async function loadAlerts(nextFilters: AlertFilters = filters): Promise<void> {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await getAlerts(nextFilters);
      setAlerts(response.alerts);

      const nextSelectedId = response.alerts.some((alert) => alert.id === selectedAlertId)
        ? selectedAlertId
        : (response.alerts[0]?.id ?? null);

      if (nextSelectedId === null) {
        setSelectedAlert(null);
        setSelectedAlertId(null);
      } else {
        await loadAlertDetail(nextSelectedId);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The alerts could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAlertDetail(alertId: string): Promise<void> {
    setSelectedAlertId(alertId);

    try {
      const response = await getAlert(alertId);
      setSelectedAlert(response.alert);
      setTriageNote(response.alert.triageNote ?? '');
      setTriageStatus(response.alert.status);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The alert could not be loaded.');
    }
  }

  async function handleSaveTriage(): Promise<void> {
    if (selectedAlert === null) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await updateAlertTriage(selectedAlert.id, {
        note: triageNote.trim() === '' ? null : triageNote.trim(),
        status: triageStatus,
      });
      setSelectedAlert(response.alert);
      setTriageNote(response.alert.triageNote ?? '');
      setTriageStatus(response.alert.status);
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === response.alert.id
            ? { ...alert, severity: response.alert.severity, status: response.alert.status }
            : alert,
        ),
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The alert triage could not be updated.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAnalyzeAlert(): Promise<void> {
    if (selectedAlert === null) {
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);

    try {
      const response = await analyzeAlert(selectedAlert.id);
      setSelectedAlert(response.alert);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The alert could not be analyzed.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextFilters: AlertFilters = {
      host: hostFilter,
      severity: filters.severity,
      status: filters.status,
    };
    setFilters(nextFilters);
    void loadAlerts(nextFilters);
  }

  function clearFilters(): void {
    setFilters({});
    setHostFilter('');
    void loadAlerts({});
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialAlerts(): Promise<void> {
      try {
        const response = await getAlerts();

        if (!isMounted) {
          return;
        }

        setAlerts(response.alerts);
        const initialAlertId = response.alerts[0]?.id;

        if (initialAlertId === undefined) {
          setIsLoading(false);
          return;
        }

        setSelectedAlertId(initialAlertId);
        const detailResponse = await getAlert(initialAlertId);

        if (!isMounted) {
          return;
        }

        setSelectedAlert(detailResponse.alert);
        setTriageNote(detailResponse.alert.triageNote ?? '');
        setTriageStatus(detailResponse.alert.status);
      } catch (error: unknown) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'The alerts could not be loaded.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialAlerts();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300">ALERT QUEUE</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Event-derived alerts</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Deterministic severity and analyst triage for normalized security events.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          onClick={() => void loadAlerts()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Refresh
        </button>
      </div>

      {errorMessage !== null ? (
        <p
          className="mt-5 border-l-2 border-rose-400 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form
        className="mt-6 grid gap-3 border border-slate-800 bg-[#0c131d]/80 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto_auto]"
        onSubmit={applyFilters}
      >
        <label className="grid gap-1.5 text-xs font-medium text-slate-400">
          Host
          <input
            className="h-10 border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300"
            onChange={(event) => setHostFilter(event.target.value)}
            placeholder="Filter exact host"
            value={hostFilter}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-400">
          Severity
          <select
            className="h-10 border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                severity:
                  event.target.value === '' ? undefined : (event.target.value as AlertSeverity),
              }))
            }
            value={filters.severity ?? ''}
          >
            <option value="">All severities</option>
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {formatLabel(severity)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-400">
          Status
          <select
            className="h-10 border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value === '' ? undefined : (event.target.value as AlertStatus),
              }))
            }
            value={filters.status ?? ''}
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 self-end border border-cyan-300/45 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20"
          type="submit"
        >
          <Filter aria-hidden="true" className="size-3.5" />
          Apply
        </button>
        <button
          className="h-10 self-end px-3 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-100"
          onClick={clearFilters}
          type="button"
        >
          Clear
        </button>
      </form>

      {isLoading && alerts.length === 0 ? (
        <div className="flex min-h-72 items-center justify-center text-sm text-slate-400">
          Loading alert queue...
        </div>
      ) : alerts.length === 0 ? (
        <div className="mt-6 border border-slate-800 bg-slate-950/40 px-5 py-12 text-center">
          <ShieldAlert aria-hidden="true" className="mx-auto size-5 text-slate-500" />
          <p className="mt-3 text-sm font-medium text-slate-200">
            No alerts match the current filters.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Upload and parse a text security export to populate this queue.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
          <section aria-label="Alert list" className="overflow-x-auto border border-slate-800">
            <table className="min-w-[700px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-950/70 text-xs font-semibold tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Occurred</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-[#0c131d]/70 text-slate-300">
                {alerts.map((alert) => (
                  <tr
                    aria-selected={alert.id === selectedAlertId}
                    className={
                      alert.id === selectedAlertId
                        ? 'bg-cyan-400/10 outline outline-1 -outline-offset-1 outline-cyan-300/35'
                        : 'hover:bg-slate-800/40'
                    }
                    key={alert.id}
                  >
                    <td className="px-4 py-3">
                      <button
                        className="w-full text-left"
                        onClick={() => void loadAlertDetail(alert.id)}
                        type="button"
                      >
                        <SeverityBadge severity={alert.severity} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="max-w-52 truncate text-left font-medium text-slate-100 hover:text-cyan-200"
                        onClick={() => void loadAlertDetail(alert.id)}
                        title={`${alert.provider} ${alert.eventId}`}
                        type="button"
                      >
                        {alert.provider} / {alert.eventId}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{alert.host ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(alert.occurredAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {formatLabel(alert.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <AlertDetailPanel
            alert={selectedAlert}
            isAnalyzing={isAnalyzing}
            isSaving={isSaving}
            onAnalyze={() => void handleAnalyzeAlert()}
            onNoteChange={setTriageNote}
            onSave={() => void handleSaveTriage()}
            onStatusChange={setTriageStatus}
            triageNote={triageNote}
            triageStatus={triageStatus}
          />
        </div>
      )}
    </section>
  );
}

interface AlertDetailPanelProps {
  readonly alert: AlertDetail | null;
  readonly isAnalyzing: boolean;
  readonly isSaving: boolean;
  readonly onAnalyze: () => void;
  readonly onNoteChange: (note: string) => void;
  readonly onSave: () => void;
  readonly onStatusChange: (status: AlertStatus) => void;
  readonly triageNote: string;
  readonly triageStatus: AlertStatus;
}

function AlertDetailPanel({
  alert,
  isAnalyzing,
  isSaving,
  onAnalyze,
  onNoteChange,
  onSave,
  onStatusChange,
  triageNote,
  triageStatus,
}: AlertDetailPanelProps): React.JSX.Element {
  if (alert === null) {
    return (
      <aside className="border border-slate-800 bg-[#0c131d]/80 p-5 text-sm text-slate-400">
        Select an alert to inspect its evidence and update triage.
      </aside>
    );
  }

  return (
    <aside className="border border-slate-800 bg-[#0c131d]/80 p-5" aria-label="Alert detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.1em] text-slate-500">ALERT EVIDENCE</p>
          <h2 className="mt-2 text-base font-semibold text-slate-100">
            {alert.provider} / {alert.eventId}
          </h2>
        </div>
        <SeverityBadge severity={alert.severity} />
      </div>

      <p className="mt-5 border-l-2 border-cyan-300/60 pl-3 text-sm leading-6 text-slate-200">
        {alert.message}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-800 py-4 text-xs">
        <EvidenceField label="Host" value={alert.host ?? 'Unknown'} />
        <EvidenceField label="User" value={alert.user ?? 'Unknown'} />
        <EvidenceField label="Occurred" value={formatDateTime(alert.occurredAt)} />
        <EvidenceField label="Level" value={alert.level} />
        <EvidenceField label="Source record" value={String(alert.sourceRecord)} />
        <EvidenceField
          label="Triage updated"
          value={alert.triageUpdatedAt ? formatDateTime(alert.triageUpdatedAt) : 'Not triaged'}
        />
      </dl>

      <section
        className="mt-5 border border-slate-800 bg-slate-950/35 p-4"
        aria-labelledby="analysis-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.1em] text-cyan-300">AI ANALYSIS</p>
            <h3 id="analysis-heading" className="mt-1 text-sm font-semibold text-slate-100">
              Structured assessment
            </h3>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 border border-cyan-300/45 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isAnalyzing}
            onClick={onAnalyze}
            type="button"
          >
            <Sparkles aria-hidden="true" className="size-3.5" />
            {isAnalyzing
              ? 'Analyzing...'
              : alert.analysis === null
                ? 'Analyze alert'
                : 'Refresh analysis'}
          </button>
        </div>

        {alert.analysis === null ? (
          <p className="mt-4 text-sm leading-6 text-slate-400">
            No AI assessment has been generated for this alert.
          </p>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.analysis.severity} />
              <span className="text-xs text-slate-400">
                Confidence: {Math.round(alert.analysis.confidence * 100)}%
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-100">{alert.analysis.summary}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{alert.analysis.explanation}</p>

            <AnalysisSection title="MITRE techniques">
              {alert.analysis.techniques.length === 0 ? (
                <p className="text-xs text-slate-500">No technique mapping was returned.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {alert.analysis.techniques.map((technique) => (
                    <li
                      className="border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-300"
                      key={technique.id}
                    >
                      <span className="font-semibold text-cyan-200">{technique.id}</span>{' '}
                      {technique.name}
                    </li>
                  ))}
                </ul>
              )}
            </AnalysisSection>

            <AnalysisSection title="Recommendations">
              {alert.analysis.recommendations.length === 0 ? (
                <p className="text-xs text-slate-500">No recommendations were returned.</p>
              ) : (
                <ul className="grid gap-2 text-sm leading-6 text-slate-300">
                  {alert.analysis.recommendations.map((recommendation) => (
                    <li className="border-l-2 border-cyan-300/50 pl-3" key={recommendation}>
                      {recommendation}
                    </li>
                  ))}
                </ul>
              )}
            </AnalysisSection>

            <p className="mt-4 text-xs text-slate-500">
              {alert.analysis.model} / {alert.analysis.promptVersion} /{' '}
              {formatDateTime(alert.analysis.createdAt)}
            </p>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-xs font-medium text-slate-400">
          Analyst status
          <select
            className="h-10 border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-300"
            onChange={(event) => onStatusChange(event.target.value as AlertStatus)}
            value={triageStatus}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-slate-400">
          Analyst note
          <textarea
            className="min-h-28 resize-y border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300"
            maxLength={2000}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Record triage context"
            value={triageNote}
          />
        </label>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 border border-cyan-300/45 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          onClick={onSave}
          type="button"
        >
          <Save aria-hidden="true" className="size-3.5" />
          {isSaving ? 'Saving...' : 'Save triage'}
        </button>
      </div>
    </aside>
  );
}

function AnalysisSection({
  children,
  title,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}): React.JSX.Element {
  return (
    <section className="mt-5">
      <h4 className="text-xs font-semibold tracking-[0.08em] text-slate-500">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EvidenceField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-200">{value}</dd>
    </div>
  );
}

function SeverityBadge({ severity }: { readonly severity: AlertSeverity }): React.JSX.Element {
  return (
    <span
      className={`inline-flex border px-2 py-1 text-[11px] font-semibold tracking-[0.06em] ${severityStyles[severity]}`}
    >
      {formatLabel(severity)}
    </span>
  );
}

function formatDateTime(value: string): string {
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function formatLabel(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
