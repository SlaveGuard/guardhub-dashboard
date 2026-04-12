import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { ShieldAlert, Clock, Smartphone, Info } from 'lucide-react';
import { format } from 'date-fns';

export default function TelemetryScreen() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['telemetry'],
    queryFn: async () => {
      const res = await apiClient.get('/detection-events');
      return res.data;
    },
    refetchInterval: 5000 // Poll every 5s for live updates
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Telemetry Logs</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time explicit content detection feed from all devices.</p>
      </header>

      {isLoading ? (
        <div className="glass-panel p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : events?.length === 0 || !events ? (
        <div className="glass-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-dark-700 flex items-center justify-center mb-4">
            <Info className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No events detected</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
            Everything looks clean! When explicit content is detected and blocked on a child's device, it will appear here.
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden border-none shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100/50 dark:bg-dark-700/50 border-b border-slate-200 dark:border-white/5">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Timestamp</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Device</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">App</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Confidence</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {events.map((event: any) => (
                  <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{format(new Date(event.createdAt), 'MMM d, HH:mm:ss')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                        <Smartphone className="w-4 h-4 text-brand-500" />
                        <span>{event.device?.model || 'Unknown Device'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      <span className="bg-slate-100 dark:bg-dark-700 px-2 py-1 rounded text-xs font-mono">
                        {event.appName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-slate-200 dark:bg-dark-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-accent-rose" 
                            style={{ width: `${event.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {(event.confidence * 100).toFixed(0)}%
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
