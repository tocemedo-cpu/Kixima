// src/pages/companyAdmin/Organization.jsx
// Organização — dados da empresa, contactos e resumo (utilizadores, contratos,
// documentos, certificações). Ligado a /api/company-admin/organizacao.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDate } from '../../domain';

export default function Organization() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/api/company-admin/organizacao').then(setD).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="empty-state"><h3>Não foi possível carregar</h3><p>{error}</p></div>;
  if (!d) return <div className="bz-empty">A carregar…</div>;
  const c = d.company;
  const typeLabel = c.type === 'FORNECEDOR' ? 'Prestadora de Serviços' : 'Empresa Cliente';

  return (
    <div>
      <Crumbs trail={['Organização']} />
      <PageHead title="Organização" subtitle="Dados da empresa, contactos e documentos." />

      <div className="bz-layout">
        <div className="bz-panel">
          <h3>Dados Gerais</h3>
          <table className="bz-table">
            <tbody>
              {[
                ['Nome da Empresa', c.name], ['Tipo de Atuação', typeLabel], ['NIF', c.taxId],
                ['Telefone', c.contactPhone || '—'], ['E-mail Corporativo', c.contactEmail],
                ['Endereço', c.address || '—'], ['Localização', [c.city, c.province, c.country].filter(Boolean).join(', ') || 'Angola'],
                ['Data de Registo', formatDate(c.createdAt)],
              ].map(([k, v]) => (
                <tr key={k}><td className="bz-muted" style={{ width: 200 }}>{k}</td><td><strong>{v}</strong></td></tr>
              ))}
              <tr><td className="bz-muted">Estado</td><td><Pill tone={c.status === 'APROVADA' ? 'success' : 'pending'}>{c.status === 'APROVADA' ? 'Ativa' : c.status}</Pill> {c.verified ? <Pill tone="success">Verificada</Pill> : null}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bz-side">
          <div className="bz-panel">
            <h3>Informações de Contacto</h3>
            <div className="pf-info"><Icon name="policy" size={15} /> <span>{c.contactEmail}</span></div>
            <div className="pf-info"><Icon name="building" size={15} /> <span>{c.contactPhone || '—'}</span></div>
            <div className="pf-info"><Icon name="offshore" size={15} /> <span>{c.address || [c.city, c.country].filter(Boolean).join(', ') || 'Angola'}</span></div>
          </div>
        </div>
      </div>

      <h3 className="pf-h2">Resumo da Organização</h3>
      <div className="hs-quick">
        {[
          { icon: 'users', t: d.summary.users, s: 'Usuários' },
          { icon: 'contract', t: d.summary.contracts, s: 'Contratos' },
          { icon: 'reception', t: d.summary.documents, s: 'Documentos' },
          { icon: 'certification', t: d.summary.certifications, s: 'Certificações/Apólices' },
        ].map((x) => (
          <div className="hs-quickcard" key={x.s}>
            <span className="hs-quick-ico"><Icon name={x.icon} size={18} /></span>
            <div><strong style={{ fontSize: 20 }}>{x.t}</strong><span className="bz-sub2">{x.s}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
