import { ChevronRight, Shield, Smartphone } from 'lucide-react';

type AnyRecord = Record<string, any>;

function deviceName(device: AnyRecord) {
  return device.deviceName || device.name || 'Unknown device';
}

function lastSeenLabel(value: unknown) {
  if (!value) return 'No activity reported yet';
  return `Last seen ${new Date(String(value)).toLocaleString()}`;
}

function isOnline(device: AnyRecord) {
  const status = String(device.status || device.onlineStatus || '').toLowerCase();
  if (status === 'online' || status === 'active') return true;
  if (typeof device.isOnline === 'boolean') return device.isOnline;
  return false;
}

function appTone(slug: string) {
  if (slug.includes('guardscreen')) {
    return {
      text: 'text-rose-400',
      bg: 'bg-rose-400/10',
      icon: <Shield className="h-4 w-4" />,
      sub: 'Content protection',
    };
  }
  if (slug.includes('guardhub-kids')) {
    return {
      text: 'text-brand-400',
      bg: 'bg-brand-500/10',
      icon: <Smartphone className="h-4 w-4" />,
      sub: 'Screen time and app management',
    };
  }
  return {
    text: 'text-accent-teal',
    bg: 'bg-accent-teal/10',
    icon: <Smartphone className="h-4 w-4" />,
    sub: 'App installation',
  };
}

export default function LinkedDeviceGroup({
  device,
  onOpenApp,
}: {
  device: AnyRecord;
  onOpenApp: (device: AnyRecord, installation: AnyRecord) => void;
}) {
  const online = isOnline(device);
  const installations = device.appInstallations ?? [];
  const name = deviceName(device);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/30">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-slate-800/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900/50">
            <Smartphone className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <div className="font-semibold text-slate-100">{name}</div>
            <div className="mt-1 text-xs text-slate-400">
              {[device.platform || device.type || 'Device', lastSeenLabel(device.lastSeen)].filter(Boolean).join(' . ')}
            </div>
          </div>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            online ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {installations.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-400">No app installations on this device.</div>
      ) : (
        <div>
          {installations.map((installation: AnyRecord) => {
            const slug = String(installation.appCatalog?.slug || installation.slug || '').toLowerCase();
            const tone = appTone(slug);
            return (
              <button
                type="button"
                key={installation.id}
                onClick={() => {
                  if (!slug.includes('guardhub-kids') && !slug.includes('guardscreen')) {
                    // TODO: Route unknown app catalog slugs to a generic app detail view when that screen exists.
                  }
                  onOpenApp(device, installation);
                }}
                className="flex w-full items-center gap-3 border-b border-white/10 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-800/60"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.bg} ${tone.text}`}>
                  {tone.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${tone.text}`}>
                    {installation.appCatalog?.displayName || installation.displayName || 'App'}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">{tone.sub}</div>
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 ${tone.text}`} />
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
