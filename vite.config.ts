import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'client',
  resolve: {
    alias: {
      // lucide 0.564.0 has a broken `module` field pointing to a non-existent
      // ESM entry. Map to the actual file so Vite can resolve it.
      lucide: 'lucide/dist/esm/lucide/src/lucide.js',
    },
  },
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
