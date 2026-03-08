import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'client',
  // envDir defaults to `root` when root is overridden. Since our .env lives
  // in the project root (one level above client/), point envDir back there.
  envDir: '..',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  html: {
    cspNonce: '__CSP_NONCE__',
  },
  optimizeDeps: {
    include: ['qrcode'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // SSR content pages served by Express (not Vite)
      '/vs': { target: 'http://localhost:3000', changeOrigin: true },
      '/alternatives': { target: 'http://localhost:3000', changeOrigin: true },
      '/use': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
