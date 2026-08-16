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

// "Ocorreu um erro inesperado" ao iniciar ou ao trocar de página, sem padrão
// aparente, É a página presa numa aba antiga.
//
// Cada rota é o seu próprio ficheiro com hash no nome (Catalog-CoP_NkxE.js), e
// `frontend/dist` é reconstruído a cada deploy — os hashes mudam sempre. Uma
// aba que já estava aberta antes do deploy só tem em memória o `index.html`
// antigo; ao navegar para uma página que ainda não tinha visitado, pede o
// ficheiro com o hash de ANTES, que já não existe no servidor, e o pedido
// falha com 404. O Vite embrulha todo `import()` de rota exatamente para isto:
// dispara `vite:preloadError` na window antes de deixar o erro subir. Sem
// ninguém a ouvir, ele sobe até este ErrorBoundary — daí "às vezes ao trocar
// de página", que é sempre que a rota pedida ainda não tinha sido carregada
// nesta aba desde o último deploy.
//
// A CORREÇÃO NÃO É ESCONDER O ERRO — é fazer o que qualquer pessoa faria a
// seguir de qualquer forma: recarregar a página. Um recarregamento vai buscar
// o `index.html` novo, que já aponta para os ficheiros certos, e o problema
// desaparece porque deixou de existir.
//
// SÓ UMA VEZ POR JANELA DE DEZ SEGUNDOS. Se a causa não for um deploy — rede
// em baixo, por exemplo — recarregar sem parar prende a pessoa num ciclo
// silencioso, pior do que o ecrã de erro que se queria evitar. Passada essa
// janela, um novo problema (um deploy seguinte, por exemplo) volta a
// recuperar-se sozinho.
const CHAVE_ULTIMO_RECARREGAR = 'kixima_ultimo_recarregar_por_chunk';
const JANELA_SEM_REPETIR_MS = 10_000;

export function recuperarDeChunkDesatualizado() {
  window.addEventListener('vite:preloadError', (evento) => {
    const agora = Date.now();
    const ultimo = Number(sessionStorage.getItem(CHAVE_ULTIMO_RECARREGAR) || 0);
    if (agora - ultimo < JANELA_SEM_REPETIR_MS) return; // deixa o ecrã de erro aparecer
    evento.preventDefault();
    sessionStorage.setItem(CHAVE_ULTIMO_RECARREGAR, String(agora));
    window.location.reload();
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
