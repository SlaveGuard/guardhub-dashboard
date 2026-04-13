import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Info, MoveRight, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client';

type AnyRecord = Record<string, any>;

export default function AuditScreen() {
  const [filter, setFilter] = useState('');

  const { data: auditEntries = [], isLoading } = useQuery<AnyRecord[]>({
    queryKey: ['audit'],
    queryFn: async () => (await apiClient.get('/audit')).data,
  });

  const filteredEntries = useMemo(() => {
    if (!filter.trim()) return auditEntries;
    const needle = filter.trim().toLowerCase();
    return auditEntries.filter((entry) =>
      [entry.action, entry.entityType, entry.reason, JSON.stringify(entry.details ?? {})]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [auditEntries, filter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Audit</h1>
        <p className="text-slate-500 dark:text-slate-400">Policy changes, pairings, transfers, and lifecycle events across the family.</p>
      </header>

      <div className="glass-panel p-4">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by action, entity type, reason, or details"
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
        />
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="glass-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-dark-700 flex items-center justify-center mb-4">
            <Info className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No audit entries matched</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
            Transfers, policy changes, pairing events, and profile lifecycle changes will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="glass-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    {entry.entryType === 'transfer' ? (
                      <MoveRight className="w-5 h-5 text-brand-500" />
                    ) : (
                      <ClipboardList className="w-5 h-5 text-brand-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{entry.action}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {entry.entryType} • {entry.entityType}
                    </div>
                    {entry.reason ? (
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{entry.reason}</div>
                    ) : null}
                    {entry.details ? (
                      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 dark:bg-dark-900/70 p-3 text-xs text-slate-700 dark:text-slate-300">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {entry.profileId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-700 px-2.5 py-1">
                          <ShieldCheck className="w-3 h-3" />
                          Profile {entry.profileId}
                        </span>
                      ) : null}
                      {entry.deviceId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-700 px-2.5 py-1">
                          Device {entry.deviceId}
                        </span>
                      ) : null}
                      {entry.appInstallationId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-700 px-2.5 py-1">
                          App {entry.appInstallationId}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
