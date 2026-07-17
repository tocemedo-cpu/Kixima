// src/components/CategoryArt.jsx
// Ilustração de "capa" por categoria do setor Oil & Gas — cena vetorial rica
// (fundo de marca + grelha técnica + motivo). Usada como imagem do produto
// enquanto não houver fotografia real (imageUrl). Sem verde: paleta de marca
// (aço, vinho, âmbar, ameixa) com acento âmbar da chama.
import { categoryVisual } from './icons';

const S = { fill: 'none', stroke: 'rgba(255,255,255,.9)', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
const T = { fill: 'none', stroke: 'rgba(255,255,255,.4)', strokeWidth: 2, strokeLinecap: 'round' };
const AMBER = '#f2a33c';

const SCENES = {
  // Válvula de esfera / gaveta com volante e flanges
  valve: (
    <g>
      <line {...T} x1="40" y1="92" x2="280" y2="92" />
      <rect {...S} x="120" y="74" width="80" height="36" rx="6" />
      <rect {...S} x="108" y="70" width="14" height="44" rx="2" />
      <rect {...S} x="198" y="70" width="14" height="44" rx="2" />
      <line {...S} x1="160" y1="74" x2="160" y2="42" />
      <circle {...S} cx="160" cy="34" r="16" />
      <path {...S} d="M160 22v24M148 34h24" />
      <circle cx="160" cy="92" r="9" fill={AMBER} opacity=".9" />
    </g>
  ),
  // Mangueira hidráulica enrolada + acoplamento
  hydraulic: (
    <g>
      <path {...S} d="M96 108c0-30 24-54 54-54s54 24 54 54" />
      <path {...S} d="M112 108c0-21 17-38 38-38s38 17 38 38" />
      <path {...S} d="M128 108c0-12 10-22 22-22s22 10 22 22" />
      <rect {...S} x="196" y="98" width="34" height="20" rx="3" />
      <line {...S} x1="230" y1="103" x2="248" y2="103" />
      <line {...S} x1="230" y1="113" x2="248" y2="113" />
      <rect x="196" y="98" width="10" height="20" fill={AMBER} opacity=".85" />
    </g>
  ),
  // Inspeção UT — lupa sobre sinal com descontinuidade
  inspection: (
    <g>
      <polyline {...T} points="44,96 80,96 96,60 116,120 136,84 160,96 300,96" />
      <circle {...S} cx="150" cy="70" r="34" />
      <line {...S} x1="174" y1="94" x2="212" y2="128" />
      <circle cx="136" cy="72" r="5" fill={AMBER} />
      <path {...S} d="M138 60l10 10" opacity=".6" />
    </g>
  ),
  // Logística — camião de carga com contentor
  truck: (
    <g>
      <rect {...S} x="44" y="66" width="120" height="50" rx="4" />
      <path {...S} d="M164 82h44l24 22v12h-68z" />
      <line {...T} x1="60" y1="80" x2="150" y2="80" />
      <line {...T} x1="60" y1="94" x2="150" y2="94" />
      <circle {...S} cx="92" cy="124" r="12" />
      <circle {...S} cx="206" cy="124" r="12" />
      <rect x="196" y="86" width="20" height="14" fill={AMBER} opacity=".85" />
    </g>
  ),
  // Engenharia — engrenagens + planta
  engineering: (
    <g>
      <rect {...T} x="150" y="52" width="110" height="72" rx="4" />
      <path {...T} d="M164 70h82M164 86h82M164 102h54" />
      <g {...S} transform="translate(96 88)">
        <circle r="26" />
        <circle r="9" />
        <path d="M0-34v10M0 24v10M-34 0h10M24 0h10M-24-24l7 7M17 17l7 7M24-24l-7 7M-17 17l-7 7" />
      </g>
      <circle cx="96" cy="88" r="9" fill={AMBER} opacity=".9" />
    </g>
  ),
  // Equipamentos — gerador com louvers e manómetro
  equipment: (
    <g>
      <rect {...S} x="60" y="60" width="140" height="60" rx="6" />
      <path {...T} d="M74 74h60M74 86h60M74 98h60M74 110h40" />
      <circle {...S} cx="176" cy="90" r="18" />
      <path {...S} d="M176 90l10-8" />
      <circle cx="176" cy="90" r="3" fill={AMBER} />
      <rect {...S} x="86" y="120" width="16" height="10" />
      <rect {...S} x="158" y="120" width="16" height="10" />
    </g>
  ),
  // Formação & Certificação — medalha com fitas + diploma
  certification: (
    <g>
      <rect {...T} x="176" y="52" width="72" height="86" rx="4" />
      <path {...T} d="M190 70h44M190 84h44M190 98h30" />
      <circle {...S} cx="112" cy="72" r="30" />
      <path {...S} d="M112 60l6 12 13 1-10 9 3 13-12-7-12 7 3-13-10-9 13-1z" fill={AMBER} stroke="none" opacity=".95" />
      <path {...S} d="M96 98l-10 40 26-14 26 14-10-40" />
    </g>
  ),
  // Materiais — tubos empilhados (pirâmide)
  materials: (
    <g>
      <g {...S}>
        <ellipse cx="104" cy="104" rx="20" ry="22" />
        <ellipse cx="148" cy="104" rx="20" ry="22" />
        <ellipse cx="192" cy="104" rx="20" ry="22" />
        <ellipse cx="126" cy="66" rx="20" ry="22" />
        <ellipse cx="170" cy="66" rx="20" ry="22" />
      </g>
      <ellipse cx="148" cy="104" rx="9" ry="10" fill={AMBER} opacity=".85" />
    </g>
  ),
  // Offshore — plataforma sobre a linha de água
  offshore: (
    <g>
      <path {...T} d="M32 122c30-6 60 6 90 2s90-10 156-2" />
      <rect {...S} x="96" y="74" width="128" height="16" rx="2" />
      <path {...S} d="M108 90v28M212 90v28M140 90v22M180 90v22" />
      <path {...S} d="M150 74l10-30 10 30M156 56h8" />
      <rect x="96" y="74" width="128" height="6" fill={AMBER} opacity=".7" />
    </g>
  ),
  // Consultoria — painel com gráfico
  consulting: (
    <g>
      <rect {...S} x="66" y="50" width="188" height="86" rx="6" />
      <line {...T} x1="84" y1="118" x2="236" y2="118" />
      <rect {...S} x="98" y="94" width="18" height="24" />
      <rect {...S} x="130" y="78" width="18" height="40" />
      <rect x="162" y="88" width="18" height="30" fill={AMBER} opacity=".85" stroke="none" />
      <rect {...S} x="194" y="70" width="18" height="48" />
      <polyline {...T} points="98,86 140,72 172,80 208,60" />
    </g>
  ),
  box: (
    <g>
      <path {...S} d="M160 40l60 32v40l-60 32-60-32V72z" />
      <path {...S} d="M100 72l60 32 60-32M160 104v72" />
      <path d="M160 40l60 32-60 32-60-32z" fill={AMBER} opacity=".2" />
    </g>
  ),
};

export default function CategoryArt({ category, imageUrl, alt = '' }) {
  const vis = categoryVisual(category);
  if (imageUrl) {
    return <img className="mk-photo" src={imageUrl} alt={alt} loading="lazy" />;
  }
  const scene = SCENES[vis.icon] || SCENES.box;
  return (
    <svg className="mk-art" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" role="img" aria-label={category}>
      <defs>
        <linearGradient id={`bg-${vis.icon}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={vis.from} />
          <stop offset="1" stopColor={vis.to} />
        </linearGradient>
        <pattern id={`grid-${vis.icon}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="320" height="150" fill={`url(#bg-${vis.icon})`} />
      <rect width="320" height="150" fill={`url(#grid-${vis.icon})`} />
      {scene}
    </svg>
  );
}
