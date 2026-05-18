import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accessibility,
  Activity,
  BarChart3,
  Battery,
  Clock,
  Lock,
  MapPin,
  Pause,
  RefreshCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';
import { 
  APP_CATEGORIES, 
  APP_CATALOG,
  CATEGORY_EMOJI,
  POPULAR_APPS,
  getAppsByCategory,
  searchApps,
} from '../data/kidsAppCatalog'; 
import playStoreIconsRaw from '../data/playStoreIcons.json';

type PlayStoreEntry = {
  iconUrl: string;
  title: string;
  score: number | null;
  genre: string | null;
} | null;

const PLAY_STORE_ICONS = playStoreIconsRaw as Record<string, PlayStoreEntry>;

/** Fast O(1) lookup: packageName → catalog metadata */
const CATALOG_BY_PACKAGE = new Map(
  APP_CATALOG.map((entry) => [entry.packageName, entry]),
);

type AnyRecord = Record<string, any>;
type TabId = 'overview' | 'screen-time' | 'apps' | 'web-filter' | 'bedtime' | 'reports';

interface KidsUsageSummary { 
  packageName: string;
  dateKey: string;
  usageSeconds: number;
} 

interface InstalledApp {
  packageName: string;
  displayName: string;
  iconUrl?: string;
  iconDomain?: string;
  iconColor?: string;
  iconLetter?: string;
  category?: string;
  isBlocked: boolean;
  isAlwaysAllowed: boolean;
  timeLimitMinutes?: number;
}

interface KidsBlockedEvent {
  packageName: string;
  reason: string;
  message: string;
  occurredAtEpochMillis: number;
  reportedAt: string;
}

interface KidsHeartbeat { 
  policyVersion: number | null;
  batteryLevelPercent: number | null;
  managementMode: string | null;
  permissions: {
    usageAccess?: boolean;
    deviceAdmin?: boolean;
    notifications?: boolean;
    batteryOptimizationIgnored?: boolean;
    accessibilityFallback?: boolean;
    location?: boolean;
    backgroundLocation?: boolean;
  } | null;
  lastSyncEpochMillis: number | null;
  location: KidsLocation | null; 
  installedPackages: Array<Partial<InstalledApp> & { name?: string; appLabel?: string }> | string[];
  receivedAt: string; 
} 

interface KidsLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  altitudeMeters?: number | null;
  speedMetersPerSecond?: number | null;
  bearingDegrees?: number | null;
  capturedAtEpochMillis?: number | null;
  provider?: string | null;
}

interface DeviceHealthItem {
  label: string;
  active: boolean;
  Icon: LucideIcon;
}

interface ScheduledBlock {
  id: string;
  name: string;
  enabled: boolean;
  startTime: string; // 'HH:MM' 24h
  endTime: string;   // 'HH:MM' 24h
  days: number[];    // 0=Sun, 1=Mon … 6=Sat
}

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

const WEB_CATEGORY_KEYS: Record<string, string> = {
  'Adult Content': 'adult_content',
  Gambling: 'gambling',
  'Drugs & Alcohol': 'drugs_alcohol',
  Violence: 'violence',
  Gaming: 'gaming',
  'Social Media': 'social_media',
  News: 'news',
  Education: 'education',
  'Chat / Dating': 'chat_dating',
};

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

function usageLabel(minutes: number): string {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function toTimeString(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeString(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map(Number);
  return {
    hour: Number.isFinite(h) ? h : 21,
    minute: Number.isFinite(m) ? m : 0,
  };
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

function parseUsageSummaries(auditEntries: AnyRecord[]): KidsUsageSummary[] {
  const latestByPackageAndDate = new Map<string, KidsUsageSummary & { reportedAt: number }>();
  for (const entry of [...auditEntries].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
  )) {
    if (entry.action !== 'kids.usage_reported') continue;
    const items: AnyRecord[] = entry.details?.summaries ?? [];
    const reportedAt = new Date(entry.createdAt ?? entry.details?.reportedAt ?? 0).getTime();
    for (const item of items) {
      if (typeof item.packageName === 'string' && typeof item.usageSeconds === 'number') {
        const dateKey = String(item.dateKey ?? entry.details?.dateKey ?? '');
        latestByPackageAndDate.set(`${dateKey}:${item.packageName}`, {
          packageName: item.packageName,
          dateKey,
          usageSeconds: Number(item.usageSeconds),
          reportedAt,
        });
      }
    }
  }
  return [...latestByPackageAndDate.values()].map(({ reportedAt: _reportedAt, ...summary }) => summary);
}

function parseBlockedEvents(auditEntries: AnyRecord[]): KidsBlockedEvent[] {
  const events: KidsBlockedEvent[] = [];
  for (const entry of auditEntries) {
    if (entry.action !== 'kids.blocked_events_reported') continue;
    const items: AnyRecord[] = entry.details?.events ?? [];
    for (const item of items) {
      if (typeof item.packageName === 'string') {
        events.push({
          packageName: item.packageName,
          reason: String(item.reason ?? 'BLOCK_APP'),
          message: String(item.message ?? ''),
          occurredAtEpochMillis: Number(item.occurredAtEpochMillis ?? 0),
          reportedAt: String(entry.createdAt ?? ''),
        });
      }
    }
  }
  return events.sort((a, b) => b.occurredAtEpochMillis - a.occurredAtEpochMillis);
}

function parseLatestHeartbeat(auditEntries: AnyRecord[]): KidsHeartbeat | null {
  const latest = auditEntries
    .filter((entry) => entry.action === 'kids.heartbeat')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!latest?.details) return null;

  return {
    policyVersion: latest.details.policyVersion ?? null,
    batteryLevelPercent: latest.details.batteryLevelPercent ?? null,
    managementMode: latest.details.managementMode ?? null,
    permissions: normalizePermissions(latest.details.permissions),
    lastSyncEpochMillis: latest.details.lastSyncEpochMillis ?? null, 
    location: normalizeLocation(latest.details.location), 
    installedPackages: Array.isArray(latest.details.installedPackages) ? latest.details.installedPackages : [],
    receivedAt: String(latest.createdAt ?? ''), 
  }; 
} 

function normalizePermissions(value: unknown): KidsHeartbeat['permissions'] {
  if (!value || typeof value !== 'object') return null;
  const record = value as AnyRecord;
  const permissions = {
    usageAccess: optionalBoolean(record.usageAccess ?? record.usage_access),
    deviceAdmin: optionalBoolean(record.deviceAdmin ?? record.device_admin),
    notifications: optionalBoolean(record.notifications),
    batteryOptimizationIgnored: optionalBoolean(
      record.batteryOptimizationIgnored ?? record.battery_optimization_ignored,
    ),
    accessibilityFallback: optionalBoolean(record.accessibilityFallback ?? record.accessibility_fallback),
    location: optionalBoolean(record.location ?? record.locationGranted ?? record.location_granted),
    backgroundLocation: optionalBoolean(
      record.backgroundLocation ?? record.backgroundLocationGranted ?? record.background_location,
    ),
  };

  return Object.values(permissions).some((permission) => permission !== undefined) ? permissions : null;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

function normalizeLocation(value: unknown): KidsLocation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as AnyRecord;
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    accuracyMeters: optionalNumber(record.accuracyMeters),
    altitudeMeters: optionalNumber(record.altitudeMeters),
    speedMetersPerSecond: optionalNumber(record.speedMetersPerSecond),
    bearingDegrees: optionalNumber(record.bearingDegrees),
    capturedAtEpochMillis: optionalNumber(record.capturedAtEpochMillis),
    provider: typeof record.provider === 'string' ? record.provider : null,
  };
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

function formatAccuracy(value?: number | null) {
  if (!value) return 'Accuracy unknown';
  return `Accuracy ${Math.round(value)}m`;
}

function mapsUrl(location: KidsLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
}

function buildWeeklyUsageBars(
  summaries: KidsUsageSummary[],
  dailyLimitMinutes: number,
): Array<{ day: string; minutes: number; overLimit: boolean }> {
  const byDate = new Map<string, number>();
  for (const summary of summaries) {
    byDate.set(summary.dateKey, (byDate.get(summary.dateKey) ?? 0) + summary.usageSeconds);
  }

  const result: Array<{ day: string; minutes: number; overLimit: boolean }> = [];
  const now = new Date();
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().slice(0, 10);
    const minutes = Math.round((byDate.get(dateKey) ?? 0) / 60);
    result.push({
      day: dayLabels[date.getDay()],
      minutes,
      overLimit: dailyLimitMinutes > 0 && minutes > dailyLimitMinutes,
    });
  }

  return result;
}

