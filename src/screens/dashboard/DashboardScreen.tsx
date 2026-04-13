import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AppWindow, CheckCircle2, ShieldAlert, TriangleAlert, Users } from 'lucide-react';
import { apiClient } from '../../api/client';

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

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
}

export default function DashboardScreen() {
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
  });

  const { data: archivedProfiles = [] } = useQuery<AnyRecord[]>({
    queryKey: ['profiles', 'archived'],
    queryFn: async () => (await apiClient.get('/profiles/archived')).data,
    enabled: !!family,
  });

  const { data: detections = [], isLoading: detectionsLoading } = useQuery<AnyRecord[]>({
    queryKey: ['detections'],
    queryFn: async () => (await apiClient.get('/detections')).data,
  });

  const { data: me } = useQuery<AnyRecord>({
    queryKey: ['me'],
    queryFn: async () => (await apiClient.get('/auth/me')).data,
  });

  const { data: subscriptionLimits } = useQuery<SubscriptionLimits>({
    queryKey: ['subscription', 'limits'],
    queryFn: async () => (await apiClient.get('/subscription/limits')).data,
    enabled: !!family,
  });

  const counts = useMemo(() => {
    const protectedProfiles = profiles.length;
    const archived = archivedProfiles.length;
    const devices = profiles.reduce((total, profile) => total + profile.deviceCount, 0);
    const appInstallations = profiles.reduce((total, profile) => total + profile.appInstallationCount, 0);
    const activePairingCodes = profiles.reduce((total, profile) => total + profile.activePairingCodeCount, 0);
    return { protectedProfiles, archived, devices, appInstallations, activePairingCodes };
  }, [archivedProfiles, profiles]);

  const recentActivity = useMemo(
    () =>
      detections
        .map((event) => ({
          id: event.id,
          title: event.appName ? `Detection in ${event.appName}` : 'Detection reported',
          subtitle: event.device?.deviceName || 'Unknown device',
          timestamp: new Date(event.timestamp),
          tone: 'alert',
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 8),
    [detections],
  );

  const planSummary = useMemo(() => {
    if (!subscriptionLimits) return null;
    const allowedCatalogCount = subscriptionLimits.catalog.filter((entry) => entry.allowed).length;
    return {
      name: subscriptionLimits.plan.displayName,
      activeProfiles: `${subscriptionLimits.usage.activeProfiles}/${subscriptionLimits.plan.limits.activeProfiles ?? '∞'}`,
      archivedProfiles: `${subscriptionLimits.usage.archivedProfiles}/${subscriptionLimits.plan.limits.archivedProfiles ?? '∞'}`,
      devicesPerProfile: subscriptionLimits.plan.limits.devicesPerProfile ?? '∞',
      appInstallationsPerProfile: subscriptionLimits.plan.limits.appInstallationsPerProfile ?? '∞',
      allowedCatalogCount,
    };
  }, [subscriptionLimits]);

  const overviewStatus = !me?.isVerified
    ? {
        title: 'Email Verification Required',
        detail: 'Verify the parent email before depending on the account',
        accent: 'text-rose-500',
        indicator: 'bg-rose-500',
      }
    : !family
      ? {
          title: 'Family Setup Required',
          detail: 'Create the family before adding child profiles',
          accent: 'text-amber-500',
          indicator: 'bg-amber-500',
        }
      : counts.devices > 0
        ? {
            title: 'Monitoring Ready',
            detail: `${counts.devices} devices and ${counts.appInstallations} app installs linked`,
            accent: 'text-accent-teal',
            indicator: 'bg-accent-teal',
          }
        : counts.activePairingCodes > 0
          ? {
              title: 'Pairing Pending',
              detail: `${counts.activePairingCodes} active pairing code${counts.activePairingCodes === 1 ? '' : 's'} waiting to be used`,
              accent: 'text-brand-500',
              indicator: 'bg-brand-500',
            }
          : {
              title: 'Waiting For First Child Device',
              detail: 'Create a profile and generate a pairing code from the Profiles screen',
              accent: 'text-amber-500',
              indicator: 'bg-amber-500',
            };

  const isLoading = familyLoading || profilesLoading || detectionsLoading;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-100">Overview</h1>
        <p className="text-slate-400">Live profile counts, app-link state, and recent detection activity.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-50">
            <Users className="w-16 h-16 text-brand-500" />
          </div>
          <h3 className="text-slate-400 font-medium mb-1 z-10">Child Profiles</h3>
          <span className="text-4xl font-bold text-slate-100 z-10">{counts.protectedProfiles}</span>
          <span className="text-sm text-brand-400 mt-2 font-medium z-10">
            {counts.archived} archived profile{counts.archived === 1 ? '' : 's'}
          </span>
        </div>

        <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-50">
            <Activity className="w-16 h-16 text-accent-teal" />
          </div>
          <h3 className="text-slate-400 font-medium mb-1 z-10">Connected Devices</h3>
          <span className="text-4xl font-bold text-slate-100 z-10">{counts.devices}</span>
          <span className="text-sm text-accent-teal mt-2 font-medium z-10">
            {counts.activePairingCodes} active pairing code{counts.activePairingCodes === 1 ? '' : 's'}
          </span>
        </div>

        <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-50">
            <AppWindow className="w-16 h-16 text-brand-500" />
          </div>
          <h3 className="text-slate-400 font-medium mb-1 z-10">App Installations</h3>
          <span className="text-4xl font-bold text-slate-100 z-10">{counts.appInstallations}</span>
          <span className="text-sm text-brand-400 mt-2 font-medium z-10">
            Across all active child profiles
          </span>
        </div>

        <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-50">
            <ShieldAlert className="w-16 h-16 text-accent-rose" />
          </div>
          <h3 className="text-slate-400 font-medium mb-1 z-10">System Status</h3>
          <span className={`text-2xl font-bold z-10 mt-2 ${overviewStatus.accent}`}>{overviewStatus.title}</span>
          <div className="flex items-center mt-3 z-10">
            <span className={`w-3 h-3 rounded-full ${overviewStatus.indicator} animate-pulse mr-2`}></span>
            <span className={`text-sm font-medium ${overviewStatus.accent}`}>{overviewStatus.detail}</span>
          </div>
        </div>
      </div>

      {planSummary ? (
        <div className="glass-panel p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-200">Plan And Quotas</h2>
              <p className="text-slate-400 mt-1">
                {planSummary.name} plan with live usage from the backend quota service.
              </p>
            </div>
            <div className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-400">
              {planSummary.name}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-xl border border-slate-200/10 bg-slate-900/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Active Profiles</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{planSummary.activeProfiles}</div>
            </div>
            <div className="rounded-xl border border-slate-200/10 bg-slate-900/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Archived Profiles</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{planSummary.archivedProfiles}</div>
            </div>
            <div className="rounded-xl border border-slate-200/10 bg-slate-900/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Devices Per Profile</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{planSummary.devicesPerProfile}</div>
            </div>
            <div className="rounded-xl border border-slate-200/10 bg-slate-900/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Apps Per Profile</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{planSummary.appInstallationsPerProfile}</div>
            </div>
            <div className="rounded-xl border border-slate-200/10 bg-slate-900/20 px-4 py-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Allowed App Types</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{planSummary.allowedCatalogCount}</div>
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="w-full h-64 glass-panel flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      ) : !family ? (
        <div className="w-full glass-panel p-8 flex flex-col items-center justify-center border-dashed border-red-500/30">
          <ShieldAlert className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-200 mb-2">No Family Configured</h2>
          <p className="text-slate-400 text-center max-w-md">
            Create a family from the Profiles screen before adding child profiles and linking GuardHub apps.
          </p>
        </div>
      ) : (
        <div className="w-full glass-panel p-8">
          <h2 className="text-xl font-bold text-slate-200 mb-4">Recent Detection Activity</h2>

          {recentActivity.length === 0 ? (
            <div className="text-slate-500 text-center py-12">
              No detection events yet. Once linked apps report explicit-content events, they will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {item.tone === 'alert' ? (
                      <TriangleAlert className="w-4 h-4 text-accent-rose" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-accent-teal" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-100">{item.title}</div>
                      <div className="text-xs text-slate-400">{item.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{item.timestamp.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
