import React from 'react';
import {
  User,
  Shield,
  Mail,
  Calendar,
  LogOut,
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { UserRole } from '../types/inventory';

interface ProfilePageProps {
  onNavigate: (path: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, role, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white flex items-center justify-center font-bold text-2xl shadow-md">
              {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {user?.full_name || 'Staff Member'}
              </h1>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge role={role} size="md" />
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active Session
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Account Details Grid */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Work Location
            </span>
            <span className="font-semibold text-slate-800">Nowshera Shopping Mall, Main Depot</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Account Identifier
            </span>
            <span className="font-mono text-slate-600">{user?.id || 'demo-session'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Registered Date
            </span>
            <span className="font-semibold text-slate-800">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Authorization Authority
            </span>
            <span className="font-semibold text-slate-800">Supabase Row Level Security</span>
          </div>
        </div>
      </div>

      {/* Account Security & Access Authority */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Database Role Authority</h2>
          </div>
          <Badge role={role} size="sm" />
        </div>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          Your role is strictly authenticated and validated against the Supabase database (<code className="font-mono text-emerald-700 font-bold">profiles.role</code>).
          Role elevations or assignments can only be authorized by a Mall Administrator through the backend user management portal.
        </p>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Current Access Tier</span>
            <span className="font-bold text-slate-900">
              {role === 'ADMIN' ? 'System Administrator' : role === 'MANAGER' ? 'Inventory Supervisor / Manager' : 'Inventory Operator (Staff)'}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block">Enforcement Boundary</span>
            <span className="font-bold text-slate-900">Supabase Row Level Security & RPCs</span>
          </div>
        </div>
      </div>

      {/* Permissions Breakdown for Current Role */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Your Active Permissions Breakdown</h2>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>View products catalog and inventory quantities</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Perform stock IN receiving and stock OUT dispatch operations</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Interact with StockSense AI Copilot</span>
          </div>

          {role !== 'STAFF' ? (
            <>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>View supplier cost prices and calculate gross profit margins</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Create new products and modify retail & supplier pricing</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Restricted: Staff accounts cannot view supplier cost price or profit margins.</span>
            </div>
          )}

          {role === 'ADMIN' ? (
            <div className="flex items-center gap-2 text-purple-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Full User Management: Add employees, change roles, grant and revoke admin access</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>User management and admin elevation restricted to Administrators.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
