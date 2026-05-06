import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowRight, Check, Shield, Smartphone } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

type AnyRecord = Record<string, any>;

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
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
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</span>
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

export default function SettingsScreen() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [password, setPassword] = useState('');
  const [guardScreenDefaults, setGuardScreenDefaults] = useState({
    protectionActive: true,
    lockSettings: true,
  });

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (currentPassword: string) => {
      return apiClient.delete('/auth/me', {
        data: { password: currentPassword },
      });
    },
    onSuccess: (response) => {
      logout();
      toast.success(response.data?.message || 'Account deleted successfully.');
      navigate('/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete account.');
    },
  });

  const { data: familySettings } = useQuery<AnyRecord | null>({
    queryKey: ['family', 'settings'],
    queryFn: async () => {
      try {
        return (await apiClient.get('/family/settings')).data;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
  });

  useEffect(() => {
    if (!familySettings) return;
    setGuardScreenDefaults({
      protectionActive: familySettings.guardScreen?.protectionActive ?? true,
      lockSettings: familySettings.guardScreen?.lockSettings ?? true,
    });
  }, [familySettings]);

  const updateFamilySettingsMutation = useMutation({
    mutationFn: async (next: typeof guardScreenDefaults) =>
      (await apiClient.patch('/family/settings', { guardScreen: next })).data,
    onSuccess: () => toast.success('GuardScreen defaults updated.'),
    onError: (error: AnyRecord) => toast.error(error.response?.data?.message || 'Failed to update GuardScreen defaults'),
  });

  const updateGuardScreenDefault = (key: keyof typeof guardScreenDefaults, value: boolean) => {
    const next = { ...guardScreenDefaults, [key]: value };
    setGuardScreenDefaults(next);
    if (familySettings) {
      updateFamilySettingsMutation.mutate(next);
      return;
    }
    // TODO: Wire these global defaults to the family-level settings endpoint when it is available.
    toast.success('GuardScreen default saved locally.');
  };

  const handleDelete = (e: FormEvent) => {
    e.preventDefault();
    deleteAccountMutation.mutate(password);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage global app defaults and your parent account.</p>
      </header>

      <section className="max-w-2xl space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">GuardScreen (Android App)</div>
          <div className="glass-panel mt-2 p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-400/10 text-rose-400">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">GuardScreen</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Explicit content protection</p>
              </div>
            </div>
            <ToggleRow
              title="Protection Active"
              description="Remotely enable content protection"
              checked={guardScreenDefaults.protectionActive}
              disabled={updateFamilySettingsMutation.isPending}
              onChange={(checked) => updateGuardScreenDefault('protectionActive', checked)}
            />
            <ToggleRow
              title="Lock Settings"
              description="Prevent child from disabling or uninstalling GuardScreen"
              checked={guardScreenDefaults.lockSettings}
              disabled={updateFamilySettingsMutation.isPending}
              onChange={(checked) => updateGuardScreenDefault('lockSettings', checked)}
            />
            <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Advanced settings, sensitivity, and per-app overrides are configured per-device inside each child's profile.
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">GuardHub Kids</div>
          <div className="glass-panel mt-2 p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">GuardHub Kids</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Screen time and app management</p>
              </div>
            </div>
            <div className="rounded-xl border border-accent-teal/20 bg-accent-teal/5 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                GuardHub Kids is configured per-child device. Go to Profiles, select a child, then select their GuardHub Kids device.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                {['Screen Time Limits', 'App Management', 'Web Filtering', 'Bedtime Schedule', 'Scheduled Blocks', 'Usage Reports'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-accent-teal" />
                    {item}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate('/profiles')}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent-teal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-400"
              >
                Go to Profiles
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Account</h2>
        <div className="space-y-2 text-sm">
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Name:</span> {me?.displayName || 'Not set'}</p>
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Email:</span> {me?.email}</p>
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Verification:</span> {me?.isVerified ? 'Verified' : 'Not verified'}</p>
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Role:</span> {me?.role}</p>
        </div>
      </div>

      <div className="glass-panel p-6 border-red-500/20">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Delete Account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              This deactivates your parent account now and hard-deletes retained family data after 90 days.
            </p>
          </div>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Confirm current password</label>
            <input
              type="password"
              className="glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-60"
            disabled={deleteAccountMutation.isPending}
          >
            {deleteAccountMutation.isPending ? 'Deleting Account...' : 'Delete My Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
