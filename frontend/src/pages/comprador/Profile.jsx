// src/pages/comprador/Profile.jsx
// Perfil (item 12) — dados do utilizador, resumo da conta, atividade recente e
// informações da empresa. Ligado a /api/buyer/profile.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Pill } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { PO_STATUS, ROLE_LABELS, formatMoney, formatDateTime } from '../../domain';

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
}

export default function Profile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/buyer/profile').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="empty-state"><h3>Não foi possível carregar</h3><p>{error}</p></div>;
  if (!data) return <div className="bz-empty">A carregar…</div>;

  const { user, company, summary, recent } = data;
  return (
    <div>
      <Crumbs trail={['Home', 'Perfil']} />
      <PageHead title="Meu Perfil" subtitle="Gerencie as suas informações pessoais, preferências e configurações da sua conta." />

      <div className="pf-top">
        <div className="bz-panel pf-id">
          <div className="pf-avatar">{initials(user.name)}</div>
          <div>
            <div className="pf-name">{user.name} <Pill tone="success">Ativo</Pill></div>
            <div className="pf-role">{ROLE_LABELS[user.role] || user.role}</div>
            <div className="pf-company">{company?.name}</div>
          </div>
        </div>

        <div className="bz-panel">
          <h3>Contacto</h3>
          <div className="pf-info"><Icon name="policy" size={15} /> <span>{user.email}</span></div>
          <div className="pf-info"><Icon name="building" size={15} /> <span>{company?.contactPhone || '—'}</span></div>
          <div className="pf-info"><Icon name="offshore" size={15} /> <span>{[company?.city, company?.country].filter(Boolean).join(', ') || 'Angola'}</span></div>
          <div className="pf-info"><Icon name="wallet" size={15} /> <span>Kwanza (Kz)</span></div>
        </div>

        <div className="bz-panel">
          <h3>Segurança da Conta</h3>
          <div className="bz-panel-row"><span>Palavra-passe</span><a className="pf-link" href="/seguranca">Alterar</a></div>
          <div className="bz-panel-row"><span>Autenticação em duas etapas</span><span className="bz-muted">Configurar</span></div>
          <div className="bz-panel-row"><span>Conta criada</span><strong>{formatDateTime(user.createdAt)}</strong></div>
        </div>
      </div>

      <h2 className="pf-h2">Resumo da Conta</h2>
      <KpiRow cards={[
        { icon: 'orders', tone: 'info', label: 'Ordens de Compra', value: summary.ordersYear, sub: 'Este ano' },
        { icon: 'payment', tone: 'success', label: 'Valor Total Comprado', value: formatMoney(summary.totalBought), sub: 'Este ano' },
        { icon: 'suppliers', tone: 'info', label: 'Fornecedores', value: summary.suppliers, sub: 'Com transações' },
        { icon: 'reception', tone: 'pending', label: 'Itens Recebidos', value: summary.itemsReceived, sub: 'Total' },
      ]} />

      <div className="bz-layout">
        <div className="bz-panel">
          <h3>Atividade Recente</h3>
          {recent.length === 0 ? <p className="bz-sub">Sem atividade recente.</p> : (
            <table className="bz-table" style={{ marginTop: 4 }}>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.reference}>
                    <td><span className="bz-mono">{r.reference}</span><span className="bz-sub2">{r.supplier}</span></td>
                    <td><Pill tone={PO_STATUS[r.status]?.tone}>{PO_STATUS[r.status]?.label || r.status}</Pill></td>
                    <td className="r bz-muted">{formatDateTime(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bz-side">
          <div className="bz-panel">
            <h3>Informações da Empresa</h3>
            <div className="bz-panel-row"><span>Empresa</span><strong>{company?.name}</strong></div>
            <div className="bz-panel-row"><span>NIF</span><strong>{company?.taxId}</strong></div>
            <div className="bz-panel-row"><span>Endereço</span><strong>{company?.address || '—'}</strong></div>
            <div className="bz-panel-row"><span>Estado</span><Pill tone="success">Aprovada</Pill></div>
          </div>
        </div>
      </div>
    </div>
  );
}
