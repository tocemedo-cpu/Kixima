// src/components/Badge.jsx
// Selo de estado. Traduz automaticamente children quando é uma string simples
// (é por aqui que passam os rótulos de estado de PO/fatura/empresa/apólice).
import { useI18n } from '../i18n';

export default function Badge({ tone = 'neutral', children }) {
  const { t } = useI18n();
  return <span className={`badge badge-${tone}`}>{typeof children === 'string' ? t(children) : children}</span>;
}
