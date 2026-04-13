import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [password, setPassword] = useState('');

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await apiClient.get('/auth/me');
      return res.data;
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (currentPassword: string) => {
      return apiClient.delete('/auth/me', {
        data: { password: currentPassword },
      });
    },
    onSuccess: () => {
      logout();
      toast.success('Account deleted successfully.');
      navigate('/login');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete account.');
    },
  });

  const handleDelete = (e: FormEvent) => {
    e.preventDefault();
    deleteAccountMutation.mutate(password);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your parent account and security settings.</p>
      </header>

      <div className="glass-panel p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Account</h2>
        <div className="space-y-2 text-sm">
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Name:</span> {me?.displayName || 'Not set'}</p>
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Email:</span> {me?.email}</p>
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Verification:</span> {me?.isVerified ? 'Verified' : 'Not verified'}</p>
          <p className="text-slate-600 dark:text-slate-300"><span className="font-semibold">Role:</span> {me?.role}</p>
        </div>
      </div>

      <div className="glass-panel p-6 border-red-500/20">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Delete Account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              This permanently removes your parent account and the family data owned by it.
            </p>
          </div>
        </div>

        <form onSubmit={handleDelete} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Confirm current password</label>
            <input
              type="password"
              className="glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-60"
            disabled={deleteAccountMutation.isPending}
          >
            {deleteAccountMutation.isPending ? 'Deleting Account...' : 'Delete My Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
