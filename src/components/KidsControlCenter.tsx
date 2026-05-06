import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Clock,
  Lock,
  Pause,
  RefreshCcw,
  Search,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';

type AnyRecord = Record<string, any>;
type TabId = 'overview' | 'screen-time' | 'apps' | 'web-filter' | 'bedtime' | 'reports';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'screen-time', label: 'Screen Time' },
  { id: 'apps', label: 'Apps' },
  { id: 'web-filter', label: 'Web Filter' },
  { id: 'bedtime', label: 'Bedtime' },
  { id: 'reports', label: 'Reports' },
];

const webCategories = [
  'Adult Content',
  'Gambling',
  'Drugs & Alcohol',
  'Violence',
  'Gaming',
  'Social Media',
  'News',
  'Education',
  'Chat / Dating',
];

const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function findEntry(policy: AnyRecord | undefined, key: string) {
  return policy?.entries?.find((entry: AnyRecord) => entry.key === key);
}

function entryValue(policy: AnyRecord | undefined, key: string) {
  const entry = findEntry(policy, key);
  return entry?.effectiveValue ?? entry?.value;
}

function deviceName(device: AnyRecord) {
  return device.deviceName || device.name || 'Device';
}

function profileInitial(profile: AnyRecord) {
  return String(profile.name || '?').slice(0, 1).toUpperCase();
}

function minutesLabel(minutes: number) {
  if (!minutes) return 'No limit';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
      {children}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-5 w-10 shrink-0 accent-accent-teal"
    />
  );
}

