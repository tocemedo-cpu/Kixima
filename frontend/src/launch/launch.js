// src/launch/launch.js
// Interruptor da página de lançamento ("Estamos a chegar… Brevemente!").
//
// A fonte da verdade é UM ficheiro estático, public/launch.json (servido em
// /launch.json por qualquer dos dois backends, com max-age=0 — revalida sempre):
//     { "enabled": true }   → QUALQUER endereço de kixima.net mostra só a página de
//                             lançamento (login, dashboards, admin, desconhecidos…)
//     { "enabled": false }  → tudo funciona normalmente
// Os backends aplicam o mesmo interruptor no servidor (launch.html em vez da app);
// este lado cobre o SPA já carregado e o servidor de desenvolvimento.
// É lido em tempo de execução, e não embutido no build, para o interruptor ser
// uma alteração de dados e não de código.
//
// FALHA PARA O SITE DE SEMPRE: ficheiro em falta, resposta que não é JSON (o
// fallback de SPA devolve index.html quando o ficheiro não existe), erro de rede
// ou qualquer valor que não seja exactamente `true` → página desactivada. Uma
// avaria aqui nunca tira o site do ar por engano.
import { useEffect, useState } from 'react';
import { ehAppNativa } from '../api/client';

export const LANCAMENTO_URL = '/launch.json';

// Só o booleano `true` activa — "true", 1 ou "on" não contam, para um valor
// escrito à pressa nunca ligar a página sem intenção.
export function interpretarLancamento(dados) {
  return !!dados && typeof dados === 'object' && dados.enabled === true;
}

// true/false = o interruptor; null = não foi possível saber (erro de rede ou 5xx).
// Ficheiro em falta (404) ou que não é JSON (o fallback de SPA devolve index.html)
// quer dizer "página desactivada", e não "não sei".
export async function lerEstadoLancamento(fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  if (!fetchImpl) return null;
  try {
    const r = await fetchImpl(LANCAMENTO_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r) return null;
    if (!r.ok) return r.status === 404 ? false : null;
    try { return interpretarLancamento(await r.json()); } catch { return false; }
  } catch {
    return null;
  }
}

export async function lerLancamento(fetchImpl) {
  return (await lerEstadoLancamento(fetchImpl)) === true;
}

// null = ainda a ler; true/false = estado. Reavalia quando a janela volta a ter
// foco e de 5 em 5 minutos, para um separador que já estava aberto também passar a
// respeitar o interruptor sem esperar por um recarregamento. A app nativa
// (Capacitor) nunca mostra a página: traz o seu próprio build e não é kixima.net.
export const REVER_LANCAMENTO_MS = 5 * 60 * 1000;

export function useLancamento() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    if (ehAppNativa()) { setEstado(false); return undefined; }
    let vivo = true;
    // Sem resposta (null) a primeira vez → site de sempre; depois de saber, uma falha
    // passageira de rede não muda o estado (nem abre a app por engano, nem fecha o site).
    const ler = () => lerEstadoLancamento().then((v) => { if (vivo) setEstado((antes) => (v === null ? (antes === null ? false : antes) : v)); });
    ler();
    const timer = setInterval(ler, REVER_LANCAMENTO_MS);
    window.addEventListener('focus', ler);
    return () => { vivo = false; clearInterval(timer); window.removeEventListener('focus', ler); };
  }, []);
  return estado;
}
