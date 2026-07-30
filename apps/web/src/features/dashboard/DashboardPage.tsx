import { useEffect, useState } from 'react';
import { Activity, FileCheck2, FileStack, RefreshCw, TriangleAlert } from 'lucide-react';
import type { DashboardResponse } from '@security-log-analyzer/contracts';
import { DashboardEmptyState } from '../../components/ui/DashboardEmptyState';
import { getDashboard } from './dashboard-api';

export function DashboardPage(): React.JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboard(): Promise<void> {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      setDashboard(await getDashboard());
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The dashboard could not be loaded.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (isLoading && dashboard === null) {
    return <DashboardLoadingState />;
  }

  if (errorMessage !== null && dashboard === null) {
    return <DashboardErrorState errorMessage={errorMessage} onRetry={() => void loadDashboard()} />;
  }

  if (dashboard === null || dashboard.dashboard.statistics.uploadCount === 0) {
    return <DashboardEmptyState />;
  }

  const { recentParsedUploads, statistics } = dashboard.dashboard;

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300">
            OPERATIONS OVERVIEW
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Security log activity</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Parsed upload activity and deterministic event summaries.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100"
          disabled={isLoading}
          onClick={() => void loadDashboard()}
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

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric icon={FileStack} label="Total uploads" value={statistics.uploadCount} />
        <DashboardMetric
          icon={FileCheck2}
          label="Parsed uploads"
          value={statistics.parsedUploadCount}
        />
        <DashboardMetric
          icon={Activity}
          label="Normalized events"
          value={statistics.parsedEventCount}
        />
        <DashboardMetric
          icon={TriangleAlert}
          label="Skipped records"
          value={statistics.skippedRecordCount}
        />
      </div>

      <section className="mt-8" aria-labelledby="recent-uploads-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-uploads-heading" className="text-base font-semibold text-slate-100">
            Recent parsed uploads
          </h2>
          <p className="text-xs text-slate-500">Unparsed uploads: {statistics.uploadedCount}</p>
        </div>
        {recentParsedUploads.length === 0 ? (
          <p className="mt-4 border border-slate-800 bg-slate-950/40 px-4 py-5 text-sm text-slate-400">
            No uploads have completed parsing yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-slate-800">
            <table className="min-w-[660px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-950/70 text-xs font-semibold tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Export</th>
                  <th className="px-4 py-3">Parsed</th>
                  <th className="px-4 py-3">Skipped</th>
                  <th className="px-4 py-3">Event range</th>
                  <th className="px-4 py-3">Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-[#0c131d]/70 text-slate-300">
                {recentParsedUploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-slate-800/40">
                    <td
                      className="max-w-56 truncate px-4 py-3 font-medium text-slate-100"
                      title={upload.originalFileName}
                    >
                      {upload.originalFileName}
                    </td>
                    <td className="px-4 py-3 text-cyan-200">{upload.eventCount}</td>
                    <td className="px-4 py-3">{upload.skippedRecordCount}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatEventRange(upload.earliestOccurredAt, upload.latestOccurredAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDateTime(upload.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

interface DashboardMetricProps {
  readonly icon: typeof Activity;
  readonly label: string;
  readonly value: number;
}

function DashboardMetric({ icon: Icon, label, value }: DashboardMetricProps): React.JSX.Element {
  return (
    <div className="border border-slate-800 bg-[#0c131d]/80 p-4">
      <Icon aria-hidden="true" className="size-4 text-cyan-300" strokeWidth={1.8} />
      <p className="mt-5 text-2xl font-semibold text-slate-100">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-medium tracking-[0.08em] text-slate-500">{label}</p>
    </div>
  );
}

function DashboardLoadingState(): React.JSX.Element {
  return (
    <section
      className="flex min-h-[calc(100vh-13rem)] items-center justify-center"
      aria-label="Loading dashboard"
    >
      <p className="text-sm text-slate-400">Loading dashboard activity...</p>
    </section>
  );
}

interface DashboardErrorStateProps {
  readonly errorMessage: string;
  readonly onRetry: () => void;
}

function DashboardErrorState({
  errorMessage,
  onRetry,
}: DashboardErrorStateProps): React.JSX.Element {
  return (
    <section
      className="flex min-h-[calc(100vh-13rem)] items-center justify-center"
      aria-label="Dashboard error"
    >
      <div className="max-w-md border border-rose-400/25 bg-rose-400/5 p-6 text-center">
        <p className="text-sm text-rose-200">{errorMessage}</p>
        <button
          className="mt-4 inline-flex h-10 items-center gap-2 border border-rose-300/30 px-3 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-400/10"
          onClick={onRetry}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Retry
        </button>
      </div>
    </section>
  );
}

function formatDateTime(value: string): string {
  return value.replace('T', ' ').replace('.000Z', 'Z');
}

function formatEventRange(earliest: string | null, latest: string | null): string {
  if (earliest === null || latest === null) {
    return 'No valid timestamps';
  }

  const start = formatDateTime(earliest);
  const end = formatDateTime(latest);
  return start === end ? start : `${start} - ${end}`;
}
