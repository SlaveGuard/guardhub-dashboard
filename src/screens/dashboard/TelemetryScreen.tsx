import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, Info, ShieldAlert, Smartphone } from 'lucide-react';
import { apiClient } from '../../api/client';

type AnyRecord = Record<string, any>;

export default function TelemetryScreen() {
  const [filter, setFilter] = useState('');

  const { data: events = [], isLoading } = useQuery<AnyRecord[]>({
    queryKey: ['activity'],
    queryFn: async () => (await apiClient.get('/activity')).data,
  });

  const filteredEvents = useMemo(() => {
    if (!filter.trim()) return events;
    const needle = filter.trim().toLowerCase();
    return events.filter((event) =>
      [event.appName, event.appPackage, event.device?.name, event.device?.profile?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [events, filter]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Activity</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Detection activity across all linked profiles, devices, and app installations.</p>
      </header>

      <div className="glass-panel p-4">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by profile, device, or app"
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
        />
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-dark-700 flex items-center justify-center mb-4">
            <Info className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No activity found</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
            Once linked apps report events, they will appear here.
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden border-none shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-dark-700/50 border-b border-slate-200 dark:border-white/5">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Timestamp</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Profile</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Device</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">App</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Confidence</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{new Date(event.timestamp || new Date()).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {event.device?.profile?.name || 'Unknown profile'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        <Smartphone className="w-4 h-4 text-brand-500" />
                        <span>{event.device?.name || 'Unknown device'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <span className="bg-slate-100 dark:bg-dark-700 px-2 py-1 rounded text-xs font-mono">
                        {event.appName || event.appPackage || 'Unknown app'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-rose"
                            style={{ width: `${(event.confidenceAvg != null ? event.confidenceAvg : 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {((event.confidenceAvg != null ? event.confidenceAvg : 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Blocked
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
