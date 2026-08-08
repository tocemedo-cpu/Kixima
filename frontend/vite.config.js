import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// KIXIMA — frontend dev server. A API do backend corre em http://localhost:4000
// (ver kixima-backend/.env.development -> PORT=4000). O proxy evita problemas
// de CORS em desenvolvimento.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as bibliotecas de terceiros em chunks próprios e cacheáveis —
        // mudam raramente, pelo que o browser reutiliza-os entre deploys.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-sentry': ['@sentry/react'],
        },
      },
    },
  },
});
