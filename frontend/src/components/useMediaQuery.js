// src/components/useMediaQuery.js
// Devolve se a media query corresponde AGORA e volta a renderizar quando muda.
// Lê o valor de forma síncrona na primeira renderização — sem isto o primeiro
// ecrã aparecia com a navegação errada e só depois "saltava". Sem matchMedia
// (testes em jsdom) devolve false.
import { useEffect, useState } from 'react';

function corresponde(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;
}

export function useMediaQuery(query) {
  const [valor, setValor] = useState(() => corresponde(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const aoMudar = () => setValor(mq.matches);
    aoMudar();
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, [query]);

  return valor;
}
