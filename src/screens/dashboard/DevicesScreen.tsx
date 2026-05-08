import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  AppWindow,
  Archive,
  Check,
  ClipboardList,
  Copy,
  KeyRound,
  MoveRight,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import { logger } from '../../lib/logger';

type Family = { id: string; name: string } | null;
type AnyRecord = Record<string, any>;
type SubscriptionLimits = {
  plan: {
    name: string;
    displayName: string;
    status: string;
    limits: {
      activeProfiles: number | null;
      archivedProfiles: number | null;
      devicesPerProfile: number | null;
      appInstallationsPerProfile: number | null;
      allowedAppCatalogSlugs: string[] | null;
    };
  };
  usage: {
    activeProfiles: number;
    archivedProfiles: number;
    profiles: Array<{
      id: string;
      name: string;
      status: string;
      deviceCount: number;
      appInstallationCount: number;
    }>;
  };
  catalog: Array<{
    id: string;
    slug: string;
    displayName: string;
    endpointType: string;
    allowed: boolean;
  }>;
};

const emptyProfileForm = { name: '', age: '', grade: '', timezone: '' };
const emptyPolicyForm = { key: '', value: '{\n  \n}', strength: 'soft' };
const fallbackTimezones = [
  'UTC',
  'Asia/Colombo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
] as const;
const preferredTimezoneLabels: Record<string, string> = {
  UTC: 'Universal / UTC',
  'Asia/Colombo': 'Sri Lanka / Colombo',
  'Asia/Dubai': 'UAE / Dubai',
  'Asia/Kolkata': 'India / Kolkata',
  'Asia/Singapore': 'Singapore / Singapore',
  'Asia/Tokyo': 'Japan / Tokyo',
  'Australia/Sydney': 'Australia / Sydney',
  'Europe/London': 'United Kingdom / London',
  'Europe/Berlin': 'Germany / Berlin',
  'Europe/Paris': 'France / Paris',
  'America/New_York': 'USA / New York',
  'America/Chicago': 'USA / Chicago',
  'America/Denver': 'USA / Denver',
  'America/Los_Angeles': 'USA / Los Angeles',
  'America/Toronto': 'Canada / Toronto',
};
const timezoneFormatReferenceDate = new Date('2026-01-15T12:00:00Z');
function getTimezoneOffsetLabel(timezone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
      hour: '2-digit',
      minute: '2-digit',
    });
    const offsetPart = formatter.formatToParts(timezoneFormatReferenceDate).find((part) => part.type === 'timeZoneName')?.value;
    return offsetPart?.replace('GMT', 'GMT') ?? 'GMT';
  } catch {
    return 'GMT';
  }
}
function getTimezoneOffsetMinutes(timezone: string) {
  try {
    const localDate = new Date(timezoneFormatReferenceDate.toLocaleString('en-US', { timeZone: timezone }));
    return Math.round((localDate.getTime() - timezoneFormatReferenceDate.getTime()) / 60000);
  } catch {
    return 0;
  }
}
function getTimezoneShortName(timezone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    const shortName = formatter.formatToParts(timezoneFormatReferenceDate).find((part) => part.type === 'timeZoneName')?.value;
    return shortName && shortName !== timezone ? shortName : null;
  } catch {
    return null;
  }
}
function getTimezoneLocationLabel(timezone: string) {
  const preferred = preferredTimezoneLabels[timezone];
  if (preferred) return preferred;

  const segments = timezone.split('/');
  if (segments.length === 1) {
    return segments[0].replace(/_/g, ' ');
  }

  const region = segments[0].replace(/_/g, ' ');
  const location = segments.slice(1).join(' / ').replace(/_/g, ' ');
  return `${region} / ${location}`;
}
const timezoneOptions = (() => {
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  }).supportedValuesOf;

  const zones = supportedValuesOf ? supportedValuesOf('timeZone') : fallbackTimezones;
  return [...new Set([...fallbackTimezones, ...zones])]
    .map((value) => {
      const location = getTimezoneLocationLabel(value);
      const offset = getTimezoneOffsetLabel(value);
      const shortName = getTimezoneShortName(value);
      return {
        value,
        offsetMinutes: getTimezoneOffsetMinutes(value),
        label: `${location} ${offset}${shortName ? ` (${shortName})` : ''}`,
      };
    })
    .sort((left, right) => left.offsetMinutes - right.offsetMinutes || left.label.localeCompare(right.label));
})();

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

function tone(status: string) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400';
  if (status === 'paused') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400';
  if (status === 'archived') return 'bg-slate-200 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200';
  if (status === 'deleted') return 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400';
  return 'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-300';
}

