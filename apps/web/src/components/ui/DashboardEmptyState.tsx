import { Radar } from 'lucide-react';

export function DashboardEmptyState(): React.JSX.Element {
  return (
    <section
      className="flex min-h-[calc(100vh-13rem)] items-center justify-center"
      aria-label="Dashboard"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
          <Radar aria-hidden="true" className="size-7" strokeWidth={1.4} />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-slate-100">No security activity</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">There are no events to display.</p>
      </div>
    </section>
  );
}
