// src/tema/TemaContext.jsx
// Os três fundos da Proposta 04 · Bancada — Claro, Escuro 1, Escuro 2 — são o
// mesmo conjunto de variáveis CSS com valores diferentes (src/styles/tema.css).
// Aqui vive só a ESCOLHA: qual está activo, onde se guarda e como se muda.
//
// Regras, iguais às do script da proposta:
//   - sem escolha guardada segue o sistema: Escuro 1 se o sistema pedir cores
//     escuras, Claro caso contrário (o CSS já o faz sozinho via
//     prefers-color-scheme; aqui só se reflecte no botão premido);
//   - a escolha da pessoa fica em localStorage (`kixima.tema`) e aplica-se
//     em <html data-tema="…"> — index.html aplica-a antes do primeiro paint
//     para não haver um clarão do fundo errado.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';

export const CHAVE = 'kixima.tema';

export const TEMAS = [
  { id: 'claro', label: 'Claro', titulo: 'Marfim do manual' },
  { id: 'escuro-1', label: 'Escuro 1', titulo: 'O mesmo sistema invertido, com os neutros quentes do manual' },
  { id: 'escuro-2', label: 'Escuro 2', titulo: 'Aproximado à proposta 02: casco, âmbar de segurança e ciano de instrumento' },
];

const IDS = new Set(TEMAS.map((t) => t.id));

function lerGuardado() {
  try {
    const v = window.localStorage.getItem(CHAVE);
    return IDS.has(v) ? v : null;
  } catch {
    return null;
  }
}

function doSistema() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro-1' : 'claro';
  } catch {
    return 'claro';
  }
}

const TemaContext = createContext({ tema: 'claro', escolhido: false, setTema: () => {}, TEMAS });

export function TemaProvider({ children }) {
  const [escolha, setEscolha] = useState(() => (typeof window === 'undefined' ? null : lerGuardado()));
  const [sistema, setSistema] = useState(() => (typeof window === 'undefined' ? 'claro' : doSistema()));

  // Sem escolha guardada, o fundo acompanha o sistema em tempo real.
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSistema(mq.matches ? 'escuro-1' : 'claro');
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else if (mq.removeListener) mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const raiz = document.documentElement;
    if (escolha) raiz.setAttribute('data-tema', escolha);
    else raiz.removeAttribute('data-tema');
  }, [escolha]);

  const setTema = useCallback((id) => {
    if (!IDS.has(id)) return;
    setEscolha(id);
    try { window.localStorage.setItem(CHAVE, id); } catch { /* sem armazenamento: fica só nesta sessão */ }
  }, []);

  const value = useMemo(() => ({ tema: escolha || sistema, escolhido: Boolean(escolha), setTema, TEMAS }), [escolha, sistema, setTema]);
  return <TemaContext.Provider value={value}>{children}</TemaContext.Provider>;
}

export function useTema() {
  return useContext(TemaContext);
}

/**
 * O grupo de três botões da proposta ("Claro · Escuro 1 · Escuro 2").
 * Usado no menu da conta, no login e no cabeçalho do site corporativo.
 */
export function SeletorDeFundo({ compacto = false }) {
  const { t } = useI18n();
  const { tema, setTema } = useTema();
  return (
    <div className={`tema${compacto ? ' tema-compacto' : ''}`} role="group" aria-label={t('Fundo')}>
      {TEMAS.map((op) => (
        <button
          key={op.id}
          type="button"
          data-tema={op.id}
          aria-pressed={tema === op.id}
          title={t(op.titulo)}
          onClick={() => setTema(op.id)}
        >
          {t(op.label)}
        </button>
      ))}
    </div>
  );
}
