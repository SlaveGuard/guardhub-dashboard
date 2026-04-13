import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../api/client';

export default function RegisterScreen() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/register', {
        email,
        password,
        displayName,
        role: 'parent',
        verificationMethod: 'pin',
      });

      if (res.data?.verificationRequired) {
        toast.success('Verification PIN sent to your email');
        navigate(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      toast.error('Registration completed without verification setup. Please try again.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-panel p-8">
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Parent Name</label>
            <input
              type="text"
              className="glass-input"
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="mt-2 text-xs text-slate-400">
              Password must be at least 8 characters. For a stronger password, include uppercase, lowercase, numbers, and a symbol.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
            <input
              type="password"
              className="glass-input"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full flex justify-center items-center h-12"
            disabled={loading}
            style={{ backgroundColor: '#14b8a6' }}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-teal hover:text-teal-400 transition-colors font-medium">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
