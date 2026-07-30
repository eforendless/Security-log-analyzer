import { Shield, X } from 'lucide-react';
import type { NavigationItem, NavigationItemId } from './navigation';

interface SidebarProps {
  activeItem: NavigationItemId;
  isOpen: boolean;
  items: readonly NavigationItem[];
  onClose: () => void;
  onNavigate: (itemId: NavigationItemId) => void;
}

export function Sidebar({
  activeItem,
  isOpen,
  items,
  onClose,
  onNavigate,
}: SidebarProps): React.JSX.Element {
  const visibilityClass = isOpen ? 'translate-x-0' : '-translate-x-full';

  return (
    <aside
      aria-label="Primary navigation"
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-cyan-400/15 bg-[#0c131d] px-4 py-5 shadow-2xl shadow-black/35 transition-transform duration-200 lg:translate-x-0 ${visibilityClass}`}
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center border border-cyan-300/40 bg-cyan-400/10 text-cyan-200">
            <Shield aria-hidden="true" className="size-5" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.08em] text-slate-100">SENTINEL</p>
            <p className="mt-0.5 text-[10px] font-medium tracking-[0.16em] text-cyan-300/70">
              LOG ANALYZER
            </p>
          </div>
        </div>
        <button
          aria-label="Close navigation"
          className="grid size-9 place-items-center text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 lg:hidden"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <nav className="mt-12" aria-label="Workspace">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeItem;

            return (
              <li key={item.id}>
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
                      : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/70 hover:text-slate-100'
                  }`}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-slate-800 px-2 pt-5 text-[10px] font-medium tracking-[0.14em] text-slate-500">
        SECURE WORKSPACE
      </div>
    </aside>
  );
}
