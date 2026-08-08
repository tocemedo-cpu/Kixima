// src/sentry.jsx
// Rastreio de erros do frontend (Sentry). Ativa apenas se VITE_SENTRY_DSN
// estiver definido no build; caso contrário é no-op. Exporta também um
// ErrorBoundary com ecrã de recurso — em vez de uma página em branco quando um
// componente rebenta, o utilizador vê uma mensagem e o erro é reportado.
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

function Fallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        <h2 style={{ margin: '0 0 8px' }}>Ocorreu um erro inesperado</h2>
        <p style={{ color: '#666', margin: '0 0 18px' }}>
          A equipa foi notificada. Recarregue a página para continuar.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#c1121f', color: '#fff', border: 0, padding: '10px 22px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}

// ErrorBoundary funciona mesmo sem DSN (só não reporta) — o ecrã de recurso
// substitui sempre a página em branco.
export function AppErrorBoundary({ children }) {
  return <Sentry.ErrorBoundary fallback={<Fallback />}>{children}</Sentry.ErrorBoundary>;
}

export { Sentry };
