import { Menu, ShieldCheck } from 'lucide-react';
import type { NavigationItem } from './navigation';

interface TopNavigationProps {
  activeItem: NavigationItem;
  isNavigationOpen: boolean;
  onOpenNavigation: () => void;
}

export function TopNavigation({
  activeItem,
  isNavigationOpen,
  onOpenNavigation,
}: TopNavigationProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-slate-800/90 bg-[#0a0f16]/95 px-5 backdrop-blur lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-controls="primary-navigation"
          aria-expanded={isNavigationOpen}
          aria-label="Open navigation"
          className="grid size-10 place-items-center border border-slate-700 text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100 lg:hidden"
          onClick={onOpenNavigation}
          type="button"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-100">{activeItem.label}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">Security operations workspace</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
        <ShieldCheck aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Protected</span>
      </div>
    </header>
  );
}
