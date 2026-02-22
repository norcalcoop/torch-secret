import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'client',
  // envDir defaults to `root` when root is overridden. Since our .env lives
  // in the project root (one level above client/), point envDir back there.
  envDir: '..',
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
