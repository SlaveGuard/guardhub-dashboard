import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Users, ShieldAlert, Settings, LogOut, Activity, Siren, CreditCard } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Sidebar() {
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const { data: unreadAlerts } = useQuery<number>({
    queryKey: ['alerts', 'unread-count'],
    queryFn: async () => {
      const response = await apiClient.get('/alerts');
      const items: Record<string, unknown>[] = Array.isArray(response.data)
        ? response.data
        : (response.data?.items ?? []);
      return items.filter((alert) => !alert.isRead).length;
    },
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
  const unreadCount = unreadAlerts ?? 0;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Activity', path: '/telemetry', icon: ShieldAlert },
    { name: 'Alerts', path: '/alerts', icon: Siren },
    { name: 'Profiles', path: '/profiles', icon: Users },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'Subscription', path: '/subscription', icon: CreditCard },
  ];

  return (
    <div className="sticky top-0 h-screen w-64 shrink-0 glass-panel rounded-none border-y-0 border-l-0 flex flex-col overflow-y-auto">
      {/* Brand */}
      <div className="p-6 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center border border-brand-500/50">
          <Activity className="w-6 h-6 text-brand-400" />
        </div>
        <span className="text-xl font-bold text-slate-900 dark:text-slate-100">GuardHub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-brand-500/10 text-brand-500 dark:text-brand-400 border border-brand-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-700 hover:text-slate-900 dark:hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
            {item.name === 'Alerts' && unreadCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-white/5">
        <div className="flex items-center space-x-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-dark-700 flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-300">
            {user?.name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex flex-col truncate">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{user?.name || 'Parent'}</span>
            <span className="text-xs text-slate-500 dark:text-slate-500 truncate">{user?.email}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex w-full items-center space-x-3 px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
