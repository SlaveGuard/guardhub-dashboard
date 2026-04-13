import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';

export default function VerifyEmailScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/auth/verify-email', {
        email,
        code,
      });
      toast.success('Email verified. You can log in now.');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-panel p-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Verify Your Email</h1>
        <p className="text-slate-400 mb-6">Enter the 6-digit PIN sent to your inbox to activate your parent account.</p>

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
            <input
              type="email"
              className="glass-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Verification PIN</label>
            <input
              type="text"
              className="glass-input tracking-[0.5em] text-center uppercase"
              placeholder="123456"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full flex justify-center items-center h-12" disabled={loading}>
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Verify Email'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already verified?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
            Go to login
          </Link>
        </p>
      </div>
    </div>
  );
}
