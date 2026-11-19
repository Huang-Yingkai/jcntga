import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Supabase (auth, database, storage) must never be served from or written to a cache,
// so member data and payment proofs are never stored offline.
const supabasePattern = ({ url }) => url.hostname.endsWith('.supabase.co');
const supabaseNetworkOnly = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => ({
  urlPattern: supabasePattern,
  handler: 'NetworkOnly',
  method,
}));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'JCNTGA Guide Portal',
        short_name: 'JCNTGA',
        description: 'JCNTGA guide membership portal',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#f6f1e8',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only (built JS/CSS/HTML and icons).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // Serve index.html for client-side React Router routes.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: supabaseNetworkOnly,
      },
    }),
  ],
});