function label(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function runtimeStatusTone(value: boolean | null) {
  if (value === true) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400';
  if (value === false) return 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400';
  return 'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-300';
}

function RuntimeStatusBadge({ label, value }: { label: string; value: boolean | null }) {
  const text = value === true ? 'Active' : value === false ? 'Inactive' : 'Unknown';

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${runtimeStatusTone(value)}`}>
      {label}: {text}
    </span>
  );
}

export function PolicyScopePanel({
  title,
  scopePath,
  deviceId,
  summary,
  editable = true,
  defaultOpen = false,
}: {
  title: string;
  scopePath: string;
  deviceId?: string;
  summary: string;
  editable?: boolean;
  defaultOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [form, setForm] = useState(emptyPolicyForm);
  const [quickRuleState, setQuickRuleState] = useState({
    explicitBlockingEnabled: true,
    explicitBlockingMode: 'blur',
    dailyMinutesEnabled: false,
    dailyMinutes: '120',
    lockdownEnabled: false,
    detectionAlertsEnabled: true,
  });
  const { data: directPolicy, isLoading: directLoading } = useQuery<AnyRecord>({
    queryKey: [scopePath, 'policy'],
    queryFn: async () => (await apiClient.get(`${scopePath}/policy`)).data,
    enabled: isOpen,
  });

  const { data: effectivePolicy, isLoading: effectiveLoading } = useQuery<AnyRecord>({
    queryKey: [scopePath, 'effective-policy'],
    queryFn: async () => (await apiClient.get(`${scopePath}/effective-policy`)).data,
    enabled: isOpen,
    refetchInterval: 15_000,
  });

  const { data: deviceRecord } = useQuery<AnyRecord>({
    queryKey: ['device', deviceId],
    queryFn: async () => (await apiClient.get(`/devices/${deviceId}`)).data,
    enabled: isOpen && !!deviceId,
    refetchInterval: 10_000,
    // REASON: poll every 10s so the badge reflects heartbeat updates
    // without requiring a manual page refresh.
  });

  const patchPolicyMutation = useMutation({
    mutationFn: async (payload: AnyRecord) => {
      const firstEntry = payload.entries?.[0];
      logger.info('PolicyScopePanel', 'patchPolicyMutation fired', {
        scope: scopePath,
        key: firstEntry?.key,
        operation: firstEntry?.operation ?? 'upsert',
      });
      return (await apiClient.patch(`${scopePath}/policy`, payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [scopePath, 'policy'] });
      queryClient.invalidateQueries({ queryKey: [scopePath, 'effective-policy'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setForm(emptyPolicyForm);
      toast.success(`${title} updated.`);
    },
    onError: (error: any) => {
      logger.warning('PolicyScopePanel', 'patchPolicyMutation error', {
        message: error.response?.data?.message ?? error.message,
      });
      toast.error(error.response?.data?.message || `Failed to update ${title.toLowerCase()}`);
    },
  });

  const sendCommandMutation = useMutation({
    mutationFn: async (command: string) => {
      if (!deviceId) {
        throw new Error('Device ID is required to send device command');
      }
      logger.info('PolicyScopePanel', 'sendCommandMutation fired', {
        deviceId,
        command,
      });
      return (await apiClient.post(`/devices/${deviceId}/command`, { command })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Device command sent.');
    },
    onError: (error: any) => {
      logger.warning('PolicyScopePanel', 'sendCommandMutation error', {
        message: error.response?.data?.message ?? error.message,
      });
      toast.error(error.response?.data?.message || 'Failed to send device command');
    },
  });

  const syncConfigMutation = useMutation({
    mutationFn: async () => {
      if (!deviceId) {
        throw new Error('Device ID is required to request sync');
      }
      return (await apiClient.post(`/devices/${deviceId}/command`, { command: 'SYNC_CONFIG' })).data;
    },
    onSuccess: () => {
      logger.info('DevicesScreen', 'SYNC_CONFIG dispatched', { deviceId });
      toast.success('Sync requested');
    },
    onError: (error: any) => {
      // REASON: SYNC_CONFIG is best-effort; do not block the UI on push failure.
      logger.warning('DevicesScreen', 'SYNC_CONFIG dispatch failed', {
        error: error?.response?.data?.message ?? error.message,
      });
    },
  });

  useEffect(() => {
    if (!directPolicy?.entries) {
      return;
    }

    const directByKey = new Map<string, AnyRecord>(
      directPolicy.entries.map((entry: AnyRecord) => [entry.key, entry]),
    );
    const explicitRule = directByKey.get('content.explicit_blocking') as AnyRecord | undefined;
    const dailyLimitRule = directByKey.get('screen_time.daily_limit') as AnyRecord | undefined;
    const lockdownRule = directByKey.get('control.lockdown') as AnyRecord | undefined;
    const detectionAlertRule = directByKey.get('notifications.detection_alerts') as AnyRecord | undefined;

    const nextQuickRuleState = {
      explicitBlockingEnabled: explicitRule?.value?.enabled ?? true,
      explicitBlockingMode: explicitRule?.value?.mode ?? 'blur',
      dailyMinutesEnabled: dailyLimitRule?.value?.enabled ?? false,
      dailyMinutes: String(dailyLimitRule?.value?.minutes ?? 120),
      lockdownEnabled: lockdownRule?.value?.enabled ?? false,
      detectionAlertsEnabled: detectionAlertRule?.value?.enabled ?? true,
    };
    logger.debug('PolicyScopePanel', 'quickRuleState populated from directPolicy', nextQuickRuleState);
    setQuickRuleState(nextQuickRuleState);
  }, [directPolicy]);

  const realProtectionActive: boolean | null = deviceRecord?.protectionActive ?? null;
  const realLockdownActive: boolean | null = deviceRecord?.lockdownActive ?? null;

  useEffect(() => {
    if (!effectivePolicy?.context) {
      return;
    }

    logger.debug('PolicyScopePanel', 'effectivePolicy context received', {
      protectionActive: realProtectionActive,
      lockdownActive: realLockdownActive,
    });
  }, [effectivePolicy?.context, realLockdownActive, realProtectionActive]);

  const saveEntry = () => {
    const key = form.key.trim();
    if (!key) {
      toast.error('Policy key is required');
      return;
    }

    try {
      const parsed = JSON.parse(form.value);
      patchPolicyMutation.mutate({
        entries: [
          {
            key,
            value: parsed,
            strength: form.strength,
            operation: 'upsert',
          },
        ],
      });
      if (key === 'control.lock_settings' && deviceId) {
        syncConfigMutation.mutate();
      }
    } catch {
      toast.error('Policy value must be valid JSON');
    }
  };

  const removeEntry = (key: string) => {
    patchPolicyMutation.mutate({
      entries: [
        {
          key,
          operation: 'remove',
        },
      ],
    });
    if (key === 'control.lock_settings' && deviceId) {
      syncConfigMutation.mutate();
    }
  };

  const saveQuickRule = (key: string, value: AnyRecord, strength: string) => {
    patchPolicyMutation.mutate({
      entries: [
        {
          key,
          value,
          strength,
          operation: 'upsert',
        },
      ],
    });
  };

  const saveLockdownRule = (strength: string) => {
    logger.info('PolicyScopePanel', 'saveLockdownRule called', {
      lockdownEnabled: quickRuleState.lockdownEnabled,
      strength,
    });
    saveQuickRule('control.lockdown', { enabled: quickRuleState.lockdownEnabled }, strength);
    if (deviceId) {
      sendCommandMutation.mutate(quickRuleState.lockdownEnabled ? 'LOCKDOWN' : 'UNLOCK');
    }
  };
  const lockdownButtonsDisabled = patchPolicyMutation.isPending || sendCommandMutation.isPending;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="w-full px-4 py-4 flex items-center justify-between text-left bg-slate-50 dark:bg-dark-900/60"
      >
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{summary}</div>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-500">
          {isOpen ? 'Hide' : 'Show'}
        </div>
      </button>

      {isOpen ? (
        <div className="p-4 space-y-5">
          {editable ? (
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quick Rules</div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-white dark:bg-dark-900/40">
                  <div className="font-medium text-slate-900 dark:text-slate-100">Explicit Blocking</div>
                  <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Enabled</span>
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      realProtectionActive === true
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : realProtectionActive === false
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-dark-700 dark:text-slate-400'
                    }`}>
                      {realProtectionActive === null ? 'Unknown' : realProtectionActive ? 'On device' : 'Off device'}
                    </span>
                    <input
                      type="checkbox"
                      checked={quickRuleState.explicitBlockingEnabled}
                      onChange={(event) =>
                        setQuickRuleState((current) => ({ ...current, explicitBlockingEnabled: event.target.checked }))
                      }
                    />
                  </label>
                  <select
                    value={quickRuleState.explicitBlockingMode}
                    onChange={(event) =>
                      setQuickRuleState((current) => ({ ...current, explicitBlockingMode: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                  >
                    <option value="blur">Blur</option>
                    <option value="block">Block</option>
                    <option value="warn">Warn</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        saveQuickRule(
                          'content.explicit_blocking',
                          {
                            enabled: quickRuleState.explicitBlockingEnabled,
                            mode: quickRuleState.explicitBlockingMode,
                          },
                          'hard',
                        );
                        if (deviceId) syncConfigMutation.mutate();
                      }}
                      className="btn-primary"
                      disabled={patchPolicyMutation.isPending || syncConfigMutation.isPending}
                    >
                      Save Hard Rule
                    </button>
                    <button
                      onClick={() => {
                        saveQuickRule(
                          'content.explicit_blocking',
                          {
                            enabled: quickRuleState.explicitBlockingEnabled,
                            mode: quickRuleState.explicitBlockingMode,
                          },
                          'soft',
                        );
                        if (deviceId) syncConfigMutation.mutate();
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
                      disabled={patchPolicyMutation.isPending || syncConfigMutation.isPending}
                    >
                      Save Soft Rule
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-white dark:bg-dark-900/40">
                  <div className="font-medium text-slate-900 dark:text-slate-100">Daily Screen Time</div>
                  <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={quickRuleState.dailyMinutesEnabled}
                      onChange={(event) =>
                        setQuickRuleState((current) => ({ ...current, dailyMinutesEnabled: event.target.checked }))
                      }
                    />
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quickRuleState.dailyMinutes}
                    onChange={(event) =>
                      setQuickRuleState((current) => ({ ...current, dailyMinutes: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() =>
                      saveQuickRule(
                        'screen_time.daily_limit',
                        {
                          enabled: quickRuleState.dailyMinutesEnabled,
                          minutes: Number(quickRuleState.dailyMinutes || 0),
                        },
                        'soft',
                      )
                    }
                    className="btn-primary"
                    disabled={patchPolicyMutation.isPending}
                  >
                    Save Daily Limit
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-white dark:bg-dark-900/40">
                  <div className="font-medium text-slate-900 dark:text-slate-100">Lockdown</div>
                  <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Enabled</span>
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      realLockdownActive === true
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : realLockdownActive === false
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-dark-700 dark:text-slate-400'
                    }`}>
                      {realLockdownActive === null ? 'Unknown' : realLockdownActive ? 'Locked' : 'Unlocked'}
                    </span>
                    <input
                      type="checkbox"
                      checked={quickRuleState.lockdownEnabled}
                      onChange={(event) =>
                        setQuickRuleState((current) => ({ ...current, lockdownEnabled: event.target.checked }))
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveLockdownRule('hard')}
                      className="btn-primary"
                      disabled={lockdownButtonsDisabled}
                    >
                      Save Hard Lockdown
                    </button>
                    <button
                      onClick={() => saveLockdownRule('soft')}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
                      disabled={lockdownButtonsDisabled}
                    >
                      Save Soft Lockdown
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-white dark:bg-dark-900/40">
                  <div className="font-medium text-slate-900 dark:text-slate-100">Detection Alerts</div>
                  <label className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                    <span>Enabled</span>
                    <input
                      type="checkbox"
                      checked={quickRuleState.detectionAlertsEnabled}
                      onChange={(event) =>
                        setQuickRuleState((current) => ({ ...current, detectionAlertsEnabled: event.target.checked }))
                      }
                    />
                  </label>
                  <button
                    onClick={() =>
                      saveQuickRule(
                        'notifications.detection_alerts',
                        { enabled: quickRuleState.detectionAlertsEnabled },
                        'soft',
                      )
                    }
                    className="btn-primary"
                    disabled={patchPolicyMutation.isPending}
                  >
                    Save Alert Rule
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-white/10 pt-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Or Update Rule</div>
              <input
                type="text"
                value={form.key}
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                placeholder="policy.key.path"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
              />
              <select
                value={form.strength}
                onChange={(event) => setForm((current) => ({ ...current, strength: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="soft">Soft rule</option>
                <option value="hard">Hard rule</option>
              </select>
              <textarea
                value={form.value}
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                rows={6}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500 font-mono text-sm"
              />
              <button
                onClick={saveEntry}
                className="btn-primary flex items-center justify-center gap-2"
                disabled={patchPolicyMutation.isPending}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{patchPolicyMutation.isPending ? 'Saving...' : 'Save Rule'}</span>
              </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Direct Rules</div>
              {directLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading direct rules...</div>
              ) : directPolicy?.entries?.length ? (
                directPolicy.entries.map((entry: AnyRecord) => (
                  <div key={entry.id || entry.key} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{entry.key}</div>
                        <div className={`mt-2 inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ${entry.strength === 'hard' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-dark-700 dark:text-slate-300'}`}>
                          {String(entry.strength).toUpperCase()}
                        </div>
                      </div>
                      {editable ? (
                        <button
                          onClick={() => removeEntry(entry.key)}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                          disabled={patchPolicyMutation.isPending}
                          title="Remove rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 dark:bg-dark-900/70 p-3 text-xs text-slate-700 dark:text-slate-300">
                      {JSON.stringify(entry.value, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400">
                  No direct rules at this scope.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Effective Rules</div>
              {effectiveLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading effective rules...</div>
              ) : effectivePolicy?.entries?.length ? (
                effectivePolicy.entries.map((entry: AnyRecord) => (
                  <div key={entry.key} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{entry.key}</div>
                      <span className="inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        {entry.originScope ? `${String(entry.originScope).toUpperCase()} WINNER` : 'NO SOURCE'}
                      </span>
                      <span className={`inline-flex text-[11px] font-semibold px-2.5 py-1 rounded-full ${entry.effectiveStrength === 'hard' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-dark-700 dark:text-slate-300'}`}>
                        {String(entry.effectiveStrength).toUpperCase()}
                      </span>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 dark:bg-dark-900/70 p-3 text-xs text-slate-700 dark:text-slate-300">
                      {JSON.stringify(entry.effectiveValue, null, 2)}
                    </pre>
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                      <div>
                        Sources:
                        {' '}
                        {entry.sources?.profile ? 'profile ' : ''}
                        {entry.sources?.device ? 'device ' : ''}
                        {entry.sources?.app ? 'app ' : ''}
                      </div>
                      {entry.blockedByHardRule?.length ? (
                        <div className="text-rose-600 dark:text-rose-400">
                          Blocked lower override{entry.blockedByHardRule.length === 1 ? '' : 's'} because an inherited hard rule won.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400">
                  No effective rules yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScopeInsightsPanel({
  title,
  scopePath,
  summary,
  defaultTab = 'activity',
}: {
  title: string;
  scopePath: string;
  summary: string;
  defaultTab?: 'activity' | 'alerts' | 'audit';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'activity' | 'alerts' | 'audit'>(defaultTab);

  const { data, isLoading } = useQuery<AnyRecord[]>({
    queryKey: [scopePath, tab],
    queryFn: async () => (await apiClient.get(`${scopePath}/${tab}`)).data,
    enabled: isOpen,
  });

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen((current) => !current)}
        className="w-full px-4 py-4 flex items-center justify-between text-left bg-slate-50 dark:bg-dark-900/60"
      >
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{summary}</div>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-500">
          {isOpen ? 'Hide' : 'Show'}
        </div>
      </button>

      {isOpen ? (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'activity', label: 'Activity', icon: Activity },
              { id: 'alerts', label: 'Alerts', icon: BellRing },
              { id: 'audit', label: 'Audit', icon: ClipboardList },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id as 'activity' | 'alerts' | 'audit')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium ${
                  tab === item.id
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                    : 'bg-slate-100 dark:bg-dark-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading {tab}...</div>
          ) : !data?.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 dark:text-slate-400">
              No {tab} entries at this scope yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                  {tab === 'activity' ? (
                    <>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {entry.appName || entry.appPackage || 'Detection event'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Device: {entry.device?.name || 'Unknown'} • Profile: {entry.device?.profile?.name || 'Unknown'}
                      </div>
                      {entry.scopeNote ? (
                        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">{entry.scopeNote}</div>
                      ) : null}
                    </>
                  ) : null}

                  {tab === 'alerts' ? (
                    <>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{entry.message}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {entry.alertType}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(entry.sentAt).toLocaleString()}
                      </div>
                      {entry.scopeNote ? (
                        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">{entry.scopeNote}</div>
                      ) : null}
                    </>
                  ) : null}

                  {tab === 'audit' ? (
                    <>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{entry.action}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {entry.entryType} • {entry.entityType}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                      {entry.reason ? (
                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{entry.reason}</div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function DevicesScreen() {
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState('My Family');
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedAppCatalogId, setSelectedAppCatalogId] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deviceTransferTargets, setDeviceTransferTargets] = useState<Record<string, string>>({});
  const [appTransferTargets, setAppTransferTargets] = useState<Record<string, string>>({});

  const { data: family, isLoading: familyLoading } = useQuery<Family>({
    queryKey: ['family'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/family/me');
        return res.data;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    retry: false,
  });

  const { data: profiles = [], isLoading: profilesLoading } = useQuery<AnyRecord[]>({
    queryKey: ['profiles'],
    queryFn: async () => (await apiClient.get('/profiles')).data,
    enabled: !!family,
    refetchInterval: 15_000,
    // REASON: refresh every 15s so the device status badges
    // (Protection: Active/Inactive, Lockdown: Active/Inactive)
    // reflect the latest heartbeat without user interaction.
  });

  const { data: archivedProfiles = [], isLoading: archivedProfilesLoading } = useQuery<AnyRecord[]>({
    queryKey: ['profiles', 'archived'],
    queryFn: async () => (await apiClient.get('/profiles/archived')).data,
    enabled: !!family,
  });

  const { data: appCatalog = [] } = useQuery<AnyRecord[]>({
    queryKey: ['appCatalog'],
    queryFn: async () => (await apiClient.get('/app-catalog')).data,
    enabled: !!family,
  });

  const { data: subscriptionLimits } = useQuery<SubscriptionLimits>({
    queryKey: ['subscription', 'limits'],
    queryFn: async () => (await apiClient.get('/subscription/limits')).data,
    enabled: !!family,
  });

  const { data: selectedProfile, isLoading: selectedProfileLoading } = useQuery<AnyRecord>({
    queryKey: ['profile', selectedProfileId],
    queryFn: async () => (await apiClient.get(`/profiles/${selectedProfileId}`)).data,
    enabled: !!selectedProfileId,
    refetchInterval: 15_000,
  });

  const profileDetailQueries = useQueries({
    queries: profiles.map((profile) => ({
      queryKey: ['profile', profile.id, 'transfer-detail'],
      queryFn: async () => (await apiClient.get(`/profiles/${profile.id}`)).data as Promise<AnyRecord>,
      enabled: !!family,
    })),
  });

  useEffect(() => {
    if (!family) {
      setSelectedProfileId(null);
      return;
    }
    const available = [...profiles, ...archivedProfiles];
    if (available.length === 0) {
      setSelectedProfileId(null);
      return;
    }
    if (!selectedProfileId || !available.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(available[0].id);
    }
  }, [archivedProfiles, family, profiles, selectedProfileId]);

  useEffect(() => {
    const allowedCatalogIds = new Set(
      (subscriptionLimits?.catalog ?? [])
        .filter((entry) => entry.allowed)
        .map((entry) => entry.id),
    );
    const allowedEntry = appCatalog.find((entry) => allowedCatalogIds.has(entry.id));
    if (!selectedAppCatalogId && allowedEntry) {
      setSelectedAppCatalogId(allowedEntry.id);
      return;
    }

    if (
      selectedAppCatalogId &&
      !allowedCatalogIds.has(selectedAppCatalogId) &&
      allowedEntry
    ) {
      setSelectedAppCatalogId(allowedEntry.id);
    }
  }, [appCatalog, selectedAppCatalogId, subscriptionLimits]);

  const totalDevices = useMemo(
    () => profiles.reduce((total, profile) => total + profile.deviceCount, 0),
    [profiles],
  );
  const totalApps = useMemo(
    () => profiles.reduce((total, profile) => total + profile.appInstallationCount, 0),
    [profiles],
  );
  const profileUsageMap = useMemo(
    () => new Map((subscriptionLimits?.usage.profiles ?? []).map((profile) => [profile.id, profile])),
    [subscriptionLimits],
  );
  const selectedProfileUsage = selectedProfileId ? profileUsageMap.get(selectedProfileId) : undefined;
  const activeProfileLimitReached = useMemo(() => {
    const limit = subscriptionLimits?.plan.limits.activeProfiles;
    if (limit == null) return false;
    return (subscriptionLimits?.usage.activeProfiles ?? 0) >= limit;
  }, [subscriptionLimits]);
  const archivedProfileLimitReached = useMemo(() => {
    const limit = subscriptionLimits?.plan.limits.archivedProfiles;
    if (limit == null) return false;
    return (subscriptionLimits?.usage.archivedProfiles ?? 0) >= limit;
  }, [subscriptionLimits]);
  const appCatalogAvailability = useMemo(
    () => new Map((subscriptionLimits?.catalog ?? []).map((entry) => [entry.id, entry])),
    [subscriptionLimits],
  );
  const selectedCatalogEntry = selectedAppCatalogId ? appCatalogAvailability.get(selectedAppCatalogId) : undefined;
  const selectedCatalogBlocked = selectedCatalogEntry ? !selectedCatalogEntry.allowed : false;
  const selectedProfileAppLimitReached = useMemo(() => {
    const limit = subscriptionLimits?.plan.limits.appInstallationsPerProfile;
    if (limit == null || !selectedProfileUsage) return false;
    return selectedProfileUsage.appInstallationCount >= limit;
  }, [selectedProfileUsage, subscriptionLimits]);
  const transferProfileDetails = useMemo(
    () => profileDetailQueries.map((query) => query.data).filter(Boolean) as AnyRecord[],
    [profileDetailQueries],
  );
  const allTransferTargetDevices = useMemo(
    () =>
      transferProfileDetails.flatMap((profile) =>
        (profile.devices ?? [])
          .filter((device: AnyRecord) => device.status === 'active')
          .map((device: AnyRecord) => ({
            id: device.id,
            name: device.name,
            profileId: profile.id,
            profileName: profile.name,
          })),
      ),
    [transferProfileDetails],
  );

  const createFamilyMutation = useMutation({
    mutationFn: async (name: string) => apiClient.post('/family/create', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      toast.success('Family created.');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to create family'),
  });

  const createProfileMutation = useMutation({
    mutationFn: async (payload: AnyRecord) => (await apiClient.post('/profiles', payload)).data,
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', 'archived'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      setSelectedProfileId(profile.id);
      setProfileForm(emptyProfileForm);
      toast.success('Child profile created.');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to create profile'),
  });

  const createPairingCodeMutation = useMutation({
    mutationFn: async (payload: { profileId: string; appCatalogId: string }) =>
      (await apiClient.post(`/profiles/${payload.profileId}/pairing-codes`, { appCatalogId: payload.appCatalogId })).data,
    onSuccess: async (pairingCode) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', selectedProfileId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      try {
        await navigator.clipboard.writeText(pairingCode.code);
        setCopiedCode(pairingCode.code);
        toast.success(`Pairing code copied for ${pairingCode.appCatalog.displayName}.`);
      } catch {
        toast.success(`Pairing code created for ${pairingCode.appCatalog.displayName}.`);
      }
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to generate pairing code'),
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (payload: { profileId: string; action: 'pause' | 'resume' | 'archive' | 'restore' | 'delete' }) => {
      if (payload.action === 'delete') {
        return (await apiClient.delete(`/profiles/${payload.profileId}`, { data: {} })).data;
      }
      return (await apiClient.post(`/profiles/${payload.profileId}/${payload.action}`, {})).data;
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', 'archived'] });
      queryClient.invalidateQueries({ queryKey: ['profile', payload.profileId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      toast.success(`Profile ${payload.action}d.`);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Profile action failed'),
  });

  const transferDeviceMutation = useMutation({
    mutationFn: async (payload: { deviceId: string; toProfileId: string }) =>
      (await apiClient.post(`/devices/${payload.deviceId}/transfer`, { toProfileId: payload.toProfileId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      toast.success('Device transferred.');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to transfer device'),
  });

  const transferAppMutation = useMutation({
    mutationFn: async (payload: { installationId: string; toDeviceId: string }) =>
      (await apiClient.post(`/apps/${payload.installationId}/transfer`, { toDeviceId: payload.toDeviceId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      toast.success('App installation transferred.');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to transfer app installation'),
  });

  const handleCreateProfile = () => {
    if (!profileForm.name.trim()) {
      toast.error('Child name is required');
      return;
    }
    createProfileMutation.mutate({
      name: profileForm.name.trim(),
      age: profileForm.age ? Number(profileForm.age) : undefined,
      grade: profileForm.grade.trim() || undefined,
      timezone: profileForm.timezone.trim() || undefined,
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 2000);
      toast.success('Pairing code copied.');
    } catch {
      toast.error('Failed to copy pairing code');
    }
  };

  if (familyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Profiles</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create the family first, then add child profiles and generate one-time pairing codes.
          </p>
        </header>

        <div className="glass-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Your Family Space</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mb-8">
            Child profiles, devices, and app installations all live under the family.
          </p>
          <div className="w-full max-w-md space-y-4">
            <input
              type="text"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Family name"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
            />
            <button
              onClick={() => createFamilyMutation.mutate(familyName.trim())}
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={createFamilyMutation.isPending || !familyName.trim()}
            >
              <Plus className="w-5 h-5" />
              <span>{createFamilyMutation.isPending ? 'Creating Family...' : 'Create Family'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Profiles</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage child profiles, pairing codes, linked devices, and app installations.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          <div className="glass-panel p-6 border-brand-500/20 bg-brand-500/5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-500" />
              {family.name}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Profiles</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {subscriptionLimits ? `${subscriptionLimits.usage.activeProfiles}/${subscriptionLimits.plan.limits.activeProfiles ?? '∞'}` : profiles.length}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Archived Profiles</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {subscriptionLimits ? `${subscriptionLimits.usage.archivedProfiles}/${subscriptionLimits.plan.limits.archivedProfiles ?? '∞'}` : archivedProfiles.length}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Devices</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalDevices}</div>
                {subscriptionLimits?.plan.limits.devicesPerProfile != null ? (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {subscriptionLimits.plan.limits.devicesPerProfile} per profile
                  </div>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">App Installs</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totalApps}</div>
                {subscriptionLimits?.plan.limits.appInstallationsPerProfile != null ? (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {subscriptionLimits.plan.limits.appInstallationsPerProfile} per profile
                  </div>
                ) : null}
              </div>
            </div>
            {subscriptionLimits ? (
              <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{subscriptionLimits.plan.displayName}</span>
                {' '}plan. Allowed app types:{' '}
                <span className="font-medium">
                  {subscriptionLimits.catalog.filter((entry) => entry.allowed).map((entry) => entry.displayName).join(', ') || 'None'}
                </span>
              </div>
            ) : null}
          </div>

          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Child Profile</h3>
              <ShieldCheck className="w-5 h-5 text-accent-teal" />
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Child name"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={profileForm.age}
                  onChange={(event) => setProfileForm((current) => ({ ...current, age: event.target.value }))}
                  placeholder="Age"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                />
                <input
                  type="text"
                  value={profileForm.grade}
                  onChange={(event) => setProfileForm((current) => ({ ...current, grade: event.target.value }))}
                  placeholder="Grade"
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                />
              </div>
              <select
                value={profileForm.timezone}
                onChange={(event) => setProfileForm((current) => ({ ...current, timezone: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
              >
                <option value="">Select timezone</option>
                {timezoneOptions.map((timezone) => (
                  <option key={timezone.value} value={timezone.value}>
                    {timezone.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateProfile}
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={createProfileMutation.isPending || activeProfileLimitReached}
              >
                <Plus className="w-4 h-4" />
                <span>{createProfileMutation.isPending ? 'Creating...' : 'Add Profile'}</span>
              </button>
              {activeProfileLimitReached ? (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Active profile limit reached for the current plan. Archive or upgrade before adding another profile.
                </div>
              ) : null}
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Supported App Types</h3>
            <div className="space-y-3">
              {appCatalog.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">{entry.displayName}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{entry.endpointType.replace('_', ' ')}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      appCatalogAvailability.get(entry.id)?.allowed
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400'
                    }`}>
                      {appCatalogAvailability.get(entry.id)?.allowed ? 'Allowed' : 'Blocked'}
                    </span>
                    <AppWindow className="w-4 h-4 text-brand-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Active Profiles</h2>
              {profilesLoading ? <span className="text-sm text-slate-500 dark:text-slate-400">Loading...</span> : null}
            </div>
            {profiles.length === 0 ? (
              <div className="glass-panel p-10 text-center text-slate-500 dark:text-slate-400 border-dashed border-slate-300 dark:border-white/10">
                No active child profiles yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`glass-panel p-5 text-left border transition-all ${
                      selectedProfileId === profile.id ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-200 dark:border-white/10 hover:border-brand-500/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{profile.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {[profile.age ? `${profile.age}y` : null, profile.grade, profile.timezone].filter(Boolean).join(' • ') || 'No extra child metadata yet'}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone(profile.status)}`}>{label(profile.status)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
                      <div><div className="text-slate-500 dark:text-slate-400">Devices</div><div className="font-semibold text-slate-900 dark:text-slate-100">{profile.deviceCount}</div></div>
                      <div><div className="text-slate-500 dark:text-slate-400">Apps</div><div className="font-semibold text-slate-900 dark:text-slate-100">{profile.appInstallationCount}</div></div>
                      <div><div className="text-slate-500 dark:text-slate-400">Codes</div><div className="font-semibold text-slate-900 dark:text-slate-100">{profile.activePairingCodeCount}</div></div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Archived Profiles</h2>
              {archivedProfilesLoading ? <span className="text-sm text-slate-500 dark:text-slate-400">Loading...</span> : null}
            </div>
            {archivedProfiles.length === 0 ? (
              <div className="glass-panel p-6 text-sm text-slate-500 dark:text-slate-400">No archived profiles.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {archivedProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`glass-panel p-5 text-left border transition-all ${
                      selectedProfileId === profile.id ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-200 dark:border-white/10 hover:border-brand-500/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{profile.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          Archived {profile.archivedAt ? new Date(profile.archivedAt).toLocaleDateString() : 'recently'}
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone(profile.status)}`}>{label(profile.status)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel p-6">
            {!selectedProfileId ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                Select a profile to inspect pairing codes, devices, and app installations.
              </div>
            ) : selectedProfileLoading || !selectedProfile ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedProfile.name}</h2>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone(selectedProfile.status)}`}>
                        {label(selectedProfile.status)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      {[selectedProfile.age ? `${selectedProfile.age} years` : null, selectedProfile.grade, selectedProfile.timezone]
                        .filter(Boolean)
                        .join(' • ') || 'No extra child metadata yet'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.status === 'active' ? (
                      <button
                        onClick={() => lifecycleMutation.mutate({ profileId: selectedProfile.id, action: 'pause' })}
                        className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-2"
                        disabled={lifecycleMutation.isPending}
                      >
                        <PauseCircle className="w-4 h-4" />
                        Pause
                      </button>
                    ) : null}
                    {selectedProfile.status === 'paused' ? (
                      <button
                        onClick={() => lifecycleMutation.mutate({ profileId: selectedProfile.id, action: 'resume' })}
                        className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2"
                        disabled={lifecycleMutation.isPending}
                      >
                        <PlayCircle className="w-4 h-4" />
                        Resume
                      </button>
                    ) : null}
                    {selectedProfile.deviceCount === 0 && selectedProfile.status !== 'deleted' ? (
                      <button
                        onClick={() =>
                          lifecycleMutation.mutate({
                            profileId: selectedProfile.id,
                            action: selectedProfile.status === 'archived' ? 'restore' : 'archive',
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2"
                        disabled={
                          lifecycleMutation.isPending ||
                          (selectedProfile.status !== 'archived' && archivedProfileLimitReached)
                        }
                      >
                        <Archive className="w-4 h-4" />
                        {selectedProfile.status === 'archived' ? 'Restore' : 'Archive'}
                      </button>
                    ) : null}
                    {selectedProfile.deviceCount === 0 && selectedProfile.status !== 'deleted' ? (
                      <button
                        onClick={() => lifecycleMutation.mutate({ profileId: selectedProfile.id, action: 'delete' })}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2"
                        disabled={lifecycleMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Devices</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedProfile.deviceCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">App Installs</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedProfile.appInstallationCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Policies</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedProfile.policyCount}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Audit Events</div>
                    <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedProfile.auditLogCount}</div>
                  </div>
                </div>
                {selectedProfileUsage && subscriptionLimits ? (
                  <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">Quota For {selectedProfile.name}</div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        Devices: <span className="font-medium">{selectedProfileUsage.deviceCount}/{subscriptionLimits.plan.limits.devicesPerProfile ?? '∞'}</span>
                      </div>
                      <div>
                        App installs: <span className="font-medium">{selectedProfileUsage.appInstallationCount}/{subscriptionLimits.plan.limits.appInstallationsPerProfile ?? '∞'}</span>
                      </div>
                    </div>
                    {archivedProfileLimitReached && selectedProfile.deviceCount === 0 && (selectedProfile.status === 'active' || selectedProfile.status === 'paused') ? (
                      <div className="mt-3 text-amber-600 dark:text-amber-400">
                        Archived profile cap reached. Restore or delete an archived profile before archiving another one.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <PolicyScopePanel
                  title="Profile Policy"
                  scopePath={`/profiles/${selectedProfile.id}`}
                  summary="Base rules for this child profile. Lower scopes can only override soft rules."
                  editable={selectedProfile.status !== 'archived' && selectedProfile.status !== 'deleted'}
                  defaultOpen
                />

                <ScopeInsightsPanel
                  title="Profile Activity, Alerts, And Audit"
                  scopePath={`/profiles/${selectedProfile.id}`}
                  summary="Inspect this profile's scoped activity, alerts, and audit trail."
                  defaultTab="activity"
                />

                {selectedProfile.status !== 'archived' && selectedProfile.status !== 'deleted' ? (
                  <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Generate Pairing Code</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Select the app type, generate a one-time code, and enter it on the child-side app.
                      </p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <select
                        value={selectedAppCatalogId}
                        onChange={(event) => setSelectedAppCatalogId(event.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                      >
                        {appCatalog.map((entry) => (
                          <option
                            key={entry.id}
                            value={entry.id}
                            disabled={appCatalogAvailability.get(entry.id)?.allowed === false}
                          >
                            {entry.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          selectedProfileId &&
                          createPairingCodeMutation.mutate({
                            profileId: selectedProfileId,
                            appCatalogId: selectedAppCatalogId,
                          })
                        }
                        disabled={
                          createPairingCodeMutation.isPending ||
                          !selectedAppCatalogId ||
                          selectedCatalogBlocked ||
                          selectedProfileAppLimitReached
                        }
                        className="btn-primary flex items-center justify-center gap-2"
                      >
                        <KeyRound className="w-4 h-4" />
                        <span>{createPairingCodeMutation.isPending ? 'Generating...' : 'Generate Code'}</span>
                      </button>
                    </div>
                    {selectedCatalogBlocked ? (
                      <div className="text-xs text-rose-600 dark:text-rose-400">
                        This app type is not allowed on the current subscription plan.
                      </div>
                    ) : null}
                    {selectedProfileAppLimitReached ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        This profile has reached its app-installation limit for the current plan.
                      </div>
                    ) : null}
                    {!selectedCatalogBlocked && !selectedProfileAppLimitReached && subscriptionLimits?.plan.limits.devicesPerProfile != null ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Final pairing may still be blocked if this app needs a new device and the profile is already at its device cap.
                      </div>
                    ) : null}

                    {selectedProfile.activePairingCodes?.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                        No active pairing codes for this profile.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProfile.activePairingCodes?.map((pairingCode: AnyRecord) => (
                          <div
                            key={pairingCode.id}
                            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-900 px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                          >
                            <div>
                              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {pairingCode.appCatalog.displayName}
                              </div>
                              <div className="mt-1 font-mono text-2xl tracking-widest text-brand-500 dark:text-brand-400 uppercase">
                                {pairingCode.code}
                              </div>
                              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                Expires {new Date(pairingCode.expiresAt).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => copyCode(pairingCode.code)}
                              className="self-start md:self-center px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 hover:border-brand-500/40 text-slate-700 dark:text-slate-200 flex items-center gap-2"
                            >
                              {copiedCode === pairingCode.code ? (
                                <Check className="w-4 h-4 text-accent-teal" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                              <span>{copiedCode === pairingCode.code ? 'Copied' : 'Copy Code'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Linked Devices</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Each device can contain multiple GuardHub app installations for the same child profile.
                    </p>
                  </div>

                  {selectedProfile.devices?.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center text-slate-500 dark:text-slate-400">
                      No devices linked to this profile yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedProfile.devices?.map((device: AnyRecord) => (
                        <div key={device.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-5">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-dark-700 flex items-center justify-center">
                                <Smartphone className="w-5 h-5 text-brand-500" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{device.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {device.type} • Registered {new Date(device.registeredAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {device.lastSeen ? `Last seen ${new Date(device.lastSeen).toLocaleString()}` : 'No activity reported yet'}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <RuntimeStatusBadge value={device.protectionActive ?? null} label="Protection" />
                            <RuntimeStatusBadge value={device.lockdownActive ?? null} label="Lockdown" />
                          </div>
                          <div className="mt-4">
                            <PolicyScopePanel
                              title={`${device.name} Device Policy`}
                              scopePath={`/devices/${device.id}`}
                              deviceId={device.id}
                              summary="Device-specific overrides layered on top of the child profile."
                              editable={selectedProfile.status !== 'archived' && selectedProfile.status !== 'deleted'}
                            />
                          </div>
                          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <ScopeInsightsPanel
                              title={`${device.name} Device Activity`}
                              scopePath={`/devices/${device.id}`}
                              summary="Scoped device activity, alerts, and audit data."
                              defaultTab="activity"
                            />
                            {profiles.length > 1 ? (
                              <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
                                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                  <MoveRight className="w-4 h-4 text-brand-500" />
                                  Transfer Device
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  Move this physical device and all attached app installations to another child profile.
                                </p>
                                <select
                                  value={deviceTransferTargets[device.id] || ''}
                                  onChange={(event) =>
                                    setDeviceTransferTargets((current) => ({
                                      ...current,
                                      [device.id]: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                                >
                                  <option value="">Select target profile</option>
                                  {profiles
                                    .filter((profile) => profile.id !== selectedProfile.id)
                                    .map((profile) => (
                                      <option key={profile.id} value={profile.id}>
                                        {profile.name}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  onClick={() =>
                                    transferDeviceMutation.mutate({
                                      deviceId: device.id,
                                      toProfileId: deviceTransferTargets[device.id],
                                    })
                                  }
                                  className="btn-primary"
                                  disabled={!deviceTransferTargets[device.id] || transferDeviceMutation.isPending}
                                >
                                  {transferDeviceMutation.isPending ? 'Transferring...' : 'Transfer Device'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {device.appInstallations?.map((installation: AnyRecord) => (
                              <div key={installation.id} className="rounded-xl bg-slate-50 dark:bg-dark-900/70 border border-slate-200 dark:border-white/5 px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      {installation.displayName || installation.appCatalog.displayName}
                                    </div>
                                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-1">
                                      {installation.appCatalog.displayName}
                                    </div>
                                  </div>
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tone(installation.status)}`}>
                                    {label(installation.status)}
                                  </span>
                                </div>
                                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                  Installed {new Date(installation.installedAt).toLocaleString()}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {installation.lastSeen ? `Last seen ${new Date(installation.lastSeen).toLocaleString()}` : 'No installation activity yet'}
                                </div>
                                <div className="mt-4">
                                  <PolicyScopePanel
                                    title={`${installation.displayName || installation.appCatalog.displayName} App Policy`}
                                    scopePath={`/apps/${installation.id}`}
                                    deviceId={device.id}
                                    summary="App-specific rules layered on top of profile and device policy."
                                    editable={selectedProfile.status !== 'archived' && selectedProfile.status !== 'deleted'}
                                  />
                                </div>
                                <div className="mt-4">
                                  <ScopeInsightsPanel
                                    title={`${installation.displayName || installation.appCatalog.displayName} Insights`}
                                    scopePath={`/apps/${installation.id}`}
                                    summary="Scoped activity, alerts, and audit records for this app installation."
                                    defaultTab="activity"
                                  />
                                </div>
                                {allTransferTargetDevices.length > 1 ? (
                                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                      <MoveRight className="w-4 h-4 text-brand-500" />
                                      Transfer App Installation
                                    </div>
                                    <select
                                      value={appTransferTargets[installation.id] || ''}
                                      onChange={(event) =>
                                        setAppTransferTargets((current) => ({
                                          ...current,
                                          [installation.id]: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-800 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
                                    >
                                      <option value="">Select target device</option>
                                      {allTransferTargetDevices
                                        .filter((target) => target.id !== device.id)
                                        .map((target) => (
                                          <option key={target.id} value={target.id}>
                                            {target.profileName} • {target.name}
                                          </option>
                                        ))}
                                    </select>
                                    <button
                                      onClick={() =>
                                        transferAppMutation.mutate({
                                          installationId: installation.id,
                                          toDeviceId: appTransferTargets[installation.id],
                                        })
                                      }
                                      className="btn-primary"
                                      disabled={!appTransferTargets[installation.id] || transferAppMutation.isPending}
                                    >
                                      {transferAppMutation.isPending ? 'Transferring...' : 'Transfer App'}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
