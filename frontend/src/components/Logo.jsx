// src/components/Logo.jsx
// Marca KIXIMA — o mesmo emblema usado no site corporativo (ver
// pages/corporate/CorporateChrome.jsx), agora como logótipo oficial de toda
// a plataforma (sidebar, topbar, login, cadastro, convites, etc.). Os dois
// ficheiros (normal e invertido) vivem em src/assets/brand/ e são
// partilhados por ambos — nunca duplicados.
import { useI18n } from '../i18n';
import kiximaMark from '../assets/brand/kixima-mark.png';
import kiximaMarkReversed from '../assets/brand/kixima-mark-reversed.png';

export default function Logo({ size = 22, subtitle = false, light = false, mark }) {
  const { t } = useI18n();
  // O logótipo (a marca) fica bem maior que o texto para ser bem visível.
  const box = mark || Math.round(size * 2.4);

  return (
    <div className="brand-logo">
      <span className="brand-mark" style={{ width: box, height: box }} aria-hidden="true">
        <img
          src={light ? kiximaMarkReversed : kiximaMark}
          alt="KIXIMA"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </span>
      <span className="brand-text">
        <span className={`brand-word${light ? ' brand-word-light' : ''}`} style={{ fontSize: size }}>
          KIXIMA
        </span>
        {subtitle ? (
          <span className={`brand-sub${light ? ' brand-sub-light' : ''}`}>{t('Plataforma de Procurement Garantido')}</span>
        ) : null}
      </span>
    </div>
  );
}
