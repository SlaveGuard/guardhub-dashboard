import { apiClient } from './client';

export async function getBillingState() {
  const res = await apiClient.get('/subscription/billing');
  return res.data as BillingState;
}

export async function getPublicPlans() {
  const res = await apiClient.get('/subscription/plans');
  return res.data as PublicPlan[];
}

export async function getInvoices() {
  const res = await apiClient.get('/subscription/invoices');
  return res.data as InvoiceListResult;
}

export async function createCheckout(priceId: string) {
  const res = await apiClient.post('/subscription/checkout', { priceId });
  return res.data as { url: string };
}

export async function createPortal() {
  const res = await apiClient.post('/subscription/portal');
  return res.data as { url: string };
}

export interface BillingState {
  hasSubscription: boolean;
  id?: string;
  planName?: string;
  status?: string;
  billingStatus?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  cancelAt?: string | null;
  canceledAt?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  createdAt?: string;
}

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description?: string | null;
  price?: number | null;
  billingInterval?: string | null;
  currency?: string | null;
  trialDays?: number | null;
  activeProfilesLimit?: number | null;
  archivedProfilesLimit?: number | null;
  devicesPerProfileLimit?: number | null;
  appInstallationsPerProfileLimit?: number | null;
  allowedAppCatalogSlugs: string[];
  sortOrder: number;
}

export interface DashboardInvoice {
  id: string;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  createdAt: string;
}

export interface InvoiceListResult {
  linked: boolean;
  invoices: DashboardInvoice[];
  hasMore: boolean;
}
