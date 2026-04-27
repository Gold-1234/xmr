import { ReactNode, useState } from 'react';
import {
  LayoutDashboard, FolderOpen, TrendingUp, Mic, LogOut, Menu, X,
  Activity, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type AppPage = 'dashboard' | 'reports' | 'trends' | 'voice';

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Analyze', icon: LayoutDashboard, description: 'Upload & analyze reports' },
  { id: 'reports', label: 'My Reports', icon: FolderOpen, description: 'Saved report history' },
  { id: 'trends', label: 'Trends', icon: TrendingUp, description: 'Lab value trends over time' },
  { id: 'voice', label: 'Voice Assistant', icon: Mic, description: 'Voice & chat medical assistant' },
];

interface LayoutProps {
  currentPage: string;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}

function getBMI(height: string, weight: string): { value: string; category: string; color: string } | null {
  const h = parseFloat(height);
  const w = parseFloat(weight);
  if (!h || !w) return null;
  const bmi = w / ((h / 100) ** 2);
  const value = bmi.toFixed(1);
  if (bmi < 18.5) return { value, category: 'Underweight', color: 'text-sky-400' };
  if (bmi < 25) return { value, category: 'Normal', color: 'text-emerald-400' };
  if (bmi < 30) return { value, category: 'Overweight', color: 'text-amber-400' };
  return { value, category: 'Obese', color: 'text-red-400' };
}

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const bmi = user?.profile ? getBMI(user.profile.height, user.profile.weight) : null;
  const displayName = user?.profile?.name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-white font-semibold text-sm tracking-wide">XMR</div>
            <div className="text-white/40 text-xs">Explain My Report</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id ||
            (item.id === 'trends' && currentPage === 'trends') ||
            (item.id === 'reports' && (currentPage === 'reports' || currentPage === 'report-detail'));
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
              className={`sidebar-item w-full text-left ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
            </button>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="px-3 pb-4 pt-3 border-t border-white/10 space-y-3">
        {bmi && (
          <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-white/50 text-xs">BMI</span>
              <span className={`text-xs font-medium ${bmi.color}`}>{bmi.category}</span>
            </div>
            <span className="text-white font-semibold">{bmi.value}</span>
          </div>
        )}
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-cyan-300 text-xs font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{displayName}</div>
            <div className="text-white/40 text-xs truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-navy-800 z-30 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-navy-800 z-50 flex flex-col lg:hidden transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute top-4 right-4">
          <button onClick={() => setMobileOpen(false)} className="p-1 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-navy-800 z-30 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="text-white/70 hover:text-white">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cyan-500 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-semibold text-sm">XMR</span>
        </div>
        <div className="flex-1" />
        {/* Mobile bottom nav items */}
      </div>

      {/* Main content */}
      <main className="flex-1 lg:pl-60 pt-14 lg:pt-0 min-h-screen">
        <div className="h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
