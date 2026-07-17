// src/pages/companyAdmin/Home.jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, StatCard, Loading, ErrorBanner } from '../../components/Common';
import { POLICY_STATUS, formatDate } from '../../domain';
import Badge from '../../components/Badge';

export default function CompanyAdminHome() {
  const { user } = useAuth();
  const [orders, setOrders] = useState(null);
  const [policies, setPolicies] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/purchase-orders'),
      api.get(`/api/policies/company/${user.companyId}`),
    ])
      .then(([o, p]) => {
        setOrders(o);
        setPolicies(p);
      })
      .catch((e) => setError(e.message));
  }, [user.companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!orders || !policies) return <Loading />;

  const pendentes = orders.filter((o) => o.status === 'AGUARDANDO_APROVACAO');
  const clientPolicy = policies.kiximaToClient?.[0];

  return (
    <div>
      <PageHeader title="Visão geral da empresa" subtitle="POs pendentes de aprovação, utilizadores e apólice ativa." />

      <div className="grid-cols grid-3" style={{ marginBottom: 24 }}>
        <StatCard label="POs a aprovar" value={pendentes.length} sub="Ponto único de aprovação" />
        <StatCard label="POs totais" value={orders.length} />
        <StatCard
          label="Apólice KIXIMA→Cliente"
          value={clientPolicy ? <Badge tone={POLICY_STATUS[clientPolicy.status]?.tone}>{POLICY_STATUS[clientPolicy.status]?.label}</Badge> : '—'}
          sub={clientPolicy ? `Válida até ${formatDate(clientPolicy.validUntil)}` : 'Nenhuma apólice registada'}
        />
      </div>

      {pendentes.length > 0 && (
        <div className="banner banner-error" style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid rgba(201,135,31,.25)' }}>
          Tem {pendentes.length} PO(s) aguardando a sua aprovação.
        </div>
      )}
    </div>
  );
}
