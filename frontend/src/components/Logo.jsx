// src/components/Logo.jsx
// Marca KIXIMA — chama com gradiente (âmbar → vermelho → magenta), wordmark e
// subtítulo opcional. `light` usa o wordmark claro (para fundos escuros).
let idc = 0;

export default function Logo({ size = 22, subtitle = false, light = false }) {
  const gid = `kx-flame-${(idc += 1)}`;
  return (
    <div className="brand-logo">
      <span className="brand-flame" style={{ width: size + 6, height: size + 6 }} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f5a623" />
              <stop offset="0.45" stopColor="#e11d2a" />
              <stop offset="1" stopColor="#f5327c" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${gid})`}
            d="M12 2s-1.2 2.7-3.4 5C6.4 9.3 5 11.3 5 14a7 7 0 0 0 14 0c0-3.4-2.1-5.7-3.4-7.1C13.9 5 12 2 12 2z"
          />
          <path
            fill="#fff"
            opacity="0.85"
            d="M12.7 10.6c.8 1 1.9 2 1.9 3.6a2.6 2.6 0 0 1-5.2.1c0-1 .5-1.9 1.1-2.5.2.6.7 1 1.3 1.2-.3-1 .3-1.9.9-2.4z"
          />
          <circle cx="12" cy="20.4" r="1.3" fill="#17b7a4" />
        </svg>
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
