/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// KIXIMA — frontend dev server. A API do backend corre em http://localhost:4000
// (ver kixima-backend/.env.development -> PORT=4000). O proxy evita problemas
// de CORS em desenvolvimento.
// Em desenvolvimento (vite dev) o /launch.json responde SEMPRE { "enabled": false }: o servidor de
// dev e os testes e2e, que correm contra ele, não podem ficar presos na página de lançamento.
// LAUNCH_DEV=on serve o ficheiro verdadeiro, para ver o modo de lançamento a trabalhar em dev.
// (Num build/deploy o ficheiro é o de frontend/public/launch.json, sem este desvio.)
function launchEmDev() {
  return {
    name: 'kixima-launch-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/launch.json', (req, res, next) => {
        if (process.env.LAUNCH_DEV === 'on') return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end('{"enabled":false}');
      });
    },
  };
}

// Para onde o servidor de desenvolvimento reencaminha a API. Por omissão o backend Node (porta 4000); para
// trabalhar contra o backend Java (porta 4001) usa-se `npm run dev:java`, ou API_PROXY_TARGET=http://localhost:4001.
const alvoApi = process.env.API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), launchEmDev()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: alvoApi,
        changeOrigin: true,
      },
      // Chat de Suporte / Chat Comercial em tempo real — mesma origem lógica
      // que a API, precisa de `ws: true` porque é uma ligação WebSocket, não
      // um pedido HTTP normal.
      '/socket.io': {
        target: alvoApi,
        changeOrigin: true,
        ws: true,
      },
      // Tempo real STOMP do backend Java (VITE_REALTIME=stomp). Sem esta entrada o próprio Vite
      // atendia o /ws e o handshake nunca chegava ao Java.
      '/ws': {
        target: alvoApi,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      // Duas páginas: a app (index.html) e a página de lançamento estática (launch.html),
      // que os backends servem no lugar da app com o modo de lançamento ligado.
      input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), launch: fileURLToPath(new URL('./launch.html', import.meta.url)) },
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
