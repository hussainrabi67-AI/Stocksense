import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const nextSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const nextSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const nextN8nUrl = process.env.NEXT_PUBLIC_N8N_AI_WEBHOOK_URL || env.NEXT_PUBLIC_N8N_AI_WEBHOOK_URL || '';

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(nextSupabaseUrl),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(nextSupabaseKey),
      'process.env.NEXT_PUBLIC_N8N_AI_WEBHOOK_URL': JSON.stringify(nextN8nUrl),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
