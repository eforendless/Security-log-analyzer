import { useState, type ChangeEvent, type FormEvent } from 'react';
import { FileText, RefreshCw, Upload } from 'lucide-react';
import type { UploadResponse } from '@security-log-analyzer/contracts';
import { createUpload, getUploadStatus } from './uploads-api';

const acceptedFiles = '.txt,.log,.csv,.json,.xml';

export function UploadPage(): React.JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    setSelectedFile(event.target.files?.[0] ?? null);
    setErrorMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (selectedFile === null) {
      setErrorMessage('Choose a text log export before uploading.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      setUpload(await createUpload(selectedFile));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The upload could not be completed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshStatus(): Promise<void> {
    if (upload === null) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      setUpload(await getUploadStatus(upload.upload.id));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'The upload status could not be refreshed.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300">EVIDENCE INTAKE</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Upload a text log export</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Text exports are parsed and stored privately for the next analysis stage.
        </p>
      </div>

      <form className="mt-8" onSubmit={handleSubmit}>
        <label className="block border border-dashed border-slate-600 bg-slate-950/35 p-6 transition-colors hover:border-cyan-300/50 sm:p-9">
          <span className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
              <FileText aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-100">
                {selectedFile?.name ?? 'Select an exported log file'}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Accepted: TXT, LOG, CSV, JSON, or XML. Maximum size is configured by the API.
              </span>
            </span>
          </span>
          <input
            accept={acceptedFiles}
            className="sr-only"
            onChange={handleFileChange}
            type="file"
          />
        </label>

        {errorMessage !== null ? (
          <p
            className="mt-4 border-l-2 border-rose-400 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <button
          className="mt-5 inline-flex h-11 items-center gap-2 bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          disabled={isSubmitting}
          type="submit"
        >
          <Upload aria-hidden="true" className="size-4" />
          {isSubmitting ? 'Uploading' : 'Upload log'}
        </button>
      </form>

      {upload !== null ? (
        <section
          className="mt-8 border border-emerald-400/25 bg-emerald-400/5 p-5"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-emerald-300">
                UPLOAD ACCEPTED
              </p>
              <h2 className="mt-2 break-all text-base font-medium text-slate-100">
                {upload.upload.originalFileName}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Status: <span className="font-medium text-emerald-300">{upload.upload.status}</span>
              </p>
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 border border-emerald-300/30 px-3 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:text-slate-500"
              disabled={isSubmitting}
              onClick={() => void refreshStatus()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Refresh status
            </button>
          </div>
          {upload.upload.parsingSummary !== undefined ? (
            <div className="mt-5 grid gap-px border border-emerald-400/20 bg-emerald-400/20 sm:grid-cols-3">
              <ParseMetric
                label="Parsed events"
                value={String(upload.upload.parsingSummary.eventCount)}
              />
              <ParseMetric
                label="Skipped records"
                value={String(upload.upload.parsingSummary.skippedRecordCount)}
              />
              <ParseMetric
                label="Time range"
                value={formatTimeRange(
                  upload.upload.parsingSummary.earliestOccurredAt,
                  upload.upload.parsingSummary.latestOccurredAt,
                )}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

interface ParseMetricProps {
  readonly label: string;
  readonly value: string;
}

function ParseMetric({ label, value }: ParseMetricProps): React.JSX.Element {
  return (
    <div className="min-w-0 bg-[#0c131d] px-4 py-3">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-100" title={value}>
        {value}
      </p>
    </div>
  );
}

function formatTimeRange(earliest: string | null, latest: string | null): string {
  if (earliest === null || latest === null) {
    return 'No valid timestamps';
  }

  const start = new Date(earliest).toISOString().replace('T', ' ').replace('.000Z', 'Z');
  const end = new Date(latest).toISOString().replace('T', ' ').replace('.000Z', 'Z');

  return start === end ? start : `${start} - ${end}`;
}
