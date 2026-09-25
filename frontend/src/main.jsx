// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppErrorBoundary, recuperarDeChunkDesatualizado } from './sentry';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { I18nProvider } from './i18n';
import { TemaProvider } from './tema/TemaContext';
// Fontes self-hosted (sem CDN externo) — carácter da marca KIXIMA.
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
// Ordem importa: os três fundos primeiro (tokens), depois a folha histórica
// (lê esses tokens) e por fim a identidade da Bancada sobre as classes existentes.
import './styles/tema.css';
import './styles/global.css';
import './styles/bancada.css';

// Ver sentry.jsx: recupera sozinho de uma aba presa numa versão antiga do
// build, em vez de mostrar o ecrã de erro por causa de um deploy normal.
recuperarDeChunkDesatualizado();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <TemaProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </TemaProvider>
        </I18nProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
