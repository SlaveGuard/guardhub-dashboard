import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PauseCircle, PlayCircle, Plus, ShieldCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import Breadcrumb from '../../components/Breadcrumb';
import GuardScreenDeviceView from '../../components/GuardScreenDeviceView';
import KidsControlCenter from '../../components/KidsControlCenter';
import LinkedDeviceGroup from '../../components/LinkedDeviceGroup';
import PairingCodeGenerator from '../../components/PairingCodeGenerator';
import { showPlanLimitToast } from '../../lib/planLimitToast';

type Family = { id: string; name: string } | null;
type AnyRecord = Record<string, any>;
type ScreenView =
  | { mode: 'list' }
  | { mode: 'detail'; profileId: string }
  | { mode: 'kids-control'; profileId: string; deviceId: string; deviceName: string }
  | { mode: 'guardscreen'; profileId: string; deviceId: string; deviceName: string };

type SubscriptionLimits = {
  plan: {
    displayName: string;
    limits: {
      activeProfiles: number | null;
      archivedProfiles: number | null;
    };
  };
  usage: {
    activeProfiles: number;
    archivedProfiles: number;
  };
};

const emptyProfileForm = { name: '', age: '', grade: '', timezone: '' };
const gradients = [
  'from-brand-600 to-brand-400',
  'from-sky-500 to-accent-teal',
  'from-amber-400 to-rose-400',
  'from-emerald-400 to-brand-500',
  'from-rose-400 to-fuchsia-500',
];

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

function tone(status: string) {
  if (status === 'active') return 'bg-emerald-400/10 text-emerald-400';
  if (status === 'paused') return 'bg-amber-400/10 text-amber-400';
  if (status === 'archived') return 'bg-slate-600/40 text-slate-300';
  return 'bg-slate-700/50 text-slate-300';
}

function label(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
}

function getDeviceName(device: AnyRecord) {
  return device.deviceName || device.name || 'Device';
}

function getDeviceCount(profile: AnyRecord) {
  return Array.isArray(profile.devices) ? profile.devices.length : Number(profile.deviceCount ?? 0);
}

function getAppCount(profile: AnyRecord) {
  if (Array.isArray(profile.devices)) {
    return profile.devices.reduce((total: number, device: AnyRecord) => total + (device.appInstallations?.length ?? 0), 0);
  }
  return Number(profile.appInstallationCount ?? 0);
}

function profileInitial(profile: AnyRecord) {
  return String(profile.name || '?').slice(0, 1).toUpperCase();
}

function profileMeta(profile: AnyRecord) {
  const since = profile.activeSince || profile.createdAt || profile.registeredAt;
  return [
    profile.age ? `Age ${profile.age}` : null,
    since ? `Active since ${new Date(since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : null,
  ].filter(Boolean).join(' . ') || 'No profile metadata yet';
}

function pastTense(action: 'pause' | 'resume' | 'archive' | 'restore' | 'delete') {
  return {
    pause: 'paused',
    resume: 'resumed',
    archive: 'archived',
    restore: 'restored',
    delete: 'deleted',
  }[action];
}

function ProfileCard({
  profile,
  index,
  onClick,
}: {
  profile: AnyRecord;
  index: number;
  onClick: () => void;
}) {
  const alerts = profile.alertCount ?? profile.alertsToday ?? profile.activeAlertCount;
  const stats = [
    ['Devices', getDeviceCount(profile)],
    ['Apps', getAppCount(profile)],
    ...(alerts == null ? [] : [['Alerts', alerts]]),
  ];

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-panel group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-800/70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${gradients[index % gradients.length]} text-lg font-bold text-white`}>
          {profileInitial(profile)}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone(profile.status)}`}>
          {label(profile.status)}
        </span>
      </div>
      <div className="mt-4">
        <h2 className="text-base font-semibold text-slate-100">{profile.name}</h2>
        <p className="mt-1 text-xs text-slate-400">{profileMeta(profile)}</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {stats.map(([statLabel, value]) => (
          <div key={String(statLabel)} className="rounded-lg bg-slate-900/40 px-3 py-2 text-center">
            <div className="text-base font-semibold text-slate-100">{value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{statLabel}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

function policyEntryValue(policy: AnyRecord | undefined, key: string) {
  const entry = policy?.entries?.find((item: AnyRecord) => item.key === key);
  return entry?.effectiveValue ?? entry?.value;
}

function PolicyPill({
  children,
  active,
  tone: pillTone,
  onClick,
}: {
  children: string;
  active?: boolean;
  tone: 'amber' | 'rose' | 'slate';
  onClick: () => void;
}) {
  const activeClass = {
    amber: 'border-amber-400 bg-amber-400/10 text-amber-400',
    rose: 'border-rose-400 bg-rose-400/10 text-rose-400',
    slate: 'border-white/10 bg-slate-900/40 text-slate-500',
  }[pillTone];
  const inactiveClass = 'border-white/10 bg-transparent text-slate-500 hover:text-slate-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? activeClass : inactiveClass}`}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-t border-white/10 py-3">
      <span>
        <span className="block text-sm font-medium text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-10 shrink-0 accent-accent-teal"
      />
    </label>
  );
}

