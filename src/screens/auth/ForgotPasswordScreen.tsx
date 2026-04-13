import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      toast.success(res.data?.message || 'If that email exists, a reset link has been sent.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-panel p-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Forgot Password</h1>
        <p className="text-slate-400 mb-6">Enter your account email and GuardHub will send you a reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
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

          <button type="submit" className="btn-primary w-full flex justify-center items-center h-12" disabled={loading}>
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Remembered it?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
