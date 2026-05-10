import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Info, Smartphone, TriangleAlert } from 'lucide-react';
import { apiClient } from '../../api/client';

type AnyRecord = Record<string, any>;
type AlertSourceFilter = 'all' | 'kids' | 'guardscreen';

const kidsAlertTypes = ['kids_app_blocked', 'kids_limit_reached', 'kids_bedtime_violation'];

function alertBadgeClass(alertType: string): string {
  if (kidsAlertTypes.includes(alertType)) {
    return 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20';
  }
  if (['detection', 'uninstall_attempt'].includes(alertType)) {
    return 'bg-rose-400/10 text-rose-400 border border-rose-400/20';
  }
  return 'bg-slate-700/50 text-slate-300 border border-white/10';
}

function alertTypeLabel(alertType: string): string {
  switch (alertType) {
    case 'kids_app_blocked':
      return '🚫 App Blocked';
    case 'kids_limit_reached':
      return '⏱ Limit Reached';
    case 'kids_bedtime_violation':
      return '🌙 Bedtime';
    case 'detection':
      return '🛡 Detection';
    case 'uninstall_attempt':
      return '⚠ Uninstall Attempt';
    case 'pin_failed':
      return '🔑 PIN Failed';
    case 'service_disabled':
      return '⛔ Service Disabled';
    default:
      return alertType.replace(/_/g, ' ');
  }
}

export default function AlertsScreen() {
  const [filter, setFilter] = useState('');
  const [filterSource, setFilterSource] = useState<AlertSourceFilter>('all');

  const { data: alerts = [], isLoading } = useQuery<AnyRecord[]>({
    queryKey: ['alerts'],
    queryFn: async () => (await apiClient.get('/alerts')).data,
  });

  const filteredAlerts = useMemo(() => {
    const sourceFiltered =
      filterSource === 'kids'
        ? alerts.filter((alert) => kidsAlertTypes.includes(alert.alertType))
        : filterSource === 'guardscreen'
          ? alerts.filter((alert) => !kidsAlertTypes.includes(alert.alertType))
          : alerts;

    if (!filter.trim()) return sourceFiltered;
    const needle = filter.trim().toLowerCase();
    return sourceFiltered.filter((alert) =>
      [alert.message, alert.alertType, alert.device?.name, alert.device?.profile?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [alerts, filter, filterSource]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Alerts</h1>
        <p className="text-slate-500 dark:text-slate-400">Recent family alerts across all child profiles and linked devices.</p>
      </header>

      <div className="glass-panel p-4">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by message, profile, device, or alert type"
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
        />
        <div className="mt-3 flex gap-2">
          {(['all', 'kids', 'guardscreen'] as const).map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setFilterSource(source)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filterSource === source
                  ? 'bg-brand-600 text-white'
                  : 'border border-white/10 text-slate-400 hover:bg-white/5'
              }`}
            >
              {source === 'all' ? 'All alerts' : source === 'kids' ? '🧒 Kids' : '🛡 GuardScreen'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="glass-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-dark-700 flex items-center justify-center mb-4">
            <Info className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">No alerts matched</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm">
            Alerts from detections and other family events will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div key={alert.id} className="glass-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{alert.message}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${alertBadgeClass(alert.alertType)}`}>
                        {alertTypeLabel(alert.alertType)}
                      </span>
                      {alert.source === 'kids' && (
                        <span className="rounded-full bg-accent-teal/10 px-2 py-0.5 text-[10px] font-semibold text-accent-teal">
                          Kids
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      {alert.device?.profile?.name ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-700 px-2.5 py-1">
                          <TriangleAlert className="w-3 h-3" />
                          {alert.device.profile.name}
                        </span>
                      ) : null}
                      {alert.device?.name ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-dark-700 px-2.5 py-1">
                          <Smartphone className="w-3 h-3" />
                          {alert.device.name}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {new Date(alert.sentAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
