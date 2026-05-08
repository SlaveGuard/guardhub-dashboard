import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function SubscriptionSuccessScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription', 'billing'] });
    queryClient.invalidateQueries({ queryKey: ['subscription', 'limits'] });
  }, [queryClient, sessionId]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-xl text-center">
        <CheckCircle className="mx-auto h-20 w-20 text-emerald-500" />
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Subscription Activated!
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Your plan is now active. It may take a moment for your limits to update.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" className="btn-primary" onClick={() => navigate('/profiles')}>
            Go to Dashboard
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/subscription')}>
            View Billing
          </button>
        </div>
      </div>
    </div>
  );
}
