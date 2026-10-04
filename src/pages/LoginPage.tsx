import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  User,
  Eye,
  EyeOff,
  Shield,
  Briefcase,
  PackageCheck,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import mallImage from '../assets/images/shopping_mall_interior_1791043974898.jpg';

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

  // Quick 1-click login for test candidates / evaluators
  const handleQuickLogin = async (demoEmail: string, demoPass: string = 'StockSense@2026') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsLoading(true);
    setErrorMessage(null);

    const res = await login(demoEmail, demoPass);
    setIsLoading(false);
    if (res.success) {
      onLoginSuccess();
    } else {
      setErrorMessage(res.error || 'Quick login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:flex-row">
      {/* Visual Showcase Side (Mall Picture) */}
      <div className="hidden lg:relative lg:flex lg:w-1/2 flex-col justify-between p-12 overflow-hidden bg-slate-950 border-r border-slate-800">
        <img
          src={mallImage}
          alt="Nowshera Shopping Mall Interior"
          className="absolute inset-0 w-full h-full object-cover opacity-85 transition-transform duration-700 ease-out hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/30" />
        <div className="absolute inset-0 bg-emerald-950/20 mix-blend-overlay" />

        {/* Top Header Branding on Image */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-xl">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xl font-black text-white tracking-wider block">STOCKSENSE</span>
            <span className="text-xs text-emerald-300 font-medium">Nowshera Shopping Mall • Internal Portal</span>
          </div>
        </div>

        {/* Bottom Feature Showcase Card */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Retail & Inventory Management Terminal</span>
          </div>
          <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
            Seamless Stock Control & Internal Operations
          </h2>
          <p className="mt-3 text-sm text-slate-200/90 leading-relaxed font-normal">
            Real-time multi-level inventory tracking, fast Stock In/Out logging, immutable movement audit trails, and strict role-based permission tiers for mall administrators, department managers, and store staff.
          </p>
          <div className="mt-6 flex items-center gap-6 pt-6 border-t border-white/15 text-xs text-slate-300">
            <div>
              <div className="text-xl font-extrabold text-white">100%</div>
              <div className="text-slate-400 font-medium">Audit Traceability</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-xl font-extrabold text-white">Real-Time</div>
              <div className="text-slate-400 font-medium">Stock Updates</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-xl font-extrabold text-white">Multi-Role</div>
              <div className="text-slate-400 font-medium">Role-Based Access</div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Terminal Side */}
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-12 xl:px-16 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 overflow-y-auto">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Mall Logo Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-xl shadow-emerald-500/20 mb-3">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              STOCKSENSE
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-emerald-400 font-semibold tracking-wide">
              Nowshera Shopping Mall — Management Terminal
            </p>
          </div>

          <div className="bg-white/95 backdrop-blur-xl py-7 px-6 shadow-2xl rounded-2xl sm:px-10 border border-white/20">
            {/* Sign In vs Sign Up Tabs */}
            <div className="flex border-b border-slate-200 mb-5">
              <button
                type="button"
                onClick={() => {
                  setTab('signin');
                  setErrorMessage(null);
                }}
                className={`flex-1 pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
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
                className={`flex-1 pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  tab === 'signup'
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Quick 1-Click Demo Login Bar */}
            {tab === 'signin' && (
              <div className="mb-5 p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Quick 1-Click Logins:
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Instant Access</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('hussainrabi67@gmail.com')}
                    disabled={isLoading}
                    className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Primary Admin: Hussain Rabi (hussainrabi67@gmail.com) - Full system permissions"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-600" />
                    <span>Hussain (Admin)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('manager@nowsheramall.pk')}
                    disabled={isLoading}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Inventory control, stock in/out, view profit margins"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Manager</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('staff@nowsheramall.pk')}
                    disabled={isLoading}
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Stock in/out, availability checks, cost prices hidden"
                  >
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Staff</span>
                  </button>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 animate-in fade-in">
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
                    placeholder="admin@nowsheramall.pk"
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
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-hidden transition-colors cursor-pointer"
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
                    New accounts are assigned default <strong>Staff</strong> permissions. Role elevation to Manager or Admin is managed via the User Management portal.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-50 cursor-pointer"
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

            <div className="mt-5 flex items-center justify-between text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-3.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Role-Based Access Control</span>
              </span>
              <span className="text-slate-400 font-medium">
                Terminal v2.4
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
