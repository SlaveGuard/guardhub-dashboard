import { Outlet } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { Activity } from 'lucide-react';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-900 transition-colors duration-300 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-teal/10 rounded-full blur-3xl -ml-48 -mb-48"></div>

      <header className="h-20 flex items-center justify-between px-8 relative z-10">
        <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center border border-brand-500/50">
                <Activity className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-500 to-accent-teal">GuardHub</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex items-center justify-center p-4 relative z-10" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <Outlet />
      </main>
    </div>
  );
}
