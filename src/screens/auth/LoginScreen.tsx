import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });

      const token = res.data.accessToken;
      const user = res.data.user
        ? {
            ...res.data.user,
            name: res.data.user.displayName ?? res.data.user.email,
          }
        : { email, name: email };

      setAuth(token, user);
      
      toast.success('Welcome back to GuardHub');
      navigate('/dashboard');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      if (error.response?.status === 403 && typeof message === 'string' && message.toLowerCase().includes('verify')) {
        toast.error(message);
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Glass Card Container */}
      <div className="glass-panel p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <input 
                type="email" 
                className="glass-input" 
                placeholder="parent@guardhub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input 
                type="password" 
                className="glass-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full flex justify-center items-center h-12" disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                "Log In"
              )}
            </button>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
              Create a Family
            </Link>
          </p>
      </div>
    </div>
  );
}
