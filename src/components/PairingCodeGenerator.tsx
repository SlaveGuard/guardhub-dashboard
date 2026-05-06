import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../api/client';

type AnyRecord = Record<string, any>;

function rawCode(value: unknown) {
  return String(value ?? '').replace(/\s/g, '');
}

function formatCode(value: unknown) {
  const code = rawCode(value);
  return code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

function maskCode(value: unknown) {
  const code = rawCode(value);
  if (!code) return 'Hidden';
  return `*** ${code.slice(-4)}`;
}

export default function PairingCodeGenerator({
  profileId,
  appCatalog,
  activePairingCodes = [],
  disabled = false,
}: {
  profileId: string;
  appCatalog: AnyRecord[];
  activePairingCodes?: AnyRecord[];
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [generatedCode, setGeneratedCode] = useState<AnyRecord | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const selectedCatalog = useMemo(
    () => appCatalog.find((entry) => entry.id === selectedCatalogId),
    [appCatalog, selectedCatalogId],
  );

  const createPairingCodeMutation = useMutation({
    mutationFn: async (appCatalogId: string) =>
      (await apiClient.post(`/profiles/${profileId}/pairing-codes`, { appCatalogId })).data,
    onSuccess: (pairingCode) => {
      setGeneratedCode(pairingCode);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
      toast.success('Pairing code generated.');
    },
    onError: (error: AnyRecord) => {
      toast.error(error.response?.data?.message || 'Failed to generate pairing code');
    },
  });

  const copyCode = async (codeValue: unknown) => {
    const code = rawCode(codeValue);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 2000);
      toast.success('Pairing code copied.');
    } catch {
      toast.error('Failed to copy pairing code');
    }
  };

  const generate = () => {
    if (!selectedCatalogId) return;
    createPairingCodeMutation.mutate(selectedCatalogId);
  };

  const generatedRawCode = generatedCode ? rawCode(generatedCode.code) : '';
  const generatedAppLabel = generatedCode?.appCatalog?.displayName || selectedCatalog?.displayName || 'Selected app';
  const canGenerate = !!selectedCatalogId && !disabled && !createPairingCodeMutation.isPending;

  return (
    <section className="glass-panel space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pairing Code</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Generate a one-time 7-digit code to pair a new device. Each code is tied to a specific app and can only be used once.
        </p>
      </div>

      <div className="flex flex-col items-end gap-3 md:flex-row">
        <div className="w-full flex-1">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">App</label>
          <select
            value={selectedCatalogId}
            onChange={(event) => {
              setSelectedCatalogId(event.target.value);
              setGeneratedCode(null);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-100"
          >
            <option value="" disabled>
              -- Select app --
            </option>
            {appCatalog.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          className={`btn-primary flex min-w-40 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 py-3 ${
            canGenerate ? '' : 'cursor-not-allowed opacity-40'
          }`}
        >
          <KeyRound className="h-4 w-4" />
          {createPairingCodeMutation.isPending ? 'Generating...' : 'Generate Code'}
        </button>
      </div>

      {generatedCode ? (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>Generated for</span>
            <span className="rounded-full bg-brand-500/10 px-2.5 py-1 font-semibold text-brand-500">
              {generatedAppLabel}
            </span>
          </div>
          <div className="mt-4 text-center font-mono text-3xl font-bold tracking-[0.6em] text-brand-500 dark:text-brand-400">
            {formatCode(generatedCode.code)}
          </div>
          <div className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
            Expires in 24 hours. One-time use only
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => copyCode(generatedCode.code)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-brand-500/40 dark:text-slate-200"
            >
              {copiedCode === generatedRawCode ? <Check className="h-4 w-4 text-accent-teal" /> : <Copy className="h-4 w-4" />}
              {copiedCode === generatedRawCode ? 'Copied!' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-500/20 px-3 py-2 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCcw className="h-4 w-4" />
              New Code
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Pairing Codes</div>
        {activePairingCodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            No active pairing codes for this profile.
          </div>
        ) : (
          activePairingCodes.map((pairingCode) => {
            const code = rawCode(pairingCode.code);
            return (
              <div
                key={pairingCode.id || code}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-900/40 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {pairingCode.appCatalog?.displayName || pairingCode.appName || 'App'}
                  </div>
                  <div className="mt-1 font-mono text-xl tracking-widest text-brand-500">{maskCode(pairingCode.code)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Expires {pairingCode.expiresAt ? new Date(pairingCode.expiresAt).toLocaleString() : 'soon'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(pairingCode.code)}
                  className="self-start rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-brand-500/40 dark:text-slate-200 md:self-center"
                >
                  {copiedCode === code ? 'Copied!' : 'Copy'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
