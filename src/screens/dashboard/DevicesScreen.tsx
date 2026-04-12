import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Smartphone, Users, Plus, Copy, Check, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DevicesScreen() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Fetch Family details
  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ['family'],
    queryFn: async () => {
      const res = await apiClient.get('/family/me');
      return res.data;
    },
    retry: 1
  });

  // Fetch Devices
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await apiClient.get('/devices');
      return res.data;
    }
  });

  const createFamilyMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiClient.post('/family', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      toast.success('Family group created!');
    }
  });

  const copyInviteCode = () => {
    if (family?.inviteCode) {
      navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Invite code copied!');
    }
  };

  if (familyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Family & Devices</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your family group and connected protection nodes.</p>
      </header>

      {!family ? (
        <div className="glass-panel p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-brand-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create a Family Group</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm mb-8">
            To start protecting devices, you first need to create a family identity to generate your unique invite code.
          </p>
          <button 
            onClick={() => createFamilyMutation.mutate('Our Family')}
            className="btn-primary flex items-center space-x-2"
            disabled={createFamilyMutation.isPending}
          >
            <Plus className="w-5 h-5" />
            <span>Setup My Family</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Family Info & Invite Code */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel p-6 border-brand-500/20 bg-brand-500/5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center">
                <Users className="w-5 h-5 mr-2 text-brand-500" />
                {family.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Use the invite code below on the GuardScreen Android app to link a device.
              </p>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-500 to-accent-teal rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative glass-panel bg-white dark:bg-dark-900 p-4 border-slate-200 dark:border-white/10 flex justify-between items-center">
                  <span className="font-mono text-xl font-bold text-brand-500 dark:text-brand-400 tracking-widest uppercase">
                    {family.inviteCode}
                  </span>
                  <button 
                    onClick={copyInviteCode}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-dark-700 rounded-lg transition-colors text-slate-400 hover:text-brand-500"
                  >
                    {copied ? <Check className="w-5 h-5 text-accent-teal" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Protection Tips</h4>
                <ul className="space-y-4">
                    <li className="flex items-start space-x-3">
                        <div className="mt-1 w-5 h-5 rounded-full bg-accent-teal/10 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-3 h-3 text-accent-teal" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Enable **Device Admin** on the child's phone to prevent app deletion.
                        </p>
                    </li>
                    <li className="flex items-start space-x-3">
                        <div className="mt-1 w-5 h-5 rounded-full bg-accent-teal/10 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-3 h-3 text-accent-teal" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Accessibility access is required for real-time app blocking.
                        </p>
                    </li>
                </ul>
            </div>
          </div>

          {/* Connected Devices List */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Connected Devices</h3>
            
            {devicesLoading ? (
                <div className="h-32 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                </div>
            ) : devices?.length === 0 ? (
                <div className="glass-panel p-12 border-dashed border-slate-300 dark:border-white/10 text-center text-slate-500">
                    No devices linked yet.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {devices.map((device: any) => (
                        <div key={device.id} className="glass-panel p-5 group hover:border-brand-500/30 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-100 dark:bg-dark-700 rounded-xl">
                                    <Smartphone className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                                </div>
                                <span className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${
                                    device.isActive 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                        : 'bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-400'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${device.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                    {device.isActive ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-slate-100">{device.model}</h4>
                                <p className="text-xs text-slate-500 font-mono mt-1">SN: {device.serialNumber}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                                <span className="text-xs text-slate-400">Last Sync: Today</span>
                                <button className="text-xs font-semibold text-accent-rose hover:text-red-500 transition-colors uppercase">
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
