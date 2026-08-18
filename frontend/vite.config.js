/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
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
      // Chat de Suporte / Chat Comercial em tempo real — mesma origem lógica
      // que a API, precisa de `ws: true` porque é uma ligação WebSocket, não
      // um pedido HTTP normal.
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
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
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    // Os testes de ponta a ponta correm no Playwright, num browser a sério, e
    // importam '@playwright/test' — que o vitest não sabe executar. Sem esta
    // exclusão apanhava-os pelo sufixo .spec.js e reportava dois ficheiros
    // falhados enquanto dizia que todos os testes passavam: um resultado que
    // não se percebe e que ensina a ignorar o vermelho.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
