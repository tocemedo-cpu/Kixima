// src/pages/companyAdmin/CompanyDocuments.jsx
// Documentos da Empresa — exclusivo do Company Admin. Lista os documentos de
// credenciamento e as apólices de seguro da empresa (visualizar/descarregar).
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDate } from '../../domain';
import { useI18n } from '../../i18n';

const DOC_LABELS = {
  CERTIDAO_COMERCIAL: 'Certidão Comercial',
  ALVARA_COMERCIAL: 'Alvará Comercial',
  LICENCA_ANPG: 'Licença da ANPG',
};

export default function CompanyDocuments() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user.companyId) api.get(`/api/companies/${user.companyId}`).then(setCompany).catch((e) => setError(e.message));
  }, [user.companyId]);

  if (error) return <div className="empty-state"><h3>{t('Não foi possível carregar')}</h3><p>{error}</p></div>;
  if (!company) return <div className="bz-empty">{t('A carregar…')}</div>;

  const docs = company.documents || [];
  const policies = [...(company.supplierPolicies || []), ...(company.clientPolicies || [])];

  return (
    <div>
      <Crumbs trail={['Perfil da Empresa', 'Documentos da Empresa']} />
      <PageHead title="Documentos da Empresa" subtitle="Documentos de credenciamento e apólices de seguro da sua empresa. Geridos apenas pelo Company Admin." />

      <KpiRow cards={[
        { icon: 'contract', tone: 'info', label: 'Documentos', value: docs.length, sub: 'De credenciamento' },
        { icon: 'policy', tone: 'success', label: 'Apólices', value: policies.length, sub: 'De seguro' },
        { icon: 'shield', tone: company.status === 'APROVADA' ? 'success' : 'pending', label: 'Estado da Empresa', value: company.status === 'APROVADA' ? 'Aprovada' : company.status, sub: 'Credenciamento' },
      ]} />

      <div className="bz-card bz-tablewrap" style={{ marginBottom: 18 }}>
        <div className="ca-panel-title">{t('Documentos de Credenciamento')}</div>
        <table className="bz-table">
          <thead><tr><th>{t('Tipo')}</th><th>{t('Ficheiro')}</th><th>{t('Submetido em')}</th><th></th></tr></thead>
          <tbody>
            {docs.length === 0 ? <tr><td colSpan={4}><EmptyRow>Sem documentos submetidos.</EmptyRow></td></tr>
              : docs.map((d) => (
                <tr key={d.id}>
                  <td><Icon name="contract" size={14} /> {t(DOC_LABELS[d.type] || d.type)}</td>
                  <td className="bz-muted">{d.originalName}</td>
                  <td className="bz-muted">{formatDate(d.createdAt)}</td>
                  <td className="r"><a className="btn btn-ghost btn-sm" href={d.fileUrl} target="_blank" rel="noreferrer">{t('Ver / Descarregar')}</a></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="bz-card bz-tablewrap">
        <div className="ca-panel-title">{t('Apólices de Seguro')}</div>
        <table className="bz-table">
          <thead><tr><th>{t('Nº da Apólice')}</th><th>{t('Seguradora')}</th><th>{t('Validade')}</th><th>{t('Estado')}</th></tr></thead>
          <tbody>
            {policies.length === 0 ? <tr><td colSpan={4}><EmptyRow>Sem apólices registadas.</EmptyRow></td></tr>
              : policies.map((p) => (
                <tr key={p.id}>
                  <td><span className="bz-mono">{p.policyNumber}</span></td>
                  <td>{p.insurer}</td>
                  <td className="bz-muted">{formatDate(p.validFrom)} — {formatDate(p.validUntil)}</td>
                  <td><Pill tone={p.status === 'APROVADA' ? 'success' : 'pending'}>{p.status || '—'}</Pill></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