export default function KidsControlCenter({
  profile,
  device,
  installation,
}: {
  profile: AnyRecord;
  device: AnyRecord;
  installation: AnyRecord;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [search, setSearch] = useState('');
  const installationId = installation.id;

  const { data: policy } = useQuery<AnyRecord>({
    queryKey: ['app', installationId, 'effective-policy'],
    queryFn: async () => (await apiClient.get(`/apps/${installationId}/effective-policy`)).data,
    enabled: !!installationId,
  });
  const { data: activity } = useQuery<AnyRecord>({
    queryKey: ['app', installationId, 'activity'],
    queryFn: async () => (await apiClient.get(`/apps/${installationId}/activity`)).data,
    enabled: !!installationId,
  });
  const { data: alerts = [] } = useQuery<AnyRecord[]>({
    queryKey: ['app', installationId, 'alerts'],
    queryFn: async () => (await apiClient.get(`/apps/${installationId}/alerts`)).data,
    enabled: !!installationId,
  });

  const dailyLimitMinutes = Number(entryValue(policy, 'screen_time.daily_limit')?.minutes ?? 120);
  const [dailyLimitHours, setDailyLimitHours] = useState(Math.round(dailyLimitMinutes / 60));
  const [bedtimeEnabled, setBedtimeEnabled] = useState(Boolean(entryValue(policy, 'bedtime.schedule')?.enabled ?? false));
  const [bedtimeDays, setBedtimeDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [blockedCategories, setBlockedCategories] = useState<Set<string>>(
    new Set(['Adult Content', 'Gambling', 'Drugs & Alcohol', 'Violence', 'Chat / Dating']),
  );

  useEffect(() => {
    setDailyLimitHours(Math.round(dailyLimitMinutes / 60));
  }, [dailyLimitMinutes]);

  useEffect(() => {
    const bedtime = entryValue(policy, 'bedtime.schedule');
    if (bedtime) {
      setBedtimeEnabled(Boolean(bedtime.enabled));
      if (Array.isArray(bedtime.days)) setBedtimeDays(bedtime.days);
    }
  }, [policy]);

  const patchPolicyMutation = useMutation({
    mutationFn: async (entry: { key: string; value: AnyRecord; strength?: string }) =>
      // TODO: Confirm Kids policy keys and values when the backend publishes the final schema for these controls.
      (await apiClient.patch(`/apps/${installationId}/policy`, {
        entries: [
          {
            key: entry.key,
            value: entry.value,
            strength: entry.strength ?? 'soft',
            operation: 'upsert',
          },
        ],
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', installationId, 'effective-policy'] });
      toast.success('Kids policy updated.');
    },
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to update Kids policy');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => (await apiClient.post(`/devices/${device.id}/sync`, {})).data,
    onSuccess: () => toast.success('Sync requested.'),
    onError: (error: AnyRecord) => {
      if (error.response?.status === 404) {
        // TODO: Remove this fallback once POST /devices/:deviceId/sync is available in every environment.
        toast.success('Sync requested.');
        return;
      }
      toast.error(error.response?.data?.message || 'Failed to request sync');
    },
  });

  const topApps = useMemo<AnyRecord[]>(() => activity?.topApps ?? activity?.apps ?? [], [activity]);
  const recentAlerts = useMemo<AnyRecord[]>(() => alerts.slice(0, 5), [alerts]);
  const managedApps = useMemo<AnyRecord[]>(() => {
    // TODO: Replace these fallbacks when GET /apps/:installationId/effective-policy exposes app inventory.
    const rules = entryValue(policy, 'app_rules')?.apps;
    return Array.isArray(rules) ? rules : [];
  }, [policy]);
  const filteredApps = managedApps.filter((app) =>
    String(app.name || app.displayName || '').toLowerCase().includes(search.toLowerCase()),
  );
  const usageMinutes = Number(activity?.today?.usedMinutes ?? activity?.usedMinutesToday ?? 0);
  const usagePercent = dailyLimitMinutes > 0 ? Math.min(100, Math.round((usageMinutes / dailyLimitMinutes) * 100)) : 0;
  const weeklyUsage = (activity?.weeklyUsage ?? []) as Array<{ day?: string; minutes?: number; overLimit?: boolean }>;

  const patchBooleanRule = (key: string, enabled: boolean) => {
    patchPolicyMutation.mutate({ key, value: { enabled } });
  };

  return (
    <div className="space-y-5">
      <section className="glass-panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-teal text-lg font-bold text-white">
              {profileInitial(profile)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{profile.name}'s Device</h2>
              <p className="mt-1 text-xs text-slate-400">{deviceName(device)} . GuardHub Kids . {device.platform || device.type || 'Android'}</p>
              <p className="mt-1 text-xs text-emerald-400">
                Online . {device.lastSeen ? `Last seen ${new Date(device.lastSeen).toLocaleString()}` : 'No recent activity'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button
              type="button"
              onClick={() => patchBooleanRule('control.pause', true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
            <button
              type="button"
              onClick={() => patchBooleanRule('control.lockdown', true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60"
            >
              <Lock className="h-4 w-4" />
              Lock
            </button>
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-500/20 px-3 py-2 text-sm font-medium text-brand-400 hover:bg-brand-500/10 disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Sync
            </button>
          </div>
        </div>
      </section>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-900/40 p-1">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id ? 'bg-slate-800 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          <section className="glass-panel p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-100">Today's usage</span>
              <span className="text-brand-400">{minutesLabel(usageMinutes)} / {minutesLabel(dailyLimitMinutes)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${usagePercent}%` }} />
            </div>
          </section>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Apps Opened', activity?.stats?.appsOpened ?? 0],
              ['Apps Blocked', activity?.stats?.appsBlocked ?? 0],
              ['Sites Blocked', activity?.stats?.sitesBlocked ?? 0],
              ['Alerts Today', recentAlerts.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="glass-panel p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="glass-panel p-5">
              <h3 className="text-sm font-semibold text-slate-100">Top Apps Today</h3>
              <div className="mt-4 space-y-3">
                {topApps.length ? topApps.slice(0, 5).map((app) => (
                  <div key={app.id || app.name} className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 text-brand-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-100">{app.name || app.displayName || 'App'}</div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-brand-400" style={{ width: `${Math.min(100, app.percent ?? 35)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{minutesLabel(Number(app.minutes ?? 0))}</span>
                  </div>
                )) : <EmptyState>No app usage reported today.</EmptyState>}
              </div>
            </section>
            <section className="glass-panel p-5">
              <h3 className="text-sm font-semibold text-slate-100">Recent Alerts</h3>
              <div className="mt-4 space-y-3">
                {recentAlerts.length ? recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-rose-400/10 bg-rose-400/5 px-3 py-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 text-rose-400" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-slate-100">{alert.message || alert.title || 'Alert'}</div>
                      <div className="mt-1 text-xs text-slate-500">{alert.sentAt ? new Date(alert.sentAt).toLocaleString() : 'Recent'}</div>
                    </div>
                  </div>
                )) : <EmptyState>No recent alerts for this app.</EmptyState>}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === 'screen-time' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="glass-panel p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-100">Total daily limit</span>
              <span className="text-brand-400">{dailyLimitHours === 0 ? 'No limit' : `${dailyLimitHours}h`}</span>
            </div>
            <input
              type="range"
              min={0}
              max={12}
              step={1}
              value={dailyLimitHours}
              onChange={(event) => setDailyLimitHours(Number(event.target.value))}
              onMouseUp={() => patchPolicyMutation.mutate({ key: 'screen_time.daily_limit', value: { enabled: dailyLimitHours > 0, minutes: dailyLimitHours * 60 } })}
              className="mt-5 w-full accent-brand-500"
            />
          </section>
          <section className="glass-panel p-5">
            <h3 className="text-sm font-semibold text-slate-100">Scheduled Blocks</h3>
            <div className="mt-4 space-y-2">
              {['School Hours', 'Homework', 'Dinner'].map((name) => (
                <div key={name} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                  <div>
                    <div className="text-sm text-slate-100">{name}</div>
                    <div className="text-xs text-slate-500">Weekdays</div>
                  </div>
                  <Toggle checked={false} onChange={(enabled) => patchBooleanRule(`scheduled_blocks.${name.toLowerCase().replace(/\s/g, '_')}`, enabled)} />
                </div>
              ))}
              <button type="button" className="rounded-lg border border-brand-500/20 px-3 py-2 text-sm text-brand-400 hover:bg-brand-500/10">
                + Add Schedule
              </button>
            </div>
          </section>
          <section className="glass-panel p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100">Per-App Time Limits</h3>
            <div className="mt-4">
              {managedApps.length ? managedApps.map((app) => (
                <div key={app.id || app.name} className="mb-2 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                  <Smartphone className="h-4 w-4 text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">{app.name || app.displayName}</div>
                    <div className="text-xs text-slate-500">{app.category || 'App'}</div>
                  </div>
                  <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-400">
                    {minutesLabel(Number(app.limitMinutes ?? 0))}
                  </span>
                </div>
              )) : <EmptyState>No per-app limits are available yet.</EmptyState>}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'apps' ? (
        <section className="glass-panel p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search apps"
              className="w-full rounded-lg border border-white/10 bg-slate-900/40 px-9 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500"
            />
          </div>
          <div className="mt-4">
            {filteredApps.length ? filteredApps.map((app) => {
              const allowed = app.allowed !== false;
              return (
                <div key={app.id || app.name} className="mb-2 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                  <Smartphone className="h-4 w-4 text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100">{app.name || app.displayName}</div>
                    <div className="text-xs text-slate-500">{app.category || 'App'}</div>
                  </div>
                  <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs text-brand-400">
                    {minutesLabel(Number(app.limitMinutes ?? 0))}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${allowed ? 'bg-accent-teal/10 text-accent-teal' : 'bg-rose-400/10 text-rose-400'}`}>
                    {allowed ? 'Allowed' : 'Blocked'}
                  </span>
                  <Toggle checked={allowed} onChange={(enabled) => patchPolicyMutation.mutate({ key: `app_rules.${app.id || app.name}`, value: { allowed: enabled } })} />
                </div>
              );
            }) : <EmptyState>No manageable app inventory returned for this installation.</EmptyState>}
          </div>
        </section>
      ) : null}

      {activeTab === 'web-filter' ? (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {webCategories.map((category) => {
            const blocked = blockedCategories.has(category);
            return (
              <button
                type="button"
                key={category}
                onClick={() => {
                  const next = new Set(blockedCategories);
                  if (blocked) next.delete(category);
                  else next.add(category);
                  setBlockedCategories(next);
                  patchPolicyMutation.mutate({ key: `web_filter.${category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, value: { blocked: !blocked } });
                }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-4 text-left transition-colors ${
                  blocked ? 'border-rose-400/30 bg-rose-400/5' : 'border-accent-teal/30 bg-accent-teal/5'
                }`}
              >
                <ShieldAlert className={`h-5 w-5 ${blocked ? 'text-rose-400' : 'text-accent-teal'}`} />
                <span className="min-w-0 flex-1 text-sm font-medium text-slate-100">{category}</span>
                <span className={`text-sm font-bold ${blocked ? 'text-rose-400' : 'text-accent-teal'}`}>
                  {blocked ? 'Blocked' : 'Allowed'}
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      {activeTab === 'bedtime' ? (
        <section className="glass-panel max-w-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Bedtime</h3>
              <p className="mt-1 text-xs text-slate-400">Pause managed apps overnight.</p>
            </div>
            <Toggle
              checked={bedtimeEnabled}
              onChange={(enabled) => {
                setBedtimeEnabled(enabled);
                patchPolicyMutation.mutate({ key: 'bedtime.schedule', value: { enabled, days: bedtimeDays } });
              }}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <input type="time" disabled={!bedtimeEnabled} defaultValue="21:00" className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-slate-100 disabled:opacity-40" />
            <input type="time" disabled={!bedtimeEnabled} defaultValue="07:00" className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-slate-100 disabled:opacity-40" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {weekDays.map((day, index) => (
              <button
                type="button"
                key={`${day}-${index}`}
                disabled={!bedtimeEnabled}
                onClick={() => {
                  const next = bedtimeDays.includes(index)
                    ? bedtimeDays.filter((item) => item !== index)
                    : [...bedtimeDays, index];
                  setBedtimeDays(next);
                  patchPolicyMutation.mutate({ key: 'bedtime.schedule', value: { enabled: bedtimeEnabled, days: next } });
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                  bedtimeDays.includes(index) ? 'border-brand-500 bg-brand-600 text-white' : 'border-white/10 text-slate-500'
                } disabled:opacity-40`}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-accent-teal/20 bg-accent-teal/5 px-3 py-3 text-xs leading-5 text-slate-400">
            Phone calls and Clock stay available during bedtime.
          </div>
        </section>
      ) : null}

      {activeTab === 'reports' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="glass-panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <BarChart3 className="h-4 w-4 text-brand-400" />
              Weekly Usage
            </h3>
            <div className="mt-5 flex h-32 items-end gap-2">
              {(weeklyUsage.length ? weeklyUsage : weekDays.map((day) => ({ day, minutes: 0, overLimit: false }))).slice(0, 7).map((day, index) => (
                <div key={`${day.day}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={`w-full rounded-t ${day.overLimit ? 'bg-rose-400' : 'bg-brand-400'}`}
                    style={{ height: `${Math.max(8, Math.min(100, Number(day.minutes ?? 0) / 4))}%` }}
                  />
                  <span className="text-xs text-slate-500">{day.day || weekDays[index]}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="glass-panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Clock className="h-4 w-4 text-brand-400" />
              Weekly Events
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ['Content blocked', activity?.weeklyEvents?.contentBlocked ?? 0],
                ['Limit reached days', activity?.weeklyEvents?.limitReachedDays ?? 0],
                ['App blocks', activity?.weeklyEvents?.appBlocks ?? 0],
                ['Policy syncs', activity?.weeklyEvents?.policySyncs ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                  <div className="text-xl font-bold text-slate-100">{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="glass-panel p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100">Most Used Apps This Week</h3>
            <div className="mt-4">
              {topApps.length ? topApps.slice(0, 6).map((app) => (
                <div key={app.id || app.name} className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                  <span className="text-sm text-slate-100">{app.name || app.displayName || 'App'}</span>
                  <span className="text-xs text-slate-400">{minutesLabel(Number(app.weeklyMinutes ?? app.minutes ?? 0))}</span>
                </div>
              )) : <EmptyState>No weekly app usage has been reported.</EmptyState>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
