import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Next.js environment variables (NEXT_PUBLIC_*) or fallback
export function getSupabaseCredentials() {
  const nextUrl = (
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    ''
  ).trim();

  const nextKey = (
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    ''
  ).trim();

  const nextN8n = (
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_N8N_AI_WEBHOOK_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_N8N_AI_WEBHOOK_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_N8N_AI_WEBHOOK_URL) ||
    ''
  ).trim();

  const storedUrl = typeof window !== 'undefined' ? (localStorage.getItem('stocksense_supabase_url') || '').trim() : '';
  const storedKey = typeof window !== 'undefined' ? (localStorage.getItem('stocksense_supabase_key') || '').trim() : '';
  const storedN8n = typeof window !== 'undefined' ? (localStorage.getItem('stocksense_n8n_url') || '').trim() : '';

  // Give direct priority to the NEXT_PUBLIC_ variables provided in the environment
  const url = (nextUrl && !nextUrl.includes('your-project')) ? nextUrl : (storedUrl || nextUrl);
  const key = (nextKey && !nextKey.includes('your-project') && !nextKey.includes('...')) ? nextKey : (storedKey || nextKey);
  const n8nUrl = (nextN8n && !nextN8n.includes('your-n8n')) ? nextN8n : (storedN8n || nextN8n);

  return {
    url,
    key,
    n8nUrl,
    isConfigured: Boolean(url && key && url.startsWith('http') && !url.includes('your-project')),
    hasN8n: Boolean(n8nUrl && n8nUrl.startsWith('http') && !n8nUrl.includes('your-n8n'))
  };
}

export function saveCredentials(url: string, key: string, n8nUrl?: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('stocksense_supabase_url', url.trim());
    else localStorage.removeItem('stocksense_supabase_url');

    if (key) localStorage.setItem('stocksense_supabase_key', key.trim());
    else localStorage.removeItem('stocksense_supabase_key');

    if (n8nUrl !== undefined) {
      if (n8nUrl.trim()) localStorage.setItem('stocksense_n8n_url', n8nUrl.trim());
      else localStorage.removeItem('stocksense_n8n_url');
    }

    // Force reinitialize
    initSupabaseClient();
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance) {
    initSupabaseClient();
  }
  return supabaseInstance;
}

export function initSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();

  if (isConfigured && url && key) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return supabaseInstance;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      supabaseInstance = null;
      return null;
    }
  }

  supabaseInstance = null;
  return null;
}
