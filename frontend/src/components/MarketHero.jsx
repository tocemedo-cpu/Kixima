// src/components/MarketHero.jsx
// Banner de boas-vindas do marketplace — cena Oil & Gas (SVG: plataforma
// offshore ao entardecer com flare) + proposta de valor + selos de confiança.
import { Icon } from './icons';
import { useI18n } from '../i18n';

const PROPS = [
  { icon: 'approvals', label: 'Fornecedores Verificados' },
  { icon: 'policy', label: 'Seguro de Execução' },
  { icon: 'payment', label: 'Pagamentos Seguros' },
  { icon: 'truck', label: 'Entrega Garantida' },
];

export default function MarketHero() {
  const { t } = useI18n();
  return (
    <section className="mk-hero">
      <svg className="mk-hero-bg" viewBox="0 0 800 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a1020" />
            <stop offset="0.55" stopColor="#3a1622" />
            <stop offset="1" stopColor="#7a2416" />
          </linearGradient>
          <radialGradient id="sun" cx="72%" cy="70%" r="40%">
            <stop offset="0" stopColor="#f7a13a" stopOpacity="0.7" />
            <stop offset="1" stopColor="#f7a13a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="flare" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd27a" />
            <stop offset="1" stopColor="#e11d2a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="800" height="320" fill="url(#sky)" />
        <rect width="800" height="320" fill="url(#sun)" />
        {/* água */}
        <rect y="232" width="800" height="88" fill="#120a12" opacity="0.55" />
        <g stroke="rgba(247,161,58,.25)" strokeWidth="2">
          <line x1="380" y1="250" x2="700" y2="250" />
          <line x1="420" y1="266" x2="680" y2="266" />
          <line x1="460" y1="282" x2="660" y2="282" />
        </g>
        {/* plataforma offshore */}
        <g fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M120 232V150l60-26 60 26v82" />
          <path d="M120 176h120M150 124V96M138 104h24" />
          <path d="M132 232v-40M168 232v-56M204 232v-40M240 232v-56" />
          <path d="M240 150l40-16v98M240 176h40" />
        </g>
        {/* derrick com flare */}
        <g fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="2.5">
          <path d="M300 232 316 120 332 232M300 232h32M305 196h22M309 168h14" />
        </g>
        <path d="M316 120c14-6 22-20 18-36 10 10 26 12 22 30-2 10-18 16-40 6z" fill="url(#flare)" opacity="0.9" />
      </svg>

      <div className="mk-hero-content">
        <h1 className="mk-hero-title">{t('Bem-vindo à')} <span className="accent">KIXIMA</span></h1>
        <p className="mk-hero-sub">{t('A plataforma de Procurement Garantido para a indústria de Oil & Gas.')}</p>
        <div className="mk-hero-props">
          {PROPS.map((p) => (
            <span key={p.label} className="mk-prop">
              <Icon name={p.icon} size={18} /> {t(p.label)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
