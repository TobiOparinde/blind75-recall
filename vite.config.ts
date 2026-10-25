import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project sites need the same base for assets, manifest and worker.
const base = process.env.BASE_PATH || '/';
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base) || base.split('/').some((part) => part === '.' || part === '..')) {
  throw new Error('BASE_PATH must be an absolute directory path ending with /');
}

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // A new worker waits until old clients close; never reload a review mid-session.
      registerType: 'prompt',
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Blind 75 Recall',
        short_name: 'Recall',
        description: 'Keep coding patterns fresh with spaced repetition.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'safari16', sourcemap: false },
});
