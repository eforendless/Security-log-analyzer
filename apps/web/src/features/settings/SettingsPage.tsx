import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { SettingsResponse } from '@security-log-analyzer/contracts';
import { getSettings } from './settings-api';

const desktopConfigurationPath = '%APPDATA%\\Security Log Analyzer\\config\\.env';

export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadSettings(): Promise<void> {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      setSettings(await getSettings());
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The settings could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }

  async function copyConfigurationPath(): Promise<void> {
    try {
      await navigator.clipboard.writeText(desktopConfigurationPath);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2_000);
    } catch {
      setErrorMessage('The configuration path could not be copied.');
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-cyan-300">LOCAL SETTINGS</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Configuration and privacy</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Review the active AI analysis configuration without exposing provider credentials.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-300/40 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
          onClick={() => void loadSettings()}
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

      {isLoading && settings === null ? (
        <div className="flex min-h-72 items-center justify-center text-sm text-slate-400">
          Loading local configuration...
        </div>
      ) : settings === null ? null : (
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <section
            className="border border-slate-800 bg-[#0c131d]/80 p-5"
            aria-labelledby="ai-settings-heading"
          >
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
                <KeyRound aria-hidden="true" className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.1em] text-cyan-300">AI ANALYSIS</p>
                <h2
                  id="ai-settings-heading"
                  className="mt-1 text-base font-semibold text-slate-100"
                >
                  OpenAI provider
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-3">
              <SettingMetric
                label="Configuration"
                value={settings.settings.aiAnalysis.configured ? 'Configured' : 'Not configured'}
              />
              <SettingMetric label="Model" value={settings.settings.aiAnalysis.model} />
              <SettingMetric
                label="Timeout"
                value={`${settings.settings.aiAnalysis.timeoutMs / 1_000} seconds`}
              />
            </div>

            <div
              className={`mt-5 border-l-2 px-3 py-2 text-sm leading-6 ${settings.settings.aiAnalysis.configured ? 'border-emerald-400 bg-emerald-400/10 text-emerald-100' : 'border-amber-400 bg-amber-400/10 text-amber-100'}`}
            >
              {settings.settings.aiAnalysis.configured
                ? 'A provider key was loaded at startup. This screen never displays the key.'
                : 'AI analysis is unavailable until a provider key is added to the private configuration file and the app is restarted.'}
            </div>
          </section>

          <aside
            className="border border-slate-800 bg-slate-950/40 p-5"
            aria-labelledby="privacy-heading"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 text-emerald-300" />
              <div>
                <p className="text-xs font-semibold tracking-[0.1em] text-emerald-300">
                  PRIVATE BY DEFAULT
                </p>
                <h2 id="privacy-heading" className="mt-1 text-base font-semibold text-slate-100">
                  Evidence stays local
                </h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              Original uploads, alert state, and AI configuration remain in your Windows
              application-data directory. Only bounded, redacted alert evidence is sent when you
              request AI analysis.
            </p>
          </aside>
        </div>
      )}

      <section
        className="mt-6 border border-slate-800 bg-[#0c131d]/80 p-5"
        aria-labelledby="configuration-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.1em] text-slate-500">WINDOWS DESKTOP</p>
            <h2 id="configuration-heading" className="mt-1 text-base font-semibold text-slate-100">
              Private configuration file
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Edit this file to configure the AI provider. Restart the desktop app after every
              change.
            </p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-2 border border-cyan-300/45 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/20"
            onClick={() => void copyConfigurationPath()}
            type="button"
          >
            {isCopied ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <Copy aria-hidden="true" className="size-3.5" />
            )}
            {isCopied ? 'Copied' : 'Copy path'}
          </button>
        </div>

        <code className="mt-5 block overflow-x-auto border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs text-cyan-100">
          {desktopConfigurationPath}
        </code>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-slate-500">
              CONFIGURATION FORMAT
            </p>
            <pre className="mt-3 overflow-x-auto font-mono text-xs leading-6 text-slate-300">{`OPENAI_API_KEY=your_key_here\nOPENAI_MODEL=gpt-4.1-mini`}</pre>
          </div>
          <div className="flex gap-3 border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <p>
              Never paste an API key into an alert, upload, or support request. This app
              intentionally does not display saved credentials.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

function SettingMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0 bg-[#0a0f16] px-4 py-3">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-100" title={value}>
        {value}
      </p>
    </div>
  );
}
