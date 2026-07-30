import {
  Activity,
  type LucideIcon,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Upload,
} from 'lucide-react';

export type NavigationItemId = 'dashboard' | 'uploads' | 'alerts' | 'analysis' | 'settings';

export interface NavigationItem {
  icon: LucideIcon;
  id: NavigationItemId;
  label: string;
}

export const navigationItems: readonly NavigationItem[] = [
  { icon: LayoutDashboard, id: 'dashboard', label: 'Dashboard' },
  { icon: Upload, id: 'uploads', label: 'Uploads' },
  { icon: ShieldAlert, id: 'alerts', label: 'Alerts' },
  { icon: Activity, id: 'analysis', label: 'Analysis' },
  { icon: Settings, id: 'settings', label: 'Settings' },
];
