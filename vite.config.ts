import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'client',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  html: {
    cspNonce: '__CSP_NONCE__',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
