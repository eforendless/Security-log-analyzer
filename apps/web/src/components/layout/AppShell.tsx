import { useState } from 'react';
import { UploadPage } from '../../features/uploads/UploadPage';
import { DashboardEmptyState } from '../ui/DashboardEmptyState';
import { PageTitle } from '../ui/PageTitle';
import { navigationItems, type NavigationItemId } from './navigation';
import { Sidebar } from './Sidebar';
import { TopNavigation } from './TopNavigation';

export function AppShell(): React.JSX.Element {
  const [activeItemId, setActiveItemId] = useState<NavigationItemId>('dashboard');
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const activeItem =
    navigationItems.find((item) => item.id === activeItemId) ?? navigationItems[0]!;

  function handleNavigation(itemId: NavigationItemId): void {
    setActiveItemId(itemId);
    setIsNavigationOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0f16] text-slate-100">
      {isNavigationOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          onClick={() => setIsNavigationOpen(false)}
          type="button"
        />
      ) : null}
      <Sidebar
        activeItem={activeItemId}
        isOpen={isNavigationOpen}
        items={navigationItems}
        onClose={() => setIsNavigationOpen(false)}
        onNavigate={handleNavigation}
      />
      <main className="min-h-screen lg:pl-72">
        <TopNavigation
          activeItem={activeItem}
          isNavigationOpen={isNavigationOpen}
          onOpenNavigation={() => setIsNavigationOpen(true)}
        />
        <div className="px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
          {activeItemId === 'dashboard' ? (
            <DashboardEmptyState />
          ) : activeItemId === 'uploads' ? (
            <UploadPage />
          ) : (
            <PageTitle title={activeItem.label} />
          )}
        </div>
      </main>
    </div>
  );
}
