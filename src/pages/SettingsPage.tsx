import React, { useState } from 'react';
import {
  Settings,
  Database,
  Bot,
  Building2,
  ShieldCheck,
  Key,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';
import { getSupabaseCredentials, saveCredentials } from '../lib/supabase';

interface SettingsPageProps {
  onOpenConnectionModal: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenConnectionModal }) => {
  const { role, user } = useAuth();
  const creds = getSupabaseCredentials();

  const [n8nUrlInput, setN8nUrlInput] = useState(creds.n8nUrl);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSaveN8n = (e: React.FormEvent) => {
    e.preventDefault();
    saveCredentials(creds.url, creds.key, n8nUrlInput);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCopySchemaPath = () => {
    navigator.clipboard.writeText('supabase-schema.sql');
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <Settings className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">System Settings & Infrastructure</h1>
            <p className="text-xs text-slate-500">Database connection, n8n orchestration, and security configuration</p>
          </div>
        </div>

        <Badge role={role} size="md" />
      </div>

      {/* Database & Orchestration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supabase Box */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Supabase PostgreSQL</h3>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                creds.isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {creds.isConfigured ? 'Live Supabase' : 'Offline Mall Engine'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              All transactions, inventory counts, and user roles are enforced at the Supabase database boundary with PostgreSQL row locking and RLS.
            </p>
            <div className="text-xs font-mono bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700 truncate">
              {role === 'ADMIN'
                ? creds.url || 'No live Supabase URL connected (Demo Storage Engine)'
                : creds.url
                ? 'https://••••••••••••••••••••••••.supabase.co'
                : 'Offline Demo Engine'}
            </div>
          </div>

          {role === 'ADMIN' ? (
            <button
              onClick={onOpenConnectionModal}
              className="mt-4 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors text-center cursor-pointer"
            >
              Configure Supabase URL & Anon Key
            </button>
          ) : (
            <div className="mt-4 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-[11px] text-slate-500 font-medium">
              🔒 API keys restricted to Administrator role
            </div>
          )}
        </div>

        {/* n8n OpenRouter Box */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                  <Bot className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">n8n AI Webhook</h3>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                creds.hasN8n ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {creds.hasN8n ? 'Connected' : 'In-App Zero-Hallucination'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Stock queries and 2-step confirmation requests pass through n8n with OpenRouter LLMs. Normal inventory continues working if n8n is offline.
            </p>

            {role === 'ADMIN' ? (
              <form onSubmit={handleSaveN8n} className="space-y-2">
                <input
                  type="url"
                  placeholder="https://n8n.domain.com/webhook/stocksense"
                  value={n8nUrlInput}
                  onChange={(e) => setN8nUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 font-mono text-[11px]"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {savedSuccess ? 'Saved Webhook!' : 'Update n8n Webhook URL'}
                </button>
              </form>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 font-medium text-center">
                🔒 AI Webhook endpoint configuration is locked to Administrators
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role Permissions Security Matrix */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900">Security & RBAC Boundary Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-3">System Capability</th>
                <th className="py-2.5 px-3 text-center">STAFF</th>
                <th className="py-2.5 px-3 text-center">MANAGER</th>
                <th className="py-2.5 px-3 text-center">ADMIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">View Products & Stock Levels</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">Record Stock IN & Stock OUT</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
              </tr>
              <tr className="bg-rose-50/20">
                <td className="py-2.5 px-3 font-medium text-slate-800">View Cost Price & Gross Profit Margins</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ RESTRICTED</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">Add New Products & Update Prices</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ RESTRICTED</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">Manage Users & Grant Admin Roles</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ RESTRICTED</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ RESTRICTED</td>
                <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">✓ Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-800">Self-Role Modification / Self-Promotion</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ BLOCKED</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ BLOCKED</td>
                <td className="py-2.5 px-3 text-center text-rose-600 font-bold">✗ BLOCKED</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mall Location & Retail Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Nowshera Shopping Mall</div>
            <div className="text-xs text-slate-500">Main G.T. Road, Nowshera Cantt, Khyber Pakhtunkhwa, Pakistan</div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-400">Terminal Version 1.0.0</span>
        </div>
      </div>
    </div>
  );
};
