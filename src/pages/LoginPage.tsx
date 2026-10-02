import React, { useState } from 'react';
import { Building2, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, User, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/inventory';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, signUp } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both your email address and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    if (tab === 'signin') {
      const res = await login(email, password);
      setIsLoading(false);
      if (res.success) {
        onLoginSuccess();
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please verify your credentials.');
      }
    } else {
      if (!fullName.trim()) {
        setIsLoading(false);
        setErrorMessage('Please enter your full name.');
        return;
      }

      const res = await signUp(email, password, fullName);
      setIsLoading(false);
      if (res.success) {
        onLoginSuccess();
      } else {
        setErrorMessage(res.error || 'Sign up failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Mall Logo */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/20 mb-3">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          STOCKSENSE
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-emerald-400 font-semibold tracking-wide">
          Nowshera Shopping Mall — AI Inventory Management
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/20">
          
          {/* Sign In vs Sign Up Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMessage(null);
              }}
              className={`flex-1 pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                tab === 'signin'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                tab === 'signup'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="font-semibold block">Attention:</strong>
                {errorMessage}
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Khan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="employee@nowsheramall.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-hidden transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-slate-500 hover:text-slate-700" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-500 hover:text-slate-700" />
                  )}
                </button>
              </div>
            </div>

            {tab === 'signup' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  New accounts are assigned default <strong>Staff</strong> permissions. Role elevation to Manager or Admin is strictly authorized by Mall Administrators via the User Management portal.
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{tab === 'signin' ? 'Sign In to Terminal' : 'Register Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-4">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Authenticated securely via Supabase Auth & RLS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
