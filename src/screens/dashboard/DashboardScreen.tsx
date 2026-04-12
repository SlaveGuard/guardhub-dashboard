import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { ShieldAlert, Smartphone, Activity } from 'lucide-react';

export default function DashboardScreen() {
    
  // Fetch Family details
  const { data: family, isLoading } = useQuery({
    queryKey: ['family'],
    queryFn: async () => {
      const res = await apiClient.get('/family/me');
      return res.data;
    },
    retry: 1
  });

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">Overview</h1>
              <p className="text-slate-400 mt-1">General security status and recent activity.</p>
            </div>
            
            {family && (
                <div className="glass-panel px-4 py-2 border-accent-teal/30">
                    <span className="text-sm text-slate-400">Family Invite Code: </span>
                    <span className="font-bold text-accent-teal uppercase tracking-widest">{family.inviteCode}</span>
                </div>
            )}
        </header>

        {/* Top Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50">
                    <ShieldAlert className="w-16 h-16 text-accent-rose" />
                </div>
                <h3 className="text-slate-400 font-medium mb-1 z-10">Threats Blocked</h3>
                <span className="text-4xl font-bold text-slate-100 z-10">12</span>
                <span className="text-sm text-accent-rose mt-2 font-medium z-10">+3 this week</span>
            </div>

            <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50">
                    <Smartphone className="w-16 h-16 text-brand-500" />
                </div>
                <h3 className="text-slate-400 font-medium mb-1 z-10">Protected Devices</h3>
                <span className="text-4xl font-bold text-slate-100 z-10">2</span>
                <span className="text-sm text-brand-400 mt-2 font-medium z-10">All systems online</span>
            </div>

            <div className="glass-panel p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-50">
                    <Activity className="w-16 h-16 text-accent-teal" />
                </div>
                <h3 className="text-slate-400 font-medium mb-1 z-10">System Status</h3>
                <span className="text-2xl font-bold text-slate-100 z-10 mt-2">Active</span>
                <div className="flex items-center mt-3 z-10">
                    <span className="w-3 h-3 rounded-full bg-accent-teal animate-pulse mr-2"></span>
                    <span className="text-sm text-accent-teal font-medium">Monitoring Real-time</span>
                </div>
            </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
            <div className="w-full h-64 glass-panel flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
        ) : !family ? (
            <div className="w-full glass-panel p-8 flex flex-col items-center justify-center border-dashed border-red-500/30">
                <ShieldAlert className="w-12 h-12 text-red-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-200 mb-2">No Family Configured</h2>
                <p className="text-slate-400 text-center max-w-md mb-6">
                    You haven't setup a Family group yet. Create one to generate an invite code for your child's device.
                </p>
                <button className="btn-primary">Create Family Group</button>
            </div>
        ) : (
            <div className="w-full glass-panel p-8">
                <h2 className="text-xl font-bold text-slate-200 mb-4">Recent Activity</h2>
                <div className="text-slate-500 text-center py-12">
                    Connect an Android device to see real-time blocking events here.
                </div>
            </div>
        )}

    </div>
  );
}
