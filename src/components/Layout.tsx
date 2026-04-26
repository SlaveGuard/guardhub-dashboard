import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-dark-900 transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex min-h-0 flex-col">
        <header className="h-16 shrink-0 flex items-center justify-end px-8 border-b border-slate-200 dark:border-white/5 bg-white/50 dark:bg-dark-800/50 backdrop-blur-md sticky top-0 z-30">
          <ThemeToggle />
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
