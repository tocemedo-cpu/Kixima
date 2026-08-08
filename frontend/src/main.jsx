// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppErrorBoundary } from './sentry';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { I18nProvider } from './i18n';
// Fontes self-hosted (sem CDN externo) — carácter da marca KIXIMA.
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
