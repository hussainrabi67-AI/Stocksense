import React, { useState } from 'react';
import { 
  Building2, 
  Database, 
  Bot, 
  User, 
  LogOut, 
  Shield, 
  ChevronDown, 
  PlusCircle, 
  MinusCircle, 
  Settings,
  Sparkles,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/inventory';
import { Badge } from '../common/Badge';
import { getSupabaseCredentials } from '../../lib/supabase';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenConnectionModal: () => void;
  onToggleMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  onOpenConnectionModal,
  onToggleMobileMenu
}) => {
  const { user, role, logout } = useAuth();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const creds = getSupabaseCredentials();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs">
      {/* Left: Mobile trigger & Mall Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div 
          onClick={() => onNavigate('/dashboard')} 
          className="cursor-pointer flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">STOCKSENSE</span>
              <span className="hidden sm:inline-block text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                MALL SAAS
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-medium hidden md:block">
              Nowshera Shopping Mall, KPK
            </div>
          </div>
        </div>
      </div>

      {/* Right Controls: Quick Actions, Role Switcher, Database Status, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Stock Action Buttons */}
        <div className="hidden sm:flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <button
            onClick={() => onNavigate('/stock-in')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              currentPath === '/stock-in'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Stock IN</span>
          </button>
          <button
            onClick={() => onNavigate('/stock-out')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              currentPath === '/stock-out'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <MinusCircle className="w-3.5 h-3.5" />
            <span>Stock OUT</span>
          </button>
        </div>

        {/* Database & AI Engine Status Badge (Clickable ONLY for ADMIN) */}
        {role === 'ADMIN' ? (
          <button
            onClick={onOpenConnectionModal}
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs cursor-pointer"
            title="Admin Access: Configure Supabase & n8n credentials"
          >
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${creds.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700">{creds.isConfigured ? 'Supabase' : 'Offline Mall'}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 text-slate-600">
              <Bot className="w-3.5 h-3.5" />
              <span className="text-[11px]">{creds.hasN8n ? 'n8n' : 'Copilot'}</span>
            </div>
          </button>
        ) : (
          <div
            className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50 text-xs"
            title="System Active"
          >
            <span className={`w-2 h-2 rounded-full ${creds.isConfigured ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600">{creds.isConfigured ? 'Live Database' : 'Offline'}</span>
          </div>
        )}

        {/* Verified User Role Badge (Strictly derived from Supabase Database) */}
        <div className="flex items-center">
          <Badge role={role} size="sm" />
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                {user?.full_name || 'Staff Member'}
              </div>
              <div className="text-[10px] text-slate-400">{user?.email || 'authenticated'}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          </button>

          {userDropdownOpen && (
            <div 
              className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs"
              onMouseLeave={() => setUserDropdownOpen(false)}
            >
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <div className="font-bold text-slate-900 truncate">{user?.full_name}</div>
                <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                <div className="mt-1.5">
                  <Badge role={role} size="sm" />
                </div>
              </div>

              <button
                onClick={() => { onNavigate('/profile'); setUserDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => { onNavigate('/settings'); setUserDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </button>

              {role === 'ADMIN' && (
                <button
                  onClick={() => { onNavigate('/settings/users'); setUserDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Shield className="w-4 h-4 text-purple-500" />
                  <span>User Management</span>
                </button>
              )}

              <button
                onClick={onOpenConnectionModal}
                className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Database className="w-4 h-4 text-emerald-500" />
                <span>Database & n8n Config</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                onClick={async () => {
                  setUserDropdownOpen(false);
                  await logout();
                  onNavigate('/login');
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
              >
                <LogOut className="w-4 h-4 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
