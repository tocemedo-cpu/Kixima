// src/components/AuthHero.jsx
// Painel lateral (hero) partilhado pelas telas de Login e Cadastro. Reproduz o
// layout do mockup: plataforma petrolífera ao pôr-do-sol, logótipo, título de
// impacto, subtítulo e quatro selos de confiança. A fotografia é opcional — se
// colocares public/hero-rig.jpg ela é usada como fundo; caso contrário mostra
// um pôr-do-sol em degradê com a silhueta de uma plataforma offshore (SVG), por
// isso nunca fica sem imagem nem inventa uma foto falsa.
import { useState } from 'react';
import Logo from './Logo';
import { Icon } from './icons';
import { useI18n } from '../i18n';

const FEATURES = [
  { icon: 'policy', label: 'Transparência total' },
  { icon: 'certification', label: 'Conformidade garantida' },
  { icon: 'chart', label: 'Processos eficientes' },
  { icon: 'approvals', label: 'Rede qualificada e verificada' },
];

function RigSilhouette() {
  // Silhueta de uma plataforma offshore + navio, para o hero nunca ficar vazio.
  return (
    <svg className="auth-hero-rig" viewBox="0 0 800 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g fill="#0b0f16" opacity="0.92">
        {/* mar */}
        <rect x="0" y="250" width="800" height="70" />
        {/* navio à esquerda */}
        <path d="M40 244h120l-14 14H54z" />
        <rect x="86" y="228" width="10" height="16" />
        {/* plataforma principal */}
        <rect x="470" y="238" width="240" height="12" />
        <path d="M486 238l14-70h180l14 70z" />
        {/* torre de perfuração */}
        <path d="M560 168l30-120 30 120z" fill="none" stroke="#0b0f16" strokeWidth="6" />
        <path d="M572 128h36M566 100h48M560 72h60" stroke="#0b0f16" strokeWidth="5" />
        {/* pernas */}
        <rect x="500" y="250" width="9" height="70" />
        <rect x="560" y="250" width="9" height="70" />
        <rect x="620" y="250" width="9" height="70" />
        <rect x="680" y="250" width="9" height="70" />
        {/* guindaste */}
        <path d="M498 168l-46 30" stroke="#0b0f16" strokeWidth="6" fill="none" />
      </g>
    </svg>
  );
}

export default function AuthHero() {
  const { t } = useI18n();
  const [photoOk, setPhotoOk] = useState(true);

  return (
    <div className="login-hero auth-hero">
      <div className="auth-hero-bg" aria-hidden="true">
        {photoOk ? (
          <img className="auth-hero-photo" src="/hero-rig.jpg" alt="" onError={() => setPhotoOk(false)} />
        ) : (
          <RigSilhouette />
        )}
        <span className="auth-hero-scrim" />
      </div>

      <div className="auth-hero-top">
        <Logo size={30} mark={64} subtitle light />
      </div>

      <div className="auth-hero-mid">
        <h1 className="auth-hero-title">{t('Due diligence uma vez.')} <span className="accent">{t('Confiança em cada transação.')}</span></h1>
        <p className="auth-hero-sub">{t('Conectamos operadoras, fornecedores e prestadores de serviços num ecossistema seguro, transparente e auditável.')}</p>
      </div>

      <div className="auth-hero-feats">
        {FEATURES.map((f) => (
          <div className="auth-feat" key={f.label}>
            <span className="auth-feat-ico"><Icon name={f.icon} size={20} /></span>
            <span className="auth-feat-label">{t(f.label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
