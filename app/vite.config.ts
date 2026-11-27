/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Один сайт: «/» и «/home/» отдают лендинг, всё остальное — приложение.
// На Vercel то же самое делают redirects в vercel.json.
const landingAtRoot = (): Plugin => {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const path = req.url?.split('?')[0];
    if (path === '/home' || path === '/home/') req.url = '/home/index.html';
    next();
  };
  return {
    name: 'oqy-landing-at-root',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
};

export default defineConfig({
  plugins: [
    landingAtRoot(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Oqy — читай и понимай',
        short_name: 'Oqy',
        description: 'Тренажёр функциональной грамотности: чтение и математика для 7–9 классов. Работает без интернета.',
        id: '/',
        orientation: 'any',
        categories: ['education'],
        lang: 'ru',
        theme_color: '#2446b5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2,png}'],
        // лендинг /home/ — отдельный сайт со своими ассетами, в офлайн-кэш приложения он не нужен
        globIgnores: ['home/**'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts-css' } },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 30 } },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/home\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@shared': r('../shared'),
      // shared/ лежит вне app/, поэтому его зависимости берём из app/node_modules
      pako: r('./node_modules/pako'),
    },
  },
  server: { fs: { allow: ['..'] }, proxy: { '/api': 'http://127.0.0.1:3001' } }, // API: npm run dev в корне
  test: {
    include: ['src/**/*.test.ts', '../shared/**/*.test.ts'],
    environment: 'node',
  },
});
