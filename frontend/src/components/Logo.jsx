// src/components/Logo.jsx
// Marca KIXIMA — chama (vermelho + âmbar) + wordmark + subtítulo opcional.
// `light` usa o wordmark claro (para fundos escuros, como o login).
export default function Logo({ size = 22, subtitle = false, light = false }) {
  return (
    <div className="brand-logo">
      <span className="brand-flame" style={{ width: size + 6, height: size + 6 }} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            className="flame-outer"
            d="M12 2s-1.2 2.7-3.4 5C6.4 9.3 5 11.3 5 14a7 7 0 0 0 14 0c0-3.4-2.1-5.7-3.4-7.1C13.9 5 12 2 12 2z"
          />
          <path
            className="flame-inner"
            d="M12.7 10.4c.8 1 1.9 2.1 1.9 3.7a2.6 2.6 0 0 1-5.2.1c0-1 .5-1.9 1.1-2.5.2.6.7 1 1.3 1.2-.3-1 .3-1.9.9-2.5z"
          />
        </svg>
      </span>
      <span className="brand-text">
        <span className={`brand-word${light ? ' brand-word-light' : ''}`} style={{ fontSize: size }}>
          KIXIMA
        </span>
        {subtitle ? (
          <span className={`brand-sub${light ? ' brand-sub-light' : ''}`}>Plataforma B2B de Operações</span>
        ) : null}
      </span>
    </div>
  );
}
