// src/components/Logo.jsx
// Marca KIXIMA. Usa o logótipo oficial (public/kixima-logo.png — a gota com a
// plataforma petrolífera e os padrões). Se o ficheiro ainda não existir, mostra
// a chama SVG como alternativa, para a app nunca ficar sem marca.
import { useState } from 'react';

let idc = 0;

// Emblema KIXIMA — gota com a silhueta de uma plataforma petrolífera offshore.
// É totalmente SVG (sem depender de nenhum ficheiro), por isso a marca aparece
// sempre. Se colocares o logótipo oficial em public/kixima-logo.png, ele é usado
// em vez deste emblema.
function FlameFallback({ size }) {
  const gid = `kx-drop-${(idc += 1)}`;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5a3c" />
          <stop offset="0.55" stopColor="#e11d2a" />
          <stop offset="1" stopColor="#b3121d" />
        </linearGradient>
      </defs>
      {/* Gota */}
      <path fill={`url(#${gid})`} d="M24 3C24 3 8 20 8 31a16 16 0 0 0 32 0C40 20 24 3 24 3z" />
      {/* Plataforma offshore (torre + convés) em branco */}
      <g fill="#fff">
        <rect x="14.5" y="30.5" width="19" height="2.4" rx="1" />
        <rect x="17" y="24" width="1.8" height="7" transform="skewX(-8)" />
        <rect x="29" y="24" width="1.8" height="7" transform="skewX(8)" />
        <path d="M24 14l5.5 10h-11z" opacity="0.95" />
        <rect x="23.1" y="10.5" width="1.8" height="5" rx="0.9" />
        <rect x="20.5" y="33.6" width="1.6" height="4" rx="0.8" opacity="0.85" />
        <rect x="25.9" y="33.6" width="1.6" height="4" rx="0.8" opacity="0.85" />
      </g>
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
            src="/images/kixima-logo.png"
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
