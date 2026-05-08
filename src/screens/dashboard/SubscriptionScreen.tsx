import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard, ExternalLink, LoaderCircle, Receipt, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createCheckout,
  createPortal,
  getBillingState,
  getInvoices,
  getPublicPlans,
  type DashboardInvoice,
  type PublicPlan,
} from '../../api/billing';
import { apiClient } from '../../api/client';

type AnyRecord = Record<string, any>;

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string) {
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
}

function billingStatusChip(status?: string | null) {
  if (!status) return null;
  const classes: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-500',
    trialing: 'bg-brand-500/10 text-brand-500 dark:text-brand-400',
    past_due: 'bg-red-500/10 text-red-500',
    canceled: 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past Due',
    canceled: 'Canceled',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[status] ?? classes.canceled}`}>
      {labels[status] ?? status}
    </span>
  );
}

function invoiceStatusChip(status: string) {
  const classes: Record<string, string> = {
    paid: 'bg-emerald-500/10 text-emerald-500',
    open: 'bg-amber-500/10 text-amber-500',
    void: 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
    uncollectible: 'bg-red-500/10 text-red-500',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes[status] ?? classes.void}`}>
      {status}
    </span>
  );
}

function priceIdEnvKey(planCode: string) {
  return `VITE_STRIPE_PRICE_${planCode.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function configuredPriceId(planCode: string) {
  const env = import.meta.env as Record<string, string | undefined>;
  return env[priceIdEnvKey(planCode)]?.trim() || '';
}

function planPriceLabel(plan: PublicPlan) {
  if (!plan.price || plan.price <= 0) return 'Free';
  return `$${plan.price} / ${plan.billingInterval ?? 'month'}`;
}

function PlanLimit({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="rounded-lg bg-slate-100/80 p-3 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 font-semibold">{value ?? 'Unlimited'}</div>
    </div>
  );
}

function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-5 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
      ))}
    </div>
  );
}

export default function SubscriptionScreen() {
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [manualPriceIds, setManualPriceIds] = useState<Record<string, string>>({});

  const billingQuery = useQuery({
    queryKey: ['subscription', 'billing'],
    queryFn: getBillingState,
  });
  const plansQuery = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: getPublicPlans,
  });
  const invoicesQuery = useQuery({
    queryKey: ['subscription', 'invoices'],
    queryFn: getInvoices,
    enabled: billingQuery.data?.hasSubscription ?? false,
  });
  const limitsQuery = useQuery<AnyRecord>({
    queryKey: ['subscription', 'limits'],
    queryFn: async () => (await apiClient.get('/subscription/limits')).data,
  });

  const checkoutMutation = useMutation({
    mutationFn: (priceId: string) => createCheckout(priceId),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error('Could not start checkout. Please try again.');
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => createPortal(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error('Could not open billing portal. Please try again.');
    },
  });

  const billing = billingQuery.data;
  const currentPlanName = billing?.planName ?? limitsQuery.data?.plan?.name ?? null;
  const currentlyOnPaidPlan = Boolean(
    billing?.hasSubscription && currentPlanName && currentPlanName !== 'free',
  );

  const sortedPlans = useMemo(
    () => [...(plansQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [plansQuery.data],
  );

  const openPortal = () => portalMutation.mutate();

  return (
    <div className="space-y-8 p-6">
      <section className="glass-panel p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <CreditCard className="h-6 w-6 text-brand-500" />
            Your Plan
          </h1>
          {billing?.providerCustomerId ? (
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={openPortal}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {portalMutation.isPending ? 'Opening portal...' : 'Manage Billing'}
            </button>
          ) : null}
        </div>

        {billingQuery.isLoading ? (
          <SkeletonBlock />
        ) : !billing?.hasSubscription ? (
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Free plan - no payment method on file
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Upgrade below to unlock more child profiles, devices, and app types.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
                {billing.planName ?? 'free'}
              </span>
              {billingStatusChip(billing.billingStatus)}
            </div>
            {billing.trialEndsAt ? (
              <div className="text-sm text-amber-400">Trial ends: {formatDate(billing.trialEndsAt)}</div>
            ) : null}
            {billing.currentPeriodEnd ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Renews: {formatDate(billing.currentPeriodEnd)}
              </div>
            ) : null}
            {billing.cancelAt ? (
              <div className="text-sm text-red-400">Cancels: {formatDate(billing.cancelAt)}</div>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Plans</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upgrade or change your plan at any time.
          </p>
        </div>

        {plansQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="glass-panel p-6"><SkeletonBlock rows={6} /></div>
            <div className="glass-panel p-6"><SkeletonBlock rows={6} /></div>
            <div className="glass-panel p-6"><SkeletonBlock rows={6} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isCurrentPlan =
                plan.code === currentPlanName ||
                plan.name === currentPlanName ||
                plan.code === limitsQuery.data?.plan?.name;
              const isPaid = Boolean(plan.price && plan.price > 0);
              const envPriceId = configuredPriceId(plan.code);
              const selected = selectedPlanCode === plan.code;
              const priceId = envPriceId || manualPriceIds[plan.code] || '';

              return (
                <article
                  key={plan.id}
                  className={`glass-panel relative flex flex-col p-6 ${isCurrentPlan ? 'ring-2 ring-brand-500' : ''}`}
                >
                  {isCurrentPlan ? (
                    <span className="absolute right-4 top-4 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-500 dark:text-brand-400">
                      Current Plan
                    </span>
                  ) : null}

                  <div className="pr-28">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {plan.displayName}
                    </h3>
                    <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {planPriceLabel(plan)}
                    </div>
                  </div>

                  {plan.trialDays ? (
                    <span className="mt-4 w-fit rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-500 dark:text-brand-400">
                      {plan.trialDays}-day free trial
                    </span>
                  ) : null}

                  {plan.description ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
                  ) : null}

                  <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                    <PlanLimit label="Active Profiles" value={plan.activeProfilesLimit} />
                    <PlanLimit label="Archived" value={plan.archivedProfilesLimit} />
                    <PlanLimit label="Devices/Profile" value={plan.devicesPerProfileLimit} />
                    <PlanLimit label="Apps/Profile" value={plan.appInstallationsPerProfileLimit} />
                  </div>

                  <div className="mt-5 text-sm">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Allowed apps
                    </div>
                    <div className="mt-1 text-slate-700 dark:text-slate-300">
                      {plan.allowedAppCatalogSlugs.length === 0 ? (
                        <span className="text-green-500">All app types</span>
                      ) : (
                        plan.allowedAppCatalogSlugs.join(', ')
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    {isCurrentPlan ? (
                      <button type="button" className="btn-secondary w-full" disabled>
                        Current Plan
                      </button>
                    ) : isPaid && (!billing?.hasSubscription || currentPlanName === 'free') ? (
                      <div className="space-y-3">
                        <button
                          type="button"
                          className="btn-primary flex w-full items-center justify-center gap-2"
                          onClick={() => setSelectedPlanCode(plan.code)}
                        >
                          <Zap className="h-4 w-4" />
                          Subscribe
                        </button>
                        {selected ? (
                          <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Subscribe to {plan.displayName} for {planPriceLabel(plan)}
                            </div>
                            {envPriceId ? (
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                Using configured Stripe Price ID for this plan.
                              </p>
                            ) : (
                              <>
                                <input
                                  value={manualPriceIds[plan.code] ?? ''}
                                  onChange={(event) =>
                                    setManualPriceIds((current) => ({
                                      ...current,
                                      [plan.code]: event.target.value,
                                    }))
                                  }
                                  placeholder="Enter Stripe Price ID from Stripe Dashboard (starts with price_)"
                                  className="glass-input mt-3 text-sm"
                                />
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                  Enter the Stripe Price ID for this plan (starts with price_). You can find this in your Stripe Dashboard under Products.
                                </p>
                              </>
                            )}
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                className="btn-primary flex-1"
                                disabled={!priceId || checkoutMutation.isPending}
                                onClick={() => checkoutMutation.mutate(priceId)}
                              >
                                {checkoutMutation.isPending ? 'Starting checkout...' : 'Confirm Subscribe'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary flex-1"
                                onClick={() => setSelectedPlanCode(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : isPaid && currentlyOnPaidPlan ? (
                      <button
                        type="button"
                        className="btn-secondary flex w-full items-center justify-center gap-2"
                        onClick={openPortal}
                        disabled={portalMutation.isPending}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Change Plan (via Portal)
                      </button>
                    ) : plan.code === 'free' && currentlyOnPaidPlan ? (
                      <button
                        type="button"
                        className="btn-secondary w-full"
                        onClick={openPortal}
                        disabled={portalMutation.isPending}
                      >
                        Downgrade to Free (via Portal)
                      </button>
                    ) : (
                      <button type="button" className="btn-secondary w-full" disabled>
                        Included
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {billing?.hasSubscription ? (
        <section className="glass-panel p-6">
          <h2 className="mb-5 flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Receipt className="h-6 w-6 text-brand-500" />
            Billing History
          </h2>
          {invoicesQuery.isLoading ? (
            <SkeletonBlock rows={4} />
          ) : !invoicesQuery.data?.linked ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No billing provider linked.</p>
          ) : invoicesQuery.data.invoices.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No invoices yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">Invoice #</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Period</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {invoicesQuery.data.invoices.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: DashboardInvoice }) {
  const periodStart = formatDate(invoice.periodStart);
  const periodEnd = formatDate(invoice.periodEnd);
  const date = formatDate(invoice.paidAt) ?? formatDate(invoice.createdAt);

  return (
    <tr className="text-slate-700 dark:text-slate-300">
      <td className="py-4 pr-4 font-mono text-xs">{invoice.number ?? invoice.id}</td>
      <td className="py-4 pr-4">{invoiceStatusChip(invoice.status)}</td>
      <td className="py-4 pr-4">{formatCurrency(invoice.amountPaid, invoice.currency)}</td>
      <td className="py-4 pr-4">{periodStart && periodEnd ? `${periodStart} -> ${periodEnd}` : '-'}</td>
      <td className="py-4 pr-4">{date ?? '-'}</td>
      <td className="py-4 pr-4">
        {invoice.hostedInvoiceUrl ? (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand-500 hover:text-brand-400"
          >
            View
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          '-'
        )}
      </td>
    </tr>
  );
}
