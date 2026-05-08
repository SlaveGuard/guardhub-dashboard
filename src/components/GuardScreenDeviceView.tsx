import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCcw, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';

type AnyRecord = Record<string, any>;

function findEntry(policy: AnyRecord | undefined, key: string) {
  return policy?.entries?.find((entry: AnyRecord) => entry.key === key);
}

function policyEnabled(policy: AnyRecord | undefined, key: string, fallback = true) {
  const entry = findEntry(policy, key);
  const value = entry?.effectiveValue ?? entry?.value;
  if (typeof value === 'boolean') return value;
  if (typeof value?.enabled === 'boolean') return value.enabled;
  return fallback;
}

function runtimeStatus(value: boolean | null) {
  if (value === true) {
    return {
      label: 'Active',
      className: 'bg-emerald-400/10 text-emerald-400',
    };
  }

  if (value === false) {
    return {
      label: 'Inactive',
      className: 'bg-rose-400/10 text-rose-400',
    };
  }

  return {
    label: 'Unknown',
    className: 'bg-slate-500/10 text-slate-400',
  };
}

function deviceName(device: AnyRecord) {
  return device.deviceName || device.name || 'Device';
}

function deviceMeta(device: AnyRecord) {
  const platform = device.platform || device.type || 'Android';
  const lastSeen = device.lastSeen ? `Last seen ${new Date(device.lastSeen).toLocaleString()}` : 'No activity reported yet';
  return `${platform} . ${lastSeen}`;
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-white/10 py-4 last:border-b-0">
      <span>
        <span className="block text-sm font-medium text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-10 shrink-0 accent-accent-teal"
      />
    </label>
  );
}

export default function GuardScreenDeviceView({
  device,
  installation,
}: {
  device: AnyRecord;
  installation: AnyRecord;
}) {
  const queryClient = useQueryClient();
  const installationId = installation.id;

  const { data: effectivePolicy } = useQuery<AnyRecord>({
    queryKey: ['app', installationId, 'effective-policy'],
    queryFn: async () => (await apiClient.get(`/apps/${installationId}/effective-policy`)).data,
    enabled: !!installationId,
  });

  const { data: liveDevice } = useQuery<AnyRecord>({
    queryKey: ['device', device.id],
    queryFn: async () => (await apiClient.get(`/devices/${device.id}`)).data,
    enabled: !!device.id,
    refetchInterval: 10_000,
    initialData: device,
    // REASON: initialData seeds from the profile query instantly;
    // polling keeps it fresh without waiting for parent re-render.
  });

  const explicitBlockingEnabled = useMemo(
    () => policyEnabled(effectivePolicy, 'content.explicit_blocking', true),
    [effectivePolicy],
  );
  const lockSettings = useMemo(
    () => policyEnabled(effectivePolicy, 'control.lock_settings', true),
    [effectivePolicy],
  );
  const protectionActive: boolean | null = liveDevice?.protectionActive ?? null;
  const lockdownActive: boolean | null = liveDevice?.lockdownActive ?? null;
  const protectionStatus = runtimeStatus(protectionActive);
  const lockdownStatus = runtimeStatus(lockdownActive);

  const patchPolicyMutation = useMutation({
    mutationFn: async (entry: { key: string; enabled: boolean; strength?: string }) =>
      // TODO: Confirm the exact GuardScreen policy keys with the backend contract once the per-device schema is finalized.
      (await apiClient.patch(`/apps/${installationId}/policy`, {
        entries: [
          {
            key: entry.key,
            value: { enabled: entry.enabled },
            strength: entry.strength ?? 'hard',
            operation: 'upsert',
          },
        ],
      })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', installationId, 'effective-policy'] });
      toast.success('GuardScreen policy updated.');
    },
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to update GuardScreen policy');
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => (await apiClient.post(`/devices/${device.id}/command`, { command: 'SYNC_CONFIG' })).data,
    onSuccess: () => toast.success('Sync requested.'),
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to request sync');
    },
  });

  return (
    <div className="max-w-xl space-y-5">
      <section className="glass-panel p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-400/10 text-rose-400">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-100">{deviceName(device)} - GuardScreen</h2>
            <p className="mt-1 text-xs text-slate-400">{deviceMeta(device)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${protectionStatus.className}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Protection {protectionStatus.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${lockdownStatus.className}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Lockdown {lockdownStatus.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-500/20 px-3 py-2 text-sm font-medium text-brand-400 transition-colors hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Sync
          </button>
        </div>
      </section>

      <section className="glass-panel p-5">
        <h3 className="text-sm font-semibold text-slate-100">GuardScreen Controls</h3>
        <div className="mt-2">
          <ToggleRow
            title="Protection Active"
            description="Remotely enable or disable content protection on this device"
            checked={explicitBlockingEnabled}
            disabled={patchPolicyMutation.isPending}
            onChange={(enabled) => patchPolicyMutation.mutate({ key: 'content.explicit_blocking', enabled })}
          />
          <ToggleRow
            title="Lock Settings"
            description="Prevent child from disabling or uninstalling GuardScreen"
            checked={lockSettings}
            disabled={patchPolicyMutation.isPending}
            onChange={(enabled) => patchPolicyMutation.mutate({ key: 'control.lock_settings', enabled })}
          />
        </div>
        <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-3 text-xs leading-5 text-slate-400">
          Advanced settings are managed in Settings - GuardScreen.
        </div>
      </section>
    </div>
  );
}
