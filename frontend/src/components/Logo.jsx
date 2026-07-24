// src/components/Logo.jsx
// Marca KIXIMA. Usa o logótipo oficial (public/kixima-logo.png — a gota com a
// plataforma petrolífera e os padrões). Se o ficheiro ainda não existir, mostra
// a chama SVG como alternativa, para a app nunca ficar sem marca.
import { useState } from 'react';

let idc = 0;

function FlameFallback({ size }) {
  const gid = `kx-flame-${(idc += 1)}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5a623" />
          <stop offset="0.45" stopColor="#e11d2a" />
          <stop offset="1" stopColor="#f5327c" />
        </linearGradient>
      </defs>
      <path fill={`url(#${gid})`} d="M12 2s-1.2 2.7-3.4 5C6.4 9.3 5 11.3 5 14a7 7 0 0 0 14 0c0-3.4-2.1-5.7-3.4-7.1C13.9 5 12 2 12 2z" />
      <path fill="#fff" opacity="0.85" d="M12.7 10.6c.8 1 1.9 2 1.9 3.6a2.6 2.6 0 0 1-5.2.1c0-1 .5-1.9 1.1-2.5.2.6.7 1 1.3 1.2-.3-1 .3-1.9.9-2.4z" />
    </svg>
  );
}

export default function Logo({ size = 22, subtitle = false, light = false, mark }) {
  const [imgOk, setImgOk] = useState(true);
  // O logótipo (a gota) fica bem maior que o texto para ser bem visível.
  const box = mark || Math.round(size * 2.4);

  return (
    <div className="brand-logo">
      <span className="brand-mark" style={{ width: box, height: box }} aria-hidden="true">
        {imgOk ? (
          <img
            src="/kixima-logo.png"
            alt="KIXIMA"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            onError={() => setImgOk(false)}
          />
        ) : (
          <FlameFallback size={box} />
        )}
      </span>
      <span className="brand-text">
        <span className={`brand-word${light ? ' brand-word-light' : ''}`} style={{ fontSize: size }}>
          KIXIMA
        </span>
        {subtitle ? (
          <span className={`brand-sub${light ? ' brand-sub-light' : ''}`}>Plataforma de Procurement Garantido</span>
        ) : null}
      </span>
    </div>
  );
}
