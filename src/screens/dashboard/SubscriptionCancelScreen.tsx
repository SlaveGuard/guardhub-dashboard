import { XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SubscriptionCancelScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-xl text-center">
        <XCircle className="mx-auto h-20 w-20 text-amber-500" />
        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Subscription Checkout Cancelled
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          No payment was made. You can try again anytime.
        </p>
        <button type="button" className="btn-primary mt-8" onClick={() => navigate('/subscription')}>
          Back to Plans
        </button>
      </div>
    </div>
  );
}
