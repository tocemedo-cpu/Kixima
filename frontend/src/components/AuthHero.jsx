// src/components/AuthHero.jsx
// Painel lateral (hero) partilhado pelas telas de Login e Cadastro.
// A imagem de fundo e o logótipo são carregados de ficheiros LOCAIS em
// public/images/ — para os trocar basta substituir esses ficheiros, sem alterar
// código. Sem Base64, sem imagens remotas, sem placeholders.
//   Fundo:    /images/login-background.jpg
//   Logótipo: /images/kixima-logo.png
import { Icon } from './icons';
import { useI18n } from '../i18n';

const FEATURES = [
  { icon: 'policy', label: 'Transparência total' },
  { icon: 'certification', label: 'Conformidade garantida' },
  { icon: 'chart', label: 'Processos eficientes' },
  { icon: 'approvals', label: 'Rede qualificada e verificada' },
];

export default function AuthHero() {
  const { t } = useI18n();

  return (
    <div className="login-hero auth-hero">
      <div className="auth-hero-top">
        <img className="auth-hero-logo" src="/images/kixima-logo.png" alt="KIXIMA" />
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