function buildTopAppsByUsage( 
  summaries: KidsUsageSummary[], 
  limit = 5, 
): Array<{ packageName: string; totalSeconds: number; totalMinutes: number }> { 
  const byPackage = new Map<string, number>(); 
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  for (const summary of summaries) { 
    if (summary.dateKey < cutoffKey) continue;
    byPackage.set(summary.packageName, (byPackage.get(summary.packageName) ?? 0) + summary.usageSeconds); 
  } 

  return [...byPackage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([packageName, totalSeconds]) => ({
      packageName,
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
    }));
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function blockReasonLabel(reason: string): string { 
  switch (reason) {
    case 'BLOCK_APP':
      return 'App blocked';
    case 'BLOCK_DAILY_LIMIT':
      return 'Daily limit reached';
    case 'BLOCK_BEDTIME':
      return 'Bedtime active';
    case 'BLOCK_REMOTE_LOCK': 
      return 'Device locked by parent'; 
    case 'BLOCK_PERMISSION_RECOVERY':
      return 'Permissions required';
    case 'BLOCK_AGE_RESTRICTION':
      return 'Age rating cap';
    default:
      return 'Blocked';
  } 
} 

function appDisplayName(packageName: string): string {
  return packageName
    .split('.')
    .filter(Boolean)
    .slice(-1)[0]
    ?.replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || packageName;
}

function normalizeInstalledApps(
  apiItems: AnyRecord[] | undefined,
  heartbeatItems: KidsHeartbeat['installedPackages'] | undefined,
  blockedPackages: string[],
  alwaysAllowedPackages: string[],
  limits: Record<string, number>,
): InstalledApp[] {
  const byPackage = new Map<string, InstalledApp>();

  const add = (raw: AnyRecord | string) => {
    const packageName = typeof raw === 'string'
      ? raw
      : String(raw.packageName ?? raw.package ?? raw.appCatalog?.packageName ?? '');
    if (!packageName) return;
    const catalogEntry = CATALOG_BY_PACKAGE.get(packageName);
    const existing = byPackage.get(packageName);
    const rawIconUrl = typeof raw !== 'string' ? (raw.iconUrl ?? raw.appCatalog?.iconUrl) : undefined;
    const rawIconDomain = typeof raw !== 'string' ? (raw.iconDomain ?? raw.appCatalog?.iconDomain) : undefined;
    const rawCategory = typeof raw !== 'string' ? (raw.category ?? raw.appCatalog?.category) : undefined;
    const displayName = typeof raw === 'string'
      ? existing?.displayName ?? appDisplayName(packageName)
      : String(raw.displayName ?? raw.name ?? raw.appLabel ?? raw.appCatalog?.displayName ?? existing?.displayName ?? appDisplayName(packageName));

    byPackage.set(packageName, {
      packageName,
      displayName,
      iconUrl: rawIconUrl ?? existing?.iconUrl ?? undefined,
      iconDomain: rawIconDomain
        ?? existing?.iconDomain
        ?? catalogEntry?.iconDomain
        ?? undefined,
      iconColor: existing?.iconColor ?? catalogEntry?.iconColor ?? undefined,
      iconLetter: existing?.iconLetter ?? catalogEntry?.iconLetter ?? undefined,
      category: rawCategory
        ?? existing?.category
        ?? catalogEntry?.category
        ?? undefined,
      isBlocked: blockedPackages.includes(packageName),
      isAlwaysAllowed: alwaysAllowedPackages.includes(packageName),
      timeLimitMinutes: limits[packageName],
    });
  };

  (apiItems ?? []).forEach(add);
  (heartbeatItems ?? []).forEach((item) => add(item as AnyRecord | string));
  return [...byPackage.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

const TIME_LIMIT_OPTIONS = [
  { label: 'No limit', value: 0 },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
  { label: '4h', value: 240 },
];

/** Returns the value from the previous render. */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => { ref.current = value; });
  return ref.current;
}

/** 
 * Renders a square app icon using a 4-stage fallback chain:
 *   1. Play Store icon from playStoreIcons.json  (best quality, build-time)
 *   2. Explicit iconUrl from the API
 *   3. icon.horse with catalog iconDomain
 *   4. Coloured letter avatar                    (always works)
 */ 
function AppIcon({ 
  app, 
  size = 36, 
}: { 
  app: AnyRecord; 
  size?: number; 
}) { 
  const label = String(app.displayName ?? app.name ?? app.packageName ?? 'App');
  const packageName = String(app.packageName ?? '');

  // Build priority-ordered list of URLs to attempt
  const hasPlayStoreEntry = packageName
    ? Object.prototype.hasOwnProperty.call(PLAY_STORE_ICONS, packageName)
    : false;
  const playStoreEntry = hasPlayStoreEntry ? PLAY_STORE_ICONS[packageName] : null;
  const iconDomain = app.iconDomain ?? null;
  const skipNetworkFallbacks = hasPlayStoreEntry && playStoreEntry === null;

  const urlCandidates: string[] = skipNetworkFallbacks
    ? []
    : [
        playStoreEntry?.iconUrl ?? '',
        app.iconUrl ?? '',
        iconDomain ? `https://icon.horse/icon/${iconDomain}` : '',
      ].filter((u) => u.length > 0);

  const [urlIndex, setUrlIndex] = useState(0);

  // Reset when the app changes (different row re-uses the component)
  const stableKey = packageName;
  const prevKey = usePrevious(stableKey);
  useEffect(() => {
    if (prevKey !== undefined && prevKey !== stableKey) {
      setUrlIndex(0);
    }
  }, [prevKey, stableKey]);

  const currentUrl = urlCandidates[urlIndex] ?? null;
  const showLetterAvatar = currentUrl === null;

  const handleError = () => {
    if (urlIndex < urlCandidates.length - 1) {
      setUrlIndex((i) => i + 1);
    } else {
      // All URLs exhausted - force letter avatar by setting index past the end
      setUrlIndex(urlCandidates.length);
    }
  };
 
  return ( 
    <div 
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl" 
      style={{ width: size, height: size }} 
      data-icon-placeholder
    > 
      {!showLetterAvatar && currentUrl ? ( 
        <img 
          src={currentUrl} 
          alt={label} 
          width={size} 
          height={size} 
          className="h-full w-full rounded-xl object-cover" 
          onError={handleError} 
        /> 
      ) : ( 
        <div
          className="flex h-full w-full items-center justify-center rounded-xl"
          style={{ backgroundColor: app.iconColor ?? '#334155' }}
        >
          <span className="font-bold text-white" style={{ fontSize: size * 0.42 }}> 
            {String(app.iconLetter ?? label.slice(0, 1)).toUpperCase()} 
          </span> 
        </div>
      )} 
    </div> 
  ); 
} 

function AppRow({ 
  app, 
  isBlocked, 
  isAlwaysAllowed,
  isPending, 
  onToggle, 
  onAlwaysAllowedToggle,
}: {  
  app: AnyRecord;  
  isBlocked: boolean;  
  isAlwaysAllowed?: boolean;
  isPending: boolean;  
  onToggle: (blocked: boolean) => void;  
  onAlwaysAllowedToggle?: (allowed: boolean) => void;
}) {  
  const packageName = String(app.packageName ?? '');
  const displayName = String(app.displayName ?? app.name ?? packageName);
  const category = app.category ? String(app.category) : undefined;
  const timeLimitMinutes = Number(app.timeLimitMinutes ?? 0);
  return ( 
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5">
      <AppIcon app={app} size={36} /> 
      <div className="min-w-0 flex-1"> 
        <div className="text-sm font-medium text-slate-100">{displayName}</div> 
        <div className="truncate font-mono text-[10px] text-slate-500">{packageName}</div> 
      </div> 
      {category ? ( 
        <span className="hidden shrink-0 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 sm:inline-flex"> 
          {category} 
        </span> 
      ) : null}
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ 
        timeLimitMinutes ? 'bg-brand-500/10 text-brand-400' : 'bg-slate-700 text-slate-400' 
      }`}> 
        {minutesLabel(timeLimitMinutes)} 
      </span>
      {isAlwaysAllowed ? (
        <span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
          Essential
        </span>
      ) : isBlocked ? (
        <span className="shrink-0 rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-400"> 
          Blocked 
        </span> 
      ) : (
        <span className="shrink-0 rounded-full bg-accent-teal/10 px-2.5 py-1 text-xs font-semibold text-accent-teal">
          Allowed
        </span>
      )} 
      {onAlwaysAllowedToggle ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => onAlwaysAllowedToggle(!isAlwaysAllowed)}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
            isAlwaysAllowed
              ? 'border-amber-300/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'
              : 'border-white/10 text-slate-500 hover:border-amber-300/30 hover:text-amber-300'
          }`}
          title={isAlwaysAllowed ? 'Remove from always allowed' : 'Always allow'}
        >
          <Star className="h-4 w-4" />
        </button>
      ) : null}
      <button 
        type="button" 
        disabled={isPending || isAlwaysAllowed}
        onClick={() => onToggle(!isBlocked)} 
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${ 
          isAlwaysAllowed
            ? 'border border-white/10 text-slate-500'
            : isBlocked
            ? 'border border-accent-teal/20 text-accent-teal hover:bg-accent-teal/10' 
            : 'border border-rose-400/20 text-rose-400 hover:bg-rose-400/10' 
        }`} 
      > 
        {isAlwaysAllowed ? 'Allowed' : isBlocked ? 'Allow' : 'Block'}
      </button> 
    </div>
  );
}

export default function KidsControlCenter({
  profile,
  device,
  installation,
  onRequestRefresh,
}: {
  profile: AnyRecord;
  device: AnyRecord;
  installation: AnyRecord;
  onRequestRefresh?: () => void;
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
  const { data: auditEntries = [], refetch: refetchAudit } = useQuery<AnyRecord[]>({
    queryKey: ['app', installationId, 'audit'],
    queryFn: async () => {
      const response = await apiClient.get(`/apps/${installationId}/audit`);
      return Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
    },
    enabled: !!installationId,
    refetchInterval: 60_000,
  });

  const dailyLimitValue = entryValue(policy, 'kids.screen_time.daily_limit');
  const dailyLimitMinutes = Number(dailyLimitValue?.minutes ?? dailyLimitValue?.limitMinutes ?? 0);
  const [dailyLimitHours, setDailyLimitHours] = useState(Math.round(dailyLimitMinutes / 60));
  const [bedtimeEnabled, setBedtimeEnabled] = useState(Boolean(entryValue(policy, 'kids.bedtime')?.enabled ?? false));
  const [bedtimeDays, setBedtimeDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [bedtimeStart, setBedtimeStart] = useState({ hour: 21, minute: 0 });
  const [bedtimeWake, setBedtimeWake] = useState({ hour: 7, minute: 0 }); 
  const [blockedCategories, setBlockedCategories] = useState<Set<string>>(new Set()); 
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false); 
  const [newPackage, setNewPackage] = useState(''); 
  const [newEssentialPackage, setNewEssentialPackage] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>( 
    new Set(['Social Media', 'Games & Gaming']),
  );
  const [showCustomAppForm, setShowCustomAppForm] = useState(false);
  // Scheduled Blocks
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>([]);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlock, setNewBlock] = useState<Omit<ScheduledBlock, 'id'>>({ 
    name: '', 
    enabled: true, 
    startTime: '08:00',
    endTime: '15:00', 
    days: [1, 2, 3, 4, 5], 
  }); 
  const [perAppEditing, setPerAppEditing] = useState<string | null>(null);
  const [perAppDraft, setPerAppDraft] = useState('');
  const [newLimitPackage, setNewLimitPackage] = useState('');
  const [newLimitMinutes, setNewLimitMinutes] = useState(30);
  const { data: deviceApps = [], isError: installedAppsError } = useQuery<AnyRecord[]>({
    queryKey: ['device', device.id, 'installed-apps'],
    // TODO: replace with GET /devices/:deviceId/installed-apps once endpoint exists.
    queryFn: async () => (await apiClient.get(`/devices/${device.id}/apps`)).data,
    enabled: !!device.id,
    retry: false,
  });

  useEffect(() => {
    setDailyLimitHours(Math.round(dailyLimitMinutes / 60));
  }, [dailyLimitMinutes]);

  useEffect(() => {
    const bedtime = entryValue(policy, 'kids.bedtime');
    if (bedtime) {
      setBedtimeEnabled(Boolean(bedtime.enabled));
      if (Array.isArray(bedtime.days)) setBedtimeDays(bedtime.days);
      if (bedtime.startHour !== undefined) {
        setBedtimeStart({
          hour: Number(bedtime.startHour),
          minute: Number(bedtime.startMinute ?? 0),
        });
      }
      if (bedtime.endHour !== undefined) {
        setBedtimeWake({
          hour: Number(bedtime.endHour),
          minute: Number(bedtime.endMinute ?? 0),
        });
      }
    }
  }, [policy]);

  useEffect(() => {
    const webFilter = entryValue(policy, 'kids.web_filter');
    if (webFilter?.categories) {
      const blocked = new Set<string>();
      for (const [displayName, key] of Object.entries(WEB_CATEGORY_KEYS)) {
        if (webFilter.categories[key] === 'block') {
          blocked.add(displayName);
        }
      }
      setBlockedCategories(blocked);
    } else {
      setBlockedCategories(
        new Set(['Adult Content', 'Gambling', 'Drugs & Alcohol', 'Violence', 'Chat / Dating']),
      );
    }
  }, [policy]);

  useEffect(() => {
    const sb = entryValue(policy, 'kids.screen_time.scheduled_blocks');
    if (sb?.blocks && Array.isArray(sb.blocks)) {
      setScheduledBlocks(
        (sb.blocks as AnyRecord[])
          .filter((b) => typeof b.id === 'string' && typeof b.name === 'string')
          .map((b) => ({
            id: String(b.id),
            name: String(b.name),
            enabled: Boolean(b.enabled ?? true),
            startTime: String(b.startTime ?? '08:00'),
            endTime: String(b.endTime ?? '17:00'),
            days: Array.isArray(b.days) ? (b.days as number[]).map(Number) : [1, 2, 3, 4, 5],
          })),
      );
    } else {
      setScheduledBlocks([]);
    }
  }, [policy]);

  const bedtimeValue = (
    enabled = bedtimeEnabled,
    days = bedtimeDays,
    start = bedtimeStart,
    wake = bedtimeWake,
  ) => ({
    enabled,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: wake.hour,
    endMinute: wake.minute,
    days,
  });

  const patchPolicyMutation = useMutation({
    mutationFn: async (entry: { key: string; value: AnyRecord; strength?: string }) =>
      (await apiClient.patch(`/apps/${installationId}/policy`, {
        entries: [
          {
            key: entry.key,
            value: entry.value,
            strength: entry.strength ?? 'hard',
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
    onSuccess: () => {
      toast.success('Sync requested. Policy update will arrive within 30 minutes.');
      setTimeout(() => {
        refetchAudit();
        onRequestRefresh?.();
      }, 5_000);
    },
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to request sync');
    },
  });

  const lockMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post(`/devices/${device.id}/lockdown`, {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', installationId, 'effective-policy'] });
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      toast.success('Device locked.');
      setTimeout(() => onRequestRefresh?.(), 3_000);
    },
    onError: (error: AnyRecord) =>
      toast.error(error.response?.data?.message || 'Failed to lock device'),
  });

  const unlockMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post(`/devices/${device.id}/unlock`, {})).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app', installationId, 'effective-policy'] });
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      toast.success('Device unlocked.');
      setTimeout(() => onRequestRefresh?.(), 3_000);
    },
    onError: (error: AnyRecord) =>
      toast.error(error.response?.data?.message || 'Failed to unlock device'),
  });

  const pauseMutation = useMutation({ 
    mutationFn: async (command: 'UNLOCK' | 'LOCKDOWN') => 
      (await apiClient.post(`/devices/${device.id}/commands`, { command })).data, 
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['app', installationId, 'effective-policy'] }); 
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] }); 
      queryClient.invalidateQueries({ queryKey: ['device', device.id, 'installed-apps'] });
      toast.success('Device command sent.'); 
      setTimeout(() => onRequestRefresh?.(), 3_000);
    }, 
    onError: (error: AnyRecord) => 
      toast.error(error.response?.data?.message || 'Failed to update pause state'), 
  }); 

  const devicePolicyMutation = useMutation({
    mutationFn: async (entry: { key: string; value: AnyRecord; strength?: string }) =>
      (await apiClient.patch(`/devices/${device.id}/policy`, {
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
      toast.success('Device policy updated.');
    },
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to update device policy');
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post(`/devices/${device.id}/commands`, { command: 'INITIATE_UNINSTALL' })).data,
    onSuccess: () => {
      setShowUninstallConfirm(false);
      toast.success('Uninstall guide sent to child device.');
    },
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to start uninstall guide');
    },
  });

  const recentAlerts = useMemo<AnyRecord[]>(() => alerts.slice(0, 5), [alerts]);
  const perAppLimits = useMemo<Array<{ packageName: string; limitMinutes: number }>>(() => { 
    const limits = entryValue(policy, 'screen_time.per_app_limits') ?? entryValue(policy, 'kids.screen_time.per_app'); 
    if (!limits || typeof limits !== 'object') return [];
    return Object.entries(limits).map(([packageName, limitMinutes]) => ({
      packageName,
      limitMinutes: Number(limitMinutes ?? 0),
    }));
  }, [policy]);
  const remoteLockValue = entryValue(policy, 'kids.remote_lock');
  const remoteLockActive = Boolean(
    remoteLockValue?.enabled ?? remoteLockValue?.locked ?? device.lockdownActive,
  );
  const usageSummaries = useMemo(() => parseUsageSummaries(auditEntries), [auditEntries]);
  const blockedEvents = useMemo(() => parseBlockedEvents(auditEntries), [auditEntries]);
  const latestHeartbeat = useMemo(() => parseLatestHeartbeat(auditEntries), [auditEntries]);
  const latestDevicePermissions = useMemo(
    () => normalizePermissions(
      device.appVersions?.guardhubKids?.permissions ??
        device.appVersions?.permissions ??
        device.latestPermissions,
    ),
    [device.appVersions, device.latestPermissions],
  );

  useEffect(() => {
    console.log('[KidsControlCenter] device object:', {
      id: device.id,
      adminActive: device.adminActive,
      protectionActive: device.protectionActive,
      lockdownActive: device.lockdownActive,
      effectiveRemoteLockActive: remoteLockActive,
      lastSeen: device.lastSeen,
    });
    console.log('[KidsControlCenter] latestHeartbeat:', latestHeartbeat);
    console.log('[KidsControlCenter] auditEntries count:', auditEntries.length);
    console.log(
      '[KidsControlCenter] kids.heartbeat count:',
      auditEntries.filter((entry) => entry.action === 'kids.heartbeat').length,
    );
  }, [device, latestHeartbeat, auditEntries, remoteLockActive]);

  const latestLocation = normalizeLocation(device.latestLocation) ?? latestHeartbeat?.location ?? null;
  const weeklyBars = useMemo(
    () => buildWeeklyUsageBars(usageSummaries, dailyLimitMinutes),
    [usageSummaries, dailyLimitMinutes],
  );
  const topAppsByUsage = useMemo(
    () => buildTopAppsByUsage(usageSummaries),
    [usageSummaries],
  );
  const todayBlocked = useMemo(() => {
    const today = todayDateKey();
    return blockedEvents.filter((event) => {
      const date = new Date(event.occurredAtEpochMillis);
      return date.toISOString().slice(0, 10) === today;
    });
  }, [blockedEvents]);
  const topAppsToday = useMemo(() => {
    const today = todayDateKey();
    const todaySummaries = usageSummaries.filter((summary) => summary.dateKey === today);

    const byPackage = new Map<string, number>();
    for (const summary of todaySummaries) {
      byPackage.set(summary.packageName, (byPackage.get(summary.packageName) ?? 0) + summary.usageSeconds);
    }

    const sorted = [...byPackage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (sorted.length === 0) return [];

    const maxSeconds = sorted[0][1];
    return sorted.map(([packageName, totalSeconds]) => ({
      packageName,
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      percent: Math.round((totalSeconds / maxSeconds) * 100),
    }));
  }, [usageSummaries]);
  const recentBlocks = useMemo(() => blockedEvents.slice(0, 8), [blockedEvents]);
  const weeklyBlockCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return blockedEvents.filter((event) => event.occurredAtEpochMillis >= sevenDaysAgo).length;
  }, [blockedEvents]);
  const weeklyTotalUsageMinutes = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().slice(0, 10);
    return Math.round(
      usageSummaries
        .filter((summary) => summary.dateKey >= cutoff)
        .reduce((sum, summary) => sum + summary.usageSeconds, 0) / 60,
    );
  }, [usageSummaries]);
  const blockedPackages = useMemo<string[]>(() => {  
    const blocklist = entryValue(policy, 'kids.blocklist');  
    return Array.isArray(blocklist?.packages) ? blocklist.packages : [];  
  }, [policy]);  
  const alwaysAllowedPackages = useMemo<string[]>(() => {
    const alwaysAllowed = entryValue(policy, 'kids.always_allowed_apps');
    return Array.isArray(alwaysAllowed?.packages) ? alwaysAllowed.packages : [];
  }, [policy]);
  const perAppLimitMap = useMemo<Record<string, number>>(() => { 
    const raw = entryValue(policy, 'screen_time.per_app_limits') ?? entryValue(policy, 'kids.screen_time.per_app');
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([key, value]) => [key, Number(value)]),
    );
  }, [policy]);
  const installedApps = useMemo(
    () => normalizeInstalledApps(
      deviceApps, 
      latestHeartbeat?.installedPackages, 
      blockedPackages, 
      alwaysAllowedPackages,
      perAppLimitMap, 
    ), 
    [deviceApps, latestHeartbeat, blockedPackages, alwaysAllowedPackages, perAppLimitMap],
  ); 
  const filteredInstalledApps = useMemo(() => { 
    const q = search.trim().toLowerCase(); 
    if (!q) return installedApps; 
    return installedApps.filter((app) => 
      app.displayName.toLowerCase().includes(q) || 
      app.packageName.toLowerCase().includes(q), 
    ); 
  }, [installedApps, search]); 
  const alwaysAllowedAppRows = useMemo<InstalledApp[]>(() => (
    alwaysAllowedPackages
      .map((packageName) => {
        const installed = installedApps.find((app) => app.packageName === packageName);
        if (installed) return installed;
        const catalogEntry = CATALOG_BY_PACKAGE.get(packageName);
        return {
          packageName,
          displayName: catalogEntry?.name ?? appDisplayName(packageName),
          iconDomain: catalogEntry?.iconDomain,
          iconColor: catalogEntry?.iconColor,
          iconLetter: catalogEntry?.iconLetter,
          category: catalogEntry?.category,
          isBlocked: blockedPackages.includes(packageName),
          isAlwaysAllowed: true,
          timeLimitMinutes: perAppLimitMap[packageName],
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  ), [alwaysAllowedPackages, blockedPackages, installedApps, perAppLimitMap]);
  const usageMinutes = useMemo(() => { 
    const today = todayDateKey();
    const todaySeconds = usageSummaries
      .filter((summary) => summary.dateKey === today)
      .reduce((sum, summary) => sum + summary.usageSeconds, 0);
    const fallback = Number(activity?.today?.usedMinutes ?? activity?.usedMinutesToday ?? 0);
    const fromAudit = Math.round(todaySeconds / 60);
    return fromAudit > 0 ? fromAudit : fallback;
  }, [usageSummaries, activity]);
  const usagePercent = dailyLimitMinutes > 0 ? Math.min(100, Math.round((usageMinutes / dailyLimitMinutes) * 100)) : 0;
  const todayStats = useMemo(() => {
    const today = todayDateKey();
    const todaySummaries = usageSummaries.filter((summary) => summary.dateKey === today);
    const uniquePackagesToday = new Set(todaySummaries.map((summary) => summary.packageName));

    return { 
      screenTimeToday: usageLabel(usageMinutes),
      appsOpened: uniquePackagesToday.size, 
      appsBlocked: todayBlocked.length, 
      sitesBlocked: 0,
      alertsToday: alerts.filter((alert: AnyRecord) => {
        const date = new Date(alert.sentAt || alert.createdAt || 0);
        return date.toISOString().slice(0, 10) === today;
      }).length,
    };
  }, [usageSummaries, usageMinutes, todayBlocked, alerts]); 
  const deviceHealthItems = useMemo<DeviceHealthItem[]>(() => {
    // Primary source: device fields written directly by heartbeat. Fallback to
    // audit heartbeat permissions when those entries are linked to this app.
    const permissions = latestDevicePermissions ?? latestHeartbeat?.permissions ?? null;
    const adminActive =
      device.adminActive === true ||
      permissions?.deviceAdmin === true;

    const usageAccess =
      permissions?.usageAccess === true;

    const accessibility =
      permissions?.accessibilityFallback === true;

    const batteryExempt =
      permissions?.batteryOptimizationIgnored === true;

    const locationPermission =
      permissions?.location === true ||
      permissions?.backgroundLocation === true;

    return [
      { label: 'Device Admin', active: adminActive, Icon: ShieldCheck },
      { label: 'Usage Access', active: usageAccess, Icon: Activity },
      { label: 'Accessibility', active: accessibility, Icon: Accessibility },
      { label: 'Battery exempt', active: batteryExempt, Icon: Battery },
      { label: 'Location', active: locationPermission || Boolean(latestLocation), Icon: MapPin },
    ];
  }, [device.adminActive, latestDevicePermissions, latestHeartbeat, latestLocation]);
  useEffect(() => {
    const permissions = latestDevicePermissions ?? latestHeartbeat?.permissions ?? null;
    console.log('[GuardHubPermDebug] dashboard permission health inputs', {
      deviceId: device.id,
      deviceLastSeen: device.lastSeen,
      rawDeviceGuardHubKidsPermissions: device.appVersions?.guardhubKids?.permissions ?? null,
      rawDevicePermissions: device.appVersions?.permissions ?? device.latestPermissions ?? null,
      normalizedDevicePermissions: latestDevicePermissions,
      latestHeartbeatReceivedAt: latestHeartbeat?.receivedAt ?? null,
      latestHeartbeatPermissions: latestHeartbeat?.permissions ?? null,
      selectedPermissions: permissions,
      latestLocation,
      computedHealthItems: deviceHealthItems.map(({ label, active }) => ({ label, active })),
    });
  }, [device, latestDevicePermissions, latestHeartbeat, latestLocation, deviceHealthItems]);
  const hasRecentHeartbeat = !!device.lastSeen &&
    (Date.now() - new Date(device.lastSeen).getTime()) < 10 * 60 * 1000;
  const deviceAdminConfirmedInactive =
    (hasRecentHeartbeat && device.adminActive === false) ||
    latestHeartbeat?.permissions?.deviceAdmin === false;

  const patchBlocklist = (packages: string[]) => { 
    patchPolicyMutation.mutate({ 
      key: 'kids.blocklist', 
      value: { packages }, 
      strength: 'hard', 
    }); 
  }; 

  const patchAlwaysAllowedApps = (packages: string[]) => {
    const normalizedPackages = Array.from(
      new Set(packages.map((pkg) => pkg.trim()).filter(Boolean)),
    );
    patchPolicyMutation.mutate({
      key: 'kids.always_allowed_apps',
      value: { packages: normalizedPackages },
      strength: 'hard',
    });
  };

  const patchPerAppLimits = (next: Record<string, number>) => { 
    patchPolicyMutation.mutate({ 
      key: 'screen_time.per_app_limits', 
      value: next, 
    }); 
  }; 

  const patchScheduledBlocks = (blocks: ScheduledBlock[]) => {
    patchPolicyMutation.mutate({
      key: 'kids.screen_time.scheduled_blocks',
      value: { blocks },
      strength: 'hard',
    });
  };

  const currentPerAppMap = (): Record<string, number> => { 
    return { ...perAppLimitMap }; 
  }; 

  const setPerAppLimit = (packageName: string, minutes: number) => {
    const map = currentPerAppMap();
    if (minutes > 0) {
      patchPerAppLimits({ ...map, [packageName]: minutes });
      return;
    }
    const { [packageName]: _removed, ...rest } = map;
    patchPerAppLimits(rest);
  };

  const addPerAppLimit = () => {
    if (!newLimitPackage.trim()) return;
    const map = currentPerAppMap();
    if (newLimitPackage in map) return;
    patchPerAppLimits({ ...map, [newLimitPackage.trim()]: newLimitMinutes });
    setNewLimitPackage('');
    setNewLimitMinutes(30);
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
              <p className="mt-1 flex items-center gap-2 text-xs">
                {remoteLockActive ? (
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-400" />
                    Locked
                  </span>
                ) : device.lastSeen ? (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                    Online · Last seen {new Date(device.lastSeen).toLocaleString()}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                    Not yet seen
                  </span>
                )}
                {device.adminActive && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-400">
                    Admin active
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button 
              type="button" 
              onClick={() => pauseMutation.mutate(remoteLockActive ? 'LOCKDOWN' : 'UNLOCK')} 
              disabled={pauseMutation.isPending} 
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/60 disabled:opacity-50" 
            > 
              <Pause className="h-4 w-4" /> 
              {remoteLockActive ? 'Resume' : 'Pause'} 
            </button> 
            {remoteLockActive ? (
              <button
                type="button"
                onClick={() => unlockMutation.mutate()}
                disabled={unlockMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-accent-teal/30 bg-accent-teal/10 px-3 py-2 text-sm font-medium text-accent-teal hover:bg-accent-teal/20 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                Unlock
              </button>
            ) : (
              <button
                type="button"
                onClick={() => lockMutation.mutate()}
                disabled={lockMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-400/20 disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                Lock Now
              </button>
            )}
            <button 
              type="button" 
              onClick={() => syncMutation.mutate()} 
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-500/20 px-3 py-2 text-sm font-medium text-brand-400 hover:bg-brand-500/10 disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" /> 
              Sync 
            </button> 
            <button
              type="button"
              onClick={() => setShowUninstallConfirm(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-400/10"
            >
              Uninstall App
            </button>
          </div> 
        </div> 
      </section> 

      {showUninstallConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-100">Uninstall GuardHUB Kids?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This will guide your child through removing GuardHUB Kids from their device. They will need to follow the steps shown on their phone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUninstallConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={uninstallMutation.isPending}
                onClick={() => uninstallMutation.mutate()}
                className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-40"
              >
                Send guide
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <span className="text-brand-400">
                {`${usageLabel(usageMinutes)} used${dailyLimitMinutes > 0 ? ` / ${minutesLabel(dailyLimitMinutes)} limit` : ' · No limit set'}`}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"> 
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${usagePercent}%` }} /> 
            </div> 
            {usageSummaries.length === 0 ? ( 
              <p className="mt-3 text-xs text-amber-400"> 
                ⚠ No usage data received yet. Ensure the child device is online and the GuardHUB Kids app has Usage Access permission granted. 
              </p> 
            ) : null} 
          </section> 
          <section className="glass-panel p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-teal/10 text-accent-teal">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Live location</h3>
                  {latestLocation ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatCoordinate(latestLocation.latitude)}, {formatCoordinate(latestLocation.longitude)} .{' '}
                      {formatAccuracy(latestLocation.accuracyMeters)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Waiting for location from the child device.</p>
                  )}
                </div>
              </div>
              {latestLocation ? (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    {latestLocation.capturedAtEpochMillis
                      ? new Date(latestLocation.capturedAtEpochMillis).toLocaleString()
                      : 'Time unknown'}
                  </span>
                  <a
                    href={mapsUrl(latestLocation)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-accent-teal/30 px-3 py-2 font-medium text-accent-teal hover:bg-accent-teal/10"
                  >
                    Open map
                  </a>
                </div>
              ) : null}
            </div>
          </section>
          <section className="glass-panel p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Device protection status</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {deviceHealthItems.map(({ label, active, Icon }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center ${
                    active
                      ? 'border-accent-teal/20 bg-accent-teal/5'
                      : 'border-rose-400/20 bg-rose-400/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-accent-teal' : 'text-rose-400'}`} />
                  <span className={`text-[10px] font-semibold ${active ? 'text-accent-teal' : 'text-rose-400'}`}>
                    {active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[10px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>
            {latestHeartbeat ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                {latestHeartbeat.policyVersion !== null && (
                  <span>Policy v{latestHeartbeat.policyVersion}</span>
                )}
                {latestHeartbeat.batteryLevelPercent !== null && (
                  <span>Battery {latestHeartbeat.batteryLevelPercent}%</span>
                )}
                {latestHeartbeat.managementMode && (
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-brand-400">
                    {latestHeartbeat.managementMode === 'device_admin' ? 'Device Admin' : 'Basic mode'}
                  </span>
                )}
                <span className="ml-auto">Last seen {new Date(latestHeartbeat.receivedAt).toLocaleString()}</span>
              </div>
            ) : device.lastSeen ? (
              <div className="mt-3 text-xs">
                {deviceHealthItems.some((h) => !h.active) ? (
                  <p className="text-amber-400">
                    ⚠ Some permissions need to be granted on the child's device.
                    Open GuardHUB Kids → tap Permissions to enable them.
                  </p>
                ) : (
                  <p className="text-slate-500">
                    Device is protected · Last seen {new Date(device.lastSeen).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Waiting for first heartbeat. The device reports every 5 minutes.
              </p>
            )}
          </section>
          {deviceAdminConfirmedInactive ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-400">
              Device Admin is not active. Remote lock and bedtime enforcement are unavailable
              until the child re-enables it on their device.
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[ 
              ['Screen Time Today', todayStats.screenTimeToday, 'text-brand-400'],
              ['Apps Opened', todayStats.appsOpened, 'text-accent-teal'], 
              ['Apps Blocked', todayStats.appsBlocked, 'text-rose-400'], 
              ['Sites Blocked', todayStats.sitesBlocked, 'text-rose-400'], 
              ['Alerts Today', todayStats.alertsToday, 'text-amber-400'],
            ].map(([label, value, colour]) => (
              <div key={String(label)} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                <div className={`text-xl font-bold ${colour}`}>{value}</div>
                <div className="mt-1 text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <section className="glass-panel p-5">
            <h3 className="text-sm font-semibold text-slate-100">Recent blocks today</h3>
            <div className="mt-3 space-y-2">
              {todayBlocked.length > 0 ? (
                todayBlocked.slice(0, 5).map((event, index) => (
                  <div
                    key={`${event.packageName}-${event.occurredAtEpochMillis}-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-rose-400/10 bg-rose-400/5 px-3 py-2"
                  >
                    <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                      {blockReasonLabel(event.reason)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                      {event.packageName}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {new Date(event.occurredAtEpochMillis).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No blocks recorded today.</p>
              )}
            </div>
          </section>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="glass-panel p-5">
              <h3 className="text-sm font-semibold text-slate-100">Top Apps Today</h3>
              <div className="mt-4 space-y-3">
                {topAppsToday.length ? (
                  topAppsToday.map((app) => (
                    <div key={app.packageName} className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 shrink-0 text-brand-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-sm text-slate-200">
                          {app.packageName}
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-brand-400/70"
                            style={{ width: `${app.percent}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {minutesLabel(app.totalMinutes)}
                      </span>
                    </div>
                  ))
                ) : (
                  <EmptyState>No usage recorded today.</EmptyState>
                )}
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
            {(() => {
              const commitLimit = () =>
                patchPolicyMutation.mutate({
                  key: 'kids.screen_time.daily_limit',
                  value: { enabled: dailyLimitHours > 0, minutes: dailyLimitHours * 60 },
                });
              return (
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={dailyLimitHours}
                  onChange={(event) => setDailyLimitHours(Number(event.target.value))}
                  onPointerUp={commitLimit}
                  onMouseUp={commitLimit}
                  className="mt-5 w-full accent-brand-500"
                />
              );
            })()}
          </section>
          <section className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Scheduled Blocks</h3>
              <button
                type="button"
                onClick={() => setShowAddBlock((v) => !v)}
                className="rounded-lg border border-brand-500/20 px-3 py-1.5 text-xs text-brand-400 hover:bg-brand-500/10"
              >
                {showAddBlock ? 'Cancel' : '+ Add Schedule'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Lock the device during specific time windows.</p>

            <div className="mt-4 space-y-2">
              {scheduledBlocks.length ? (
                scheduledBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
                      block.enabled ? 'border-brand-500/20 bg-brand-500/5' : 'border-white/10 bg-slate-900/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-100">{block.name}</span>
                        {!block.enabled && (
                          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">Off</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {block.startTime} – {block.endTime} ·{' '}
                        {block.days.length === 7
                          ? 'Every day'
                          : block.days.map((d) => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}
                      </div>
                    </div>
                    <Toggle
                      checked={block.enabled}
                      disabled={patchPolicyMutation.isPending}
                      onChange={(enabled) => {
                        const next = scheduledBlocks.map((b) =>
                          b.id === block.id ? { ...b, enabled } : b,
                        );
                        setScheduledBlocks(next);
                        patchScheduledBlocks(next);
                      }}
                    />
                    <button
                      type="button"
                      disabled={patchPolicyMutation.isPending}
                      onClick={() => {
                        const next = scheduledBlocks.filter((b) => b.id !== block.id);
                        setScheduledBlocks(next);
                        patchScheduledBlocks(next);
                      }}
                      className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-rose-400/10 hover:text-rose-400 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState>No scheduled blocks. Tap "+ Add Schedule" to create one.</EmptyState>
              )}
            </div>

            {showAddBlock ? (
              <div className="mt-4 rounded-xl border border-brand-500/20 bg-slate-900/60 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-100">New schedule</h4>
                <div className="space-y-3">
                  <input
                    value={newBlock.name}
                    onChange={(e) => setNewBlock((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Block name (e.g. School Hours)"
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-xs text-slate-500">Start</label>
                      <input
                        type="time"
                        value={newBlock.startTime}
                        onChange={(e) => setNewBlock((p) => ({ ...p, startTime: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
                      />
                    </div>
                    <span className="mt-4 text-slate-500">–</span>
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-xs text-slate-500">End</label>
                      <input
                        type="time"
                        value={newBlock.endTime}
                        onChange={(e) => setNewBlock((p) => ({ ...p, endTime: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-500">Days</label>
                    <div className="flex gap-1.5">
                      {['S','M','T','W','T','F','S'].map((label, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setNewBlock((p) => ({
                              ...p,
                              days: p.days.includes(i)
                                ? p.days.filter((d) => d !== i)
                                : [...p.days, i].sort((a, b) => a - b),
                            }))
                          }
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                            newBlock.days.includes(i)
                              ? 'border border-brand-500 bg-brand-600 text-white'
                              : 'border border-white/10 text-slate-500'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddBlock(false);
                        setNewBlock({ name: '', enabled: true, startTime: '08:00', endTime: '15:00', days: [1,2,3,4,5] });
                      }}
                      className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!newBlock.name.trim() || newBlock.days.length === 0 || patchPolicyMutation.isPending}
                      onClick={() => {
                        const block: ScheduledBlock = {
                          id: `block-${Date.now()}`,
                          ...newBlock,
                          name: newBlock.name.trim(),
                        };
                        const next = [...scheduledBlocks, block];
                        setScheduledBlocks(next);
                        patchScheduledBlocks(next);
                        setShowAddBlock(false);
                        setNewBlock({ name: '', enabled: true, startTime: '08:00', endTime: '15:00', days: [1,2,3,4,5] });
                      }}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
          <section className="glass-panel p-5 lg:col-span-2"> 
            <h3 className="text-sm font-semibold text-slate-100">Per-App Time Limits</h3> 
            <p className="mt-1 text-xs text-slate-500">Set a daily time cap for individual apps. Leave blank for no limit.</p> 

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
              {installedApps.length ? installedApps.map((app) => (
                <div key={app.packageName} className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5">
                  <AppIcon app={app} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100">{app.displayName}</div>
                    <div className="truncate font-mono text-[10px] text-slate-500">{app.packageName}</div>
                  </div>
                  {app.category ? (
                    <span className="hidden rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300 sm:inline-flex">
                      {app.category}
                    </span>
                  ) : null}
                  <select
                    value={perAppLimitMap[app.packageName] ?? 0}
                    disabled={patchPolicyMutation.isPending}
                    onChange={(event) => setPerAppLimit(app.packageName, Number(event.target.value))}
                    className={`rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold outline-none ${
                      perAppLimitMap[app.packageName] ? 'bg-brand-500/10 text-brand-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {TIME_LIMIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )) : (
                <EmptyState>No apps found. Make sure the child device is online and has synced recently.</EmptyState>
              )}
            </div>

            {false && (<>{perAppLimits.length > 0 ? ( 
              <div className="mt-4 space-y-2">
                {perAppLimits.map((app) => {
                  const isEditing = perAppEditing === app.packageName;
                  return (
                    <div
                      key={app.packageName}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5"
                    >
                      <Smartphone className="h-4 w-4 shrink-0 text-brand-400" />
                      <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-200">
                        {app.packageName}
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="number"
                            min={1}
                            max={720}
                            value={perAppDraft}
                            onChange={(e) => setPerAppDraft(e.target.value)}
                            onBlur={() => {
                              const m = Math.max(1, parseInt(perAppDraft, 10) || 1);
                              patchPerAppLimits({ ...currentPerAppMap(), [app.packageName]: m });
                              setPerAppEditing(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const m = Math.max(1, parseInt(perAppDraft, 10) || 1);
                                patchPerAppLimits({ ...currentPerAppMap(), [app.packageName]: m });
                                setPerAppEditing(null);
                              }
                              if (e.key === 'Escape') setPerAppEditing(null);
                            }}
                            className="w-16 rounded-md border border-brand-500 bg-slate-900 px-2 py-1 text-center text-sm text-slate-100 outline-none"
                          />
                          <span className="text-xs text-slate-500">min</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPerAppEditing(app.packageName);
                            setPerAppDraft(String(app.limitMinutes));
                          }}
                          disabled={patchPolicyMutation.isPending}
                          className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 disabled:opacity-40"
                        >
                          {minutesLabel(app.limitMinutes)}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const { [app.packageName]: _removed, ...rest } = currentPerAppMap();
                          patchPerAppLimits(rest);
                        }}
                        disabled={patchPolicyMutation.isPending}
                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-rose-400/10 hover:text-rose-400 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">
                No per-app limits yet. Add one below.
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={newLimitPackage}
                onChange={(e) => setNewLimitPackage(e.target.value.trim())}
                onKeyDown={(e) => { if (e.key === 'Enter') addPerAppLimit(); }}
                placeholder="com.example.app"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-brand-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={newLimitMinutes}
                  onChange={(e) => setNewLimitMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-20 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-center text-sm text-slate-100 outline-none focus:border-brand-500"
                />
                <span className="text-xs text-slate-500">min/day</span>
              </div>
              <button
                type="button"
                disabled={!newLimitPackage.trim() || patchPolicyMutation.isPending}
                onClick={addPerAppLimit}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500"> 
              Example: <span className="font-mono text-slate-400">com.tiktok.android</span> 
            </p> 
            </>)} 
          </section> 
        </div>
      ) : null}

      {activeTab === 'apps' ? ( 
        <div className="space-y-4"> 
          <section className="glass-panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Star className="h-4 w-4 text-amber-300" />
                  Always allowed apps
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Essential apps stay available during locks, schedules, app blocks, and time limits.
                </p>
              </div>
              <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                {alwaysAllowedPackages.length} selected
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {alwaysAllowedAppRows.length ? alwaysAllowedAppRows.map((app) => (
                <div
                  key={app.packageName}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5"
                >
                  <AppIcon app={app} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-100">{app.displayName}</div>
                    <div className="truncate font-mono text-[10px] text-slate-500">{app.packageName}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                    Essential
                  </span>
                  <button
                    type="button"
                    disabled={patchPolicyMutation.isPending}
                    onClick={() => patchAlwaysAllowedApps(alwaysAllowedPackages.filter((pkg) => pkg !== app.packageName))}
                    className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-rose-400/10 hover:text-rose-400 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )) : (
                <EmptyState>No essential apps selected.</EmptyState>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={newEssentialPackage}
                onChange={(event) => setNewEssentialPackage(event.target.value.trim())}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    newEssentialPackage &&
                    !alwaysAllowedPackages.includes(newEssentialPackage)
                  ) {
                    patchAlwaysAllowedApps([...alwaysAllowedPackages, newEssentialPackage]);
                    setNewEssentialPackage('');
                  }
                }}
                placeholder="com.example.essential"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-brand-500"
              />
              <button
                type="button"
                disabled={
                  !newEssentialPackage ||
                  alwaysAllowedPackages.includes(newEssentialPackage) ||
                  patchPolicyMutation.isPending
                }
                onClick={() => {
                  if (newEssentialPackage && !alwaysAllowedPackages.includes(newEssentialPackage)) {
                    patchAlwaysAllowedApps([...alwaysAllowedPackages, newEssentialPackage]);
                    setNewEssentialPackage('');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
              >
                <Star className="h-4 w-4" />
                Allow
              </button>
            </div>
          </section>
 
          {/* Search */} 
          <div className="relative"> 
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps by name or package..."
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-9 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>

          <section className="glass-panel p-4">
            {filteredInstalledApps.length > 0 ? (
              <div className="space-y-2">
                {filteredInstalledApps.map((app) => (
                  <AppRow 
                    key={app.packageName} 
                    app={app} 
                    isBlocked={blockedPackages.includes(app.packageName)} 
                    isAlwaysAllowed={alwaysAllowedPackages.includes(app.packageName)}
                    isPending={patchPolicyMutation.isPending} 
                    onAlwaysAllowedToggle={(shouldAllow) => {
                      if (shouldAllow) {
                        patchAlwaysAllowedApps([...alwaysAllowedPackages, app.packageName]);
                      } else {
                        patchAlwaysAllowedApps(alwaysAllowedPackages.filter((pkg) => pkg !== app.packageName));
                      }
                    }}
                    onToggle={(shouldBlock) => { 
                      if (shouldBlock) { 
                        patchBlocklist([...blockedPackages, app.packageName]); 
                      } else {
                        patchBlocklist(blockedPackages.filter((p) => p !== app.packageName));
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState>No apps found. Make sure the child device is online and has synced recently.</EmptyState>
            )}
            {installedAppsError ? (
              <p className="mt-3 text-xs text-amber-400">No installed-app endpoint data received; showing the latest heartbeat data when available.</p>
            ) : null}
          </section>

          {false && (search.trim() ? (
            /* ── Search results ───────────────────────────────────────────── */
            <section className="glass-panel p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Search results
              </h3>
              {searchApps(search).length > 0 ? (
                <div className="space-y-2">
                  {searchApps(search).map((app) => (
                    <AppRow
                      key={app.packageName}
                      app={app}
                      isBlocked={blockedPackages.includes(app.packageName)}
                      isPending={patchPolicyMutation.isPending}
                      onToggle={(shouldBlock) => {
                        if (shouldBlock) {
                          patchBlocklist([...blockedPackages, app.packageName]);
                        } else {
                          patchBlocklist(blockedPackages.filter((p) => p !== app.packageName));
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-slate-500">
                  No apps match "{search}"
                </p>
              )}
            </section>
          ) : (
            <>
              {/* ── Popular apps ──────────────────────────────────────────── */}
              <section className="glass-panel p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span>🔥</span> Most Frequently Restricted
                </h3>
                <div className="space-y-2">
                  {POPULAR_APPS.map((app) => (
                    <AppRow
                      key={app.packageName}
                      app={app}
                      isBlocked={blockedPackages.includes(app.packageName)}
                      isPending={patchPolicyMutation.isPending}
                      onToggle={(shouldBlock) => {
                        if (shouldBlock) {
                          patchBlocklist([...blockedPackages, app.packageName]);
                        } else {
                          patchBlocklist(blockedPackages.filter((p) => p !== app.packageName));
                        }
                      }}
                    />
                  ))}
                </div>
              </section>

              {/* ── Category groups ───────────────────────────────────────── */}
              {APP_CATEGORIES.map((category) => {
                const apps = getAppsByCategory()[category];
                const blockedInCategory = apps.filter((a) => blockedPackages.includes(a.packageName)).length;
                const isExpanded = expandedCategories.has(category);

                return (
                  <section key={category} className="glass-panel overflow-hidden">
                    {/* Category header — click to expand/collapse */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCategories((prev) => {
                          const next = new Set(prev);
                          if (next.has(category)) next.delete(category);
                          else next.add(category);
                          return next;
                        });
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5"
                    >
                      <span className="text-base">{CATEGORY_EMOJI[category]}</span>
                      <span className="flex-1 text-sm font-semibold text-slate-100">{category}</span>
                      {blockedInCategory > 0 && (
                        <span className="rounded-full bg-rose-400/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                          {blockedInCategory} blocked
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Category app list */}
                    {isExpanded && (
                      <div className="space-y-px border-t border-white/5 px-4 pb-4 pt-2">
                        <div className="space-y-2">
                          {apps.map((app) => (
                            <AppRow
                              key={app.packageName}
                              app={app}
                              isBlocked={blockedPackages.includes(app.packageName)}
                              isPending={patchPolicyMutation.isPending}
                              onToggle={(shouldBlock) => {
                                if (shouldBlock) {
                                  patchBlocklist([...blockedPackages, app.packageName]);
                                } else {
                                  patchBlocklist(blockedPackages.filter((p) => p !== app.packageName));
                                }
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}

              {/* ── Custom app (power user fallback) ─────────────────────── */}
              <section className="glass-panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCustomAppForm((v) => !v)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5"
                >
                  <span className="text-base">📦</span>
                  <span className="flex-1 text-sm font-semibold text-slate-100">Custom app</span>
                  <span className="text-xs text-slate-500">
                    {showCustomAppForm ? 'Close ▲' : 'Add by package name ▼'}
                  </span>
                </button>
                {showCustomAppForm && (
                  <div className="border-t border-white/5 px-4 pb-4 pt-3">
                    <p className="mb-3 text-xs text-slate-500">
                      Can't find an app above? Enter its Android package name.
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={newPackage}
                        onChange={(e) => setNewPackage(e.target.value.trim())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newPackage && !blockedPackages.includes(newPackage)) {
                            patchBlocklist([...blockedPackages, newPackage]);
                            setNewPackage('');
                          }
                        }}
                        placeholder="com.example.app"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-brand-500"
                      />
                      <button
                        type="button"
                        disabled={!newPackage || blockedPackages.includes(newPackage) || patchPolicyMutation.isPending}
                        onClick={() => {
                          if (newPackage && !blockedPackages.includes(newPackage)) {
                            patchBlocklist([...blockedPackages, newPackage]);
                            setNewPackage('');
                          }
                        }}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
                      >
                        Block
                      </button>
                    </div>
                    {/* Show custom-added packages (not in catalog) */}
                    {blockedPackages
                      .filter((pkg) => !APP_CATALOG.some((a) => a.packageName === pkg))
                      .map((pkg) => (
                        <div
                          key={pkg}
                          className="mt-2 flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5"
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-xs font-bold text-slate-300"
                          >
                            📦
                          </div>
                          <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-300">
                            {pkg}
                          </span>
                          <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-400">
                            Blocked
                          </span>
                          <button
                            type="button"
                            disabled={patchPolicyMutation.isPending}
                            onClick={() => patchBlocklist(blockedPackages.filter((p) => p !== pkg))}
                            className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-rose-400/10 hover:text-rose-400 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            </>
          ))}
        </div>
      ) : null}

      {activeTab === 'web-filter' ? (
        <div className="space-y-4">
          <section className="glass-panel space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Safe Search (Google/Bing)</h3>
                <p className="mt-1 text-xs text-slate-500">Enforce safer search defaults where managed apps support it.</p>
              </div>
              <Toggle
                checked={Boolean(entryValue(policy, 'kids.web_filter')?.safe_search?.enabled)}
                disabled={devicePolicyMutation.isPending}
                onChange={(enabled) => {
                  const current = entryValue(policy, 'kids.web_filter') ?? {};
                  devicePolicyMutation.mutate({
                    key: 'kids.web_filter',
                    value: { ...current, safe_search: { ...(current.safe_search ?? {}), enabled } },
                    strength: 'soft',
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Age Rating Cap</h3>
                <p className="mt-1 text-xs text-slate-500">Block app launches above the selected content rating.</p>
              </div>
              <select
                value={String(entryValue(policy, 'kids.content')?.age_rating_max ?? 'no_limit')}
                disabled={devicePolicyMutation.isPending}
                onChange={(event) => {
                  devicePolicyMutation.mutate({
                    key: 'kids.content',
                    value: { age_rating_max: event.target.value },
                    strength: 'soft',
                  });
                }}
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
              >
                {['G', 'PG', 'PG-13', 'R'].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
                <option value="no_limit">No limit</option>
              </select>
            </div>
          </section>
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
                  const categories: Record<string, 'block' | 'allow'> = {};
                  for (const [displayName, key] of Object.entries(WEB_CATEGORY_KEYS)) {
                    categories[key] = next.has(displayName) ? 'block' : 'allow';
                  }
                  patchPolicyMutation.mutate({
                    key: 'kids.web_filter',
                    value: { ...(entryValue(policy, 'kids.web_filter') ?? {}), categories },
                    strength: 'hard',
                  });
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
        </div>
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
                patchPolicyMutation.mutate({
                  key: 'kids.bedtime',
                  value: bedtimeValue(enabled),
                  strength: 'hard',
                });
              }}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Bedtime start</label>
              <input
                type="time"
                disabled={!bedtimeEnabled}
                value={toTimeString(bedtimeStart.hour, bedtimeStart.minute)}
                onChange={(event) => {
                  const next = parseTimeString(event.target.value);
                  setBedtimeStart(next);
                  patchPolicyMutation.mutate({
                    key: 'kids.bedtime',
                    value: bedtimeValue(bedtimeEnabled, bedtimeDays, next, bedtimeWake),
                    strength: 'hard',
                  });
                }}
                className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-slate-100 disabled:opacity-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Wake time</label>
              <input
                type="time"
                disabled={!bedtimeEnabled}
                value={toTimeString(bedtimeWake.hour, bedtimeWake.minute)}
                onChange={(event) => {
                  const next = parseTimeString(event.target.value);
                  setBedtimeWake(next);
                  patchPolicyMutation.mutate({
                    key: 'kids.bedtime',
                    value: bedtimeValue(bedtimeEnabled, bedtimeDays, bedtimeStart, next),
                    strength: 'hard',
                  });
                }}
                className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2 text-slate-100 disabled:opacity-40"
              />
            </div>
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
                  patchPolicyMutation.mutate({
                    key: 'kids.bedtime',
                    value: bedtimeValue(bedtimeEnabled, next),
                    strength: 'hard',
                  });
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
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <BarChart3 className="h-4 w-4 text-brand-400" />
                Weekly usage
              </h3>
              {weeklyTotalUsageMinutes > 0 && (
                <span className="text-xs text-slate-500">
                  Avg: {minutesLabel(Math.round(weeklyTotalUsageMinutes / 7))}/day
                </span>
              )}
            </div>
            {weeklyBars.some((bar) => bar.minutes > 0) ? (
              <>
                <div className="mt-5 flex h-32 items-end gap-2">
                  {weeklyBars.map((bar, index) => {
                    const maxMinutes = Math.max(...weeklyBars.map((item) => item.minutes), dailyLimitMinutes, 1);
                    const heightPct = Math.max(4, Math.round((bar.minutes / maxMinutes) * 100));
                    return (
                      <div key={`${bar.day}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] text-slate-500">
                          {bar.minutes > 0 ? minutesLabel(bar.minutes) : ''}
                        </span>
                        <div
                          title={`${bar.day}: ${minutesLabel(bar.minutes)}`}
                          className={`w-full rounded-t transition-all ${
                            bar.overLimit ? 'bg-rose-400' : 'bg-brand-400/70 hover:bg-brand-400'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-xs text-slate-500">{bar.day}</span>
                      </div>
                    );
                  })}
                </div>
                {dailyLimitMinutes > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Daily limit: {minutesLabel(dailyLimitMinutes)} ·{' '}
                    <span className="text-rose-400">
                      {weeklyBars.filter((bar) => bar.overLimit).length} day(s) exceeded
                    </span>
                  </p>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-400">
                ⚠ No usage data received yet. Ensure the child device is online and the GuardHUB Kids app has Usage Access permission granted.
              </div>
            )}
          </section>
          <section className="glass-panel p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Clock className="h-4 w-4 text-brand-400" />
              Weekly events
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'App blocks', value: weeklyBlockCount, colour: 'text-rose-400' },
                {
                  label: 'Limit reached days',
                  value: weeklyBars.filter((bar) => bar.overLimit).length,
                  colour: 'text-amber-400',
                },
                {
                  label: 'Usage reports',
                  value: auditEntries.filter((entry) => entry.action === 'kids.usage_reported').length,
                  colour: 'text-brand-400',
                },
                {
                  label: 'Heartbeats (7d)',
                  value: auditEntries.filter(
                    (entry) =>
                      entry.action === 'kids.heartbeat' &&
                      new Date(entry.createdAt).getTime() >= Date.now() - 7 * 86_400_000,
                  ).length,
                  colour: 'text-accent-teal',
                },
              ].map(({ label, value, colour }) => (
                <div key={String(label)} className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-3">
                  <div className={`text-xl font-bold ${colour}`}>{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="glass-panel p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-100">Most used apps this week</h3>
            {topAppsByUsage.length ? (
              <div className="mt-4 space-y-3">
                {topAppsByUsage.map((app) => {
                  const maxMinutes = Math.max(topAppsByUsage[0]?.totalMinutes ?? 0, 1);
                  const widthPct = Math.round((app.totalMinutes / maxMinutes) * 100);
                  return (
                    <div key={app.packageName} className="flex items-center gap-3">
                      <Smartphone className="h-4 w-4 shrink-0 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate font-mono text-slate-200">{app.packageName}</span>
                          <span className="shrink-0 text-xs text-brand-400">
                            {minutesLabel(app.totalMinutes)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-brand-500/60"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>
                No app usage data yet. Usage appears here after the device syncs.
              </EmptyState>
            )}
          </section>
          {recentBlocks.length > 0 ? (
            <section className="glass-panel p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-100">Recent blocks (all time)</h3>
              <div className="mt-4 space-y-2">
                {recentBlocks.map((event, index) => (
                  <div
                    key={`${event.packageName}-${event.occurredAtEpochMillis}-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2.5"
                  >
                    <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                      {blockReasonLabel(event.reason)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">
                      {event.packageName}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {new Date(event.occurredAtEpochMillis).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
