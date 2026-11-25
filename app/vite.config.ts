/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Oqy — читай и понимай',
        short_name: 'Oqy',
        description: 'Тренажёр функциональной грамотности для 7–9 классов. Работает без интернета.',
        lang: 'ru',
        theme_color: '#0f766e',
        background_color: '#f6f8f7',
        display: 'standalone',
        start_url: '/teacher',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        // лендинг /home/ — отдельный сайт со своими ассетами, в офлайн-кэш приложения он не нужен
        globIgnores: ['home/**'],
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
  server: { fs: { allow: ['..'] } },
  test: {
    include: ['src/**/*.test.ts', '../shared/**/*.test.ts'],
    environment: 'node',
  },
});
