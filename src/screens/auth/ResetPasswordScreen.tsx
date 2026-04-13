import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';

export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Reset token is missing.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/reset-password', { token, password });
      toast.success(res.data?.message || 'Password reset successfully.');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-panel p-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Reset Password</h1>
        <p className="text-slate-400 mb-6">Choose a new password for your GuardHub account.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
            <input
              type="password"
              className="glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full flex justify-center items-center h-12" disabled={loading}>
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Reset Password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Need a new email?{' '}
          <Link to="/forgot-password" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
            Request another reset link
          </Link>
        </p>
      </div>
    </div>
  );
}
