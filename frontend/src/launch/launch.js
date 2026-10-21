// src/launch/launch.js
// Interruptor da página de lançamento ("Estamos a chegar… Brevemente!").
//
// A fonte da verdade é UM ficheiro estático, public/launch.json (servido em
// /launch.json por qualquer dos dois backends, com max-age=0 — revalida sempre):
//     { "enabled": true }   → a raiz "/" mostra a página de lançamento
//     { "enabled": false }  → a raiz "/" mostra o site corporativo de sempre
// É lido em tempo de execução, e não embutido no build, para o interruptor ser
// uma alteração de dados e não de código.
//
// FALHA PARA O SITE DE SEMPRE: ficheiro em falta, resposta que não é JSON (o
// fallback de SPA devolve index.html quando o ficheiro não existe), erro de rede
// ou qualquer valor que não seja exactamente `true` → página desactivada. Uma
// avaria aqui nunca tira o site do ar nem esconde a home por engano.
import { useEffect, useState } from 'react';
import { ehAppNativa } from '../api/client';

export const LANCAMENTO_URL = '/launch.json';

// Só o booleano `true` activa — "true", 1 ou "on" não contam, para um valor
// escrito à pressa nunca ligar a página sem intenção.
export function interpretarLancamento(dados) {
  return !!dados && typeof dados === 'object' && dados.enabled === true;
}

export async function lerLancamento(fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  if (!fetchImpl) return false;
  try {
    const r = await fetchImpl(LANCAMENTO_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!r || !r.ok) return false;
    return interpretarLancamento(await r.json());
  } catch {
    return false;
  }
}

// null = ainda a ler; true/false = estado. Só lê quando `ativo` (ou seja, para
// quem não tem sessão — quem está autenticado nunca vê esta página). A app
// nativa (Capacitor) nunca a mostra: traz o seu próprio build e não tem outro
// caminho para iniciar sessão a partir da raiz.
export function useLancamento(ativo = true) {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    if (!ativo) return undefined;
    if (ehAppNativa()) { setEstado(false); return undefined; }
    let vivo = true;
    lerLancamento().then((v) => { if (vivo) setEstado(v); });
    return () => { vivo = false; };
  }, [ativo]);
  return estado;
}