function ProfilePolicyCards({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { data: effectivePolicy } = useQuery<AnyRecord>({
    queryKey: ['profile', profileId, 'effective-policy'],
    queryFn: async () => (await apiClient.get(`/profiles/${profileId}/effective-policy`)).data,
  });

  const explicitBlocking = policyEntryValue(effectivePolicy, 'content.explicit_blocking');
  const dailyLimit = policyEntryValue(effectivePolicy, 'screen_time.daily_limit');
  const strictMode = policyEntryValue(effectivePolicy, 'control.strict_mode')?.enabled ?? true;
  const detectionAlerts = policyEntryValue(effectivePolicy, 'notifications.detection_alerts')?.enabled ?? true;
  const filterMode = explicitBlocking?.mode ?? (explicitBlocking?.enabled === false ? 'off' : 'block');
  const [screenHours, setScreenHours] = useState(Number(dailyLimit?.minutes ? Math.round(dailyLimit.minutes / 60) : 6));

  useEffect(() => {
    if (dailyLimit?.minutes) {
      setScreenHours(Math.round(Number(dailyLimit.minutes) / 60));
    }
  }, [dailyLimit?.minutes]);

  const patchPolicyMutation = useMutation({
    mutationFn: async (entry: { key: string; value: AnyRecord; strength?: string }) =>
      (await apiClient.patch(`/profiles/${profileId}/policy`, {
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
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileId, 'effective-policy'] });
      toast.success('Profile policy updated.');
    },
    onError: (error: AnyRecord) => toast.error(error.response?.data?.message || 'Failed to update profile policy'),
  });

  const saveRule = (key: string, value: AnyRecord, strength = 'soft') => {
    patchPolicyMutation.mutate({ key, value, strength });
  };

  const effectiveRows = [
    {
      key: 'content_filter',
      value: filterMode === 'off' ? 'off' : filterMode,
      color: filterMode === 'block' ? 'text-rose-400' : filterMode === 'warn' ? 'text-amber-400' : 'text-slate-400',
    },
    { key: 'screen_time_limit', value: `${screenHours}h / day`, color: 'text-brand-400' },
    { key: 'strict_mode', value: strictMode ? 'enabled' : 'disabled', color: strictMode ? 'text-emerald-400' : 'text-slate-400' },
    { key: 'bedtime', value: '9pm - 7am', color: 'text-accent-teal' },
    { key: 'app_blocklist', value: 'active', color: 'text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="glass-panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-100">Profile Policy</h2>

        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-slate-400">Content Filtering Mode</div>
          <div className="flex flex-wrap gap-2">
            <PolicyPill
              tone="amber"
              active={filterMode === 'warn'}
              onClick={() => saveRule('content.explicit_blocking', { enabled: true, mode: 'warn' }, 'soft')}
            >
              Warn Only
            </PolicyPill>
            <PolicyPill
              tone="rose"
              active={filterMode === 'block'}
              onClick={() => saveRule('content.explicit_blocking', { enabled: true, mode: 'block' }, 'hard')}
            >
              Block
            </PolicyPill>
            <PolicyPill
              tone="slate"
              active={filterMode === 'off'}
              onClick={() => saveRule('content.explicit_blocking', { enabled: false, mode: 'off' }, 'soft')}
            >
              Off
            </PolicyPill>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-100">Daily Screen Time Limit</span>
            <span className="font-semibold text-brand-400">{screenHours}h</span>
          </div>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={screenHours}
            onChange={(event) => setScreenHours(Number(event.target.value))}
            onMouseUp={() => saveRule('screen_time.daily_limit', { enabled: true, minutes: screenHours * 60 })}
            className="w-full accent-brand-500"
          />
        </div>

        <ToggleRow
          title="Strict Mode"
          description="Black out screens when detection is unavailable"
          checked={strictMode}
          onChange={(checked) => saveRule('control.strict_mode', { enabled: checked }, 'hard')}
        />
        <ToggleRow
          title="Detection Alerts"
          description="Notify parents about blocked content attempts"
          checked={detectionAlerts}
          onChange={(checked) => saveRule('notifications.detection_alerts', { enabled: checked }, 'soft')}
        />
      </section>

      <section className="glass-panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-100">Effective Rules</h2>
        <div className="space-y-2">
          {effectiveRows.map((row) => (
            <div key={row.key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
              <span className="min-w-0 flex-1 font-mono text-xs tracking-widest text-slate-400">{row.key}</span>
              <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
              <span className="rounded-full bg-brand-500/10 px-2 py-1 text-[10px] font-medium text-brand-400">Profile</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-500">Last synced {effectivePolicy?.updatedAt ? new Date(effectivePolicy.updatedAt).toLocaleString() : 'recently'}</div>
      </section>
    </div>
  );
}

function MissingInstallation() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
      This app installation was not found on the selected device.
    </div>
  );
}

export default function DevicesRedesignScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState('My Family');
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [view, setView] = useState<ScreenView>({ mode: 'list' });
  const selectedProfileId = view.mode === 'list' ? null : view.profileId;

  const { data: family, isLoading: familyLoading } = useQuery<Family>({
    queryKey: ['family'],
    queryFn: async () => {
      try {
        return (await apiClient.get('/family/me')).data;
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
  });

  const { data: archivedProfiles = [], isLoading: archivedProfilesLoading } = useQuery<AnyRecord[]>({
    queryKey: ['profiles', 'archived'],
    queryFn: async () => (await apiClient.get('/profiles/archived')).data,
    enabled: !!family,
  });

  const { data: appCatalog = [] } = useQuery<AnyRecord[]>({
    queryKey: ['app-catalog'],
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
  });

  const totalDevices = useMemo(
    () => profiles.reduce((total, profile) => total + getDeviceCount(profile), 0),
    [profiles],
  );
  const totalApps = useMemo(
    () => profiles.reduce((total, profile) => total + getAppCount(profile), 0),
    [profiles],
  );
  const activeProfileLimitReached = useMemo(() => {
    const limit = subscriptionLimits?.plan.limits.activeProfiles;
    if (limit == null) return false;
    return (subscriptionLimits?.usage.activeProfiles ?? 0) >= limit;
  }, [subscriptionLimits]);

  const createFamilyMutation = useMutation({
    mutationFn: async (name: string) => apiClient.post('/family/create', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      toast.success('Family created.');
    },
    onError: (error: AnyRecord) => showPlanLimitToast(error, 'Failed to create family', navigate),
  });

  const createProfileMutation = useMutation({
    mutationFn: async (payload: AnyRecord) => (await apiClient.post('/profiles', payload)).data,
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', 'archived'] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      setProfileForm(emptyProfileForm);
      setShowProfileForm(false);
      setView({ mode: 'detail', profileId: profile.id });
      toast.success('Child profile created.');
    },
    onError: (error: AnyRecord) => showPlanLimitToast(error, 'Failed to create profile', navigate),
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
      toast.success(`Profile ${pastTense(payload.action)}.`);
    },
    onError: (error: AnyRecord) => showPlanLimitToast(error, 'Profile action failed', navigate),
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

  const selectedDevice =
    selectedProfile && (view.mode === 'kids-control' || view.mode === 'guardscreen')
      ? (selectedProfile.devices ?? []).find((device: AnyRecord) => device.id === view.deviceId)
      : null;
  const selectedInstallation =
    selectedDevice && (view.mode === 'kids-control' || view.mode === 'guardscreen')
      ? (selectedDevice.appInstallations ?? []).find((installation: AnyRecord) => {
          const slug = String(installation.appCatalog?.slug || '').toLowerCase();
          return view.mode === 'kids-control' ? slug.includes('guardhub-kids') : slug.includes('guardscreen');
        })
      : null;

  const openAppView = (device: AnyRecord, installation: AnyRecord) => {
    if (!selectedProfile) return;
    const slug = String(installation.appCatalog?.slug || '').toLowerCase();
    const name = getDeviceName(device);
    if (slug.includes('guardhub-kids')) {
      setView({ mode: 'kids-control', profileId: selectedProfile.id, deviceId: device.id, deviceName: name });
      return;
    }
    if (slug.includes('guardscreen')) {
      setView({ mode: 'guardscreen', profileId: selectedProfile.id, deviceId: device.id, deviceName: name });
    }
  };

  if (familyLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Profiles</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Create the family first, then add child profiles and generate one-time pairing codes.
          </p>
        </header>
        <div className="glass-panel flex flex-col items-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10">
            <Users className="h-8 w-8 text-brand-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Your Family Space</h2>
          <p className="mb-8 mt-2 max-w-md text-slate-500 dark:text-slate-400">
            Child profiles, devices, and app installations all live under the family.
          </p>
          <div className="w-full max-w-md space-y-4">
            <input
              type="text"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Family name"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-dark-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => createFamilyMutation.mutate(familyName.trim())}
              className="btn-primary flex w-full items-center justify-center gap-2"
              disabled={createFamilyMutation.isPending || !familyName.trim()}
            >
              <Plus className="h-5 w-5" />
              {createFamilyMutation.isPending ? 'Creating Family...' : 'Create Family'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {view.mode === 'list' ? (
        <>
          <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Profiles</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Manage child profiles, pairing codes, linked devices, and app installations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileForm((current) => !current)}
              className="btn-primary flex items-center justify-center gap-2 rounded-lg px-4 py-2.5"
            >
              <Plus className="h-4 w-4" />
              Add Profile
            </button>
          </header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Active Profiles', subscriptionLimits ? `${subscriptionLimits.usage.activeProfiles}/${subscriptionLimits.plan.limits.activeProfiles ?? 'unlimited'}` : profiles.length],
              ['Archived Profiles', subscriptionLimits ? `${subscriptionLimits.usage.archivedProfiles}/${subscriptionLimits.plan.limits.archivedProfiles ?? 'unlimited'}` : archivedProfiles.length],
              ['Devices', totalDevices],
              ['App Installs', totalApps],
            ].map(([title, value]) => (
              <div key={String(title)} className="glass-panel p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
                <div className="mt-2 text-2xl font-bold text-slate-100">{value}</div>
              </div>
            ))}
          </section>

          {showProfileForm ? (
            <section className="glass-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-100">Create Child Profile</h2>
                <ShieldCheck className="h-5 w-5 text-accent-teal" />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Child name"
                  className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 outline-none focus:border-brand-500"
                />
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={profileForm.age}
                  onChange={(event) => setProfileForm((current) => ({ ...current, age: event.target.value }))}
                  placeholder="Age"
                  className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 outline-none focus:border-brand-500"
                />
                <input
                  type="text"
                  value={profileForm.grade}
                  onChange={(event) => setProfileForm((current) => ({ ...current, grade: event.target.value }))}
                  placeholder="Grade"
                  className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 outline-none focus:border-brand-500"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateProfile}
                  className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2.5"
                  disabled={createProfileMutation.isPending || activeProfileLimitReached}
                >
                  <Plus className="h-4 w-4" />
                  {createProfileMutation.isPending ? 'Creating...' : 'Create Profile'}
                </button>
                {activeProfileLimitReached ? (
                  <span className="text-xs text-amber-400">Active profile limit reached for the current plan.</span>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Profile Cards</h2>
              {profilesLoading || archivedProfilesLoading ? <span className="text-xs text-slate-500">Loading...</span> : null}
            </div>
            {[...profiles, ...archivedProfiles].length === 0 ? (
              <div className="glass-panel border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No child profiles yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {[...profiles, ...archivedProfiles].map((profile, index) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    index={index}
                    onClick={() => setView({ mode: 'detail', profileId: profile.id })}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {view.mode !== 'list' && selectedProfileLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
        </div>
      ) : null}

      {view.mode === 'detail' && selectedProfile ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setView({ mode: 'list' })}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profiles
          </button>

          <section className="glass-panel px-5 py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradients[0]} text-xl font-bold text-white`}>
                  {profileInitial(selectedProfile)}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-slate-100">{selectedProfile.name}</h1>
                  <p className="mt-1 text-sm text-slate-400">{profileMeta(selectedProfile)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedProfile.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={() => lifecycleMutation.mutate({ profileId: selectedProfile.id, action: 'resume' })}
                    disabled={lifecycleMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-400 disabled:opacity-50"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Resume Profile
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => lifecycleMutation.mutate({ profileId: selectedProfile.id, action: 'pause' })}
                    disabled={lifecycleMutation.isPending || selectedProfile.status !== 'active'}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-400 disabled:opacity-50"
                  >
                    <PauseCircle className="h-4 w-4" />
                    Pause Profile
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => document.getElementById('pairing-codes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="btn-primary flex items-center gap-2 rounded-lg px-3 py-2"
                >
                  <Plus className="h-4 w-4" />
                  Link Device
                </button>
              </div>
            </div>
          </section>

          <ProfilePolicyCards profileId={selectedProfile.id} />

          <div id="pairing-codes">
            <PairingCodeGenerator
              profileId={selectedProfile.id}
              appCatalog={appCatalog}
              activePairingCodes={selectedProfile.activePairingCodes ?? []}
              disabled={selectedProfile.status === 'archived' || selectedProfile.status === 'deleted'}
            />
          </div>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Linked Devices</h2>
              <p className="mt-1 text-sm text-slate-400">Devices are grouped by physical hardware with app installations inside.</p>
            </div>
            {(selectedProfile.devices ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                No devices linked to this profile yet.
              </div>
            ) : (
              <div className="space-y-3">
                {(selectedProfile.devices ?? []).map((device: AnyRecord) => (
                  <LinkedDeviceGroup key={device.id} device={device} onOpenApp={openAppView} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {view.mode === 'kids-control' && selectedProfile ? (
        <div className="space-y-5">
          <Breadcrumb
            items={[
              { label: 'Profiles', onClick: () => setView({ mode: 'list' }) },
              { label: selectedProfile.name, onClick: () => setView({ mode: 'detail', profileId: selectedProfile.id }) },
              { label: `${view.deviceName} (GuardHub Kids)` },
            ]}
          />
          {selectedDevice && selectedInstallation ? (
            <KidsControlCenter profile={selectedProfile} device={selectedDevice} installation={selectedInstallation} />
          ) : (
            <MissingInstallation />
          )}
        </div>
      ) : null}

      {view.mode === 'guardscreen' && selectedProfile ? (
        <div className="space-y-5">
          <Breadcrumb
            items={[
              { label: 'Profiles', onClick: () => setView({ mode: 'list' }) },
              { label: selectedProfile.name, onClick: () => setView({ mode: 'detail', profileId: selectedProfile.id }) },
              { label: view.deviceName, onClick: () => setView({ mode: 'detail', profileId: selectedProfile.id }) },
              { label: 'GuardScreen' },
            ]}
          />
          {selectedDevice && selectedInstallation ? (
            <GuardScreenDeviceView device={selectedDevice} installation={selectedInstallation} />
          ) : (
            <MissingInstallation />
          )}
        </div>
      ) : null}
    </div>
  );
}
