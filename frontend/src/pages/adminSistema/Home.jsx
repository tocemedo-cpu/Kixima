// src/pages/adminSistema/Home.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, StatCard, Loading, ErrorBanner } from '../../components/Common';

export default function AdminHome() {
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/companies').then(setCompanies).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!companies) return <Loading />;

  const pendentes = companies.filter((c) => c.status === 'PENDENTE');
  const aprovadas = companies.filter((c) => c.status === 'APROVADA');

  return (
    <div>
      <PageHeader title="Visão geral" subtitle="Cadastros pendentes, apólices a expirar e empresas ativas." />

      <div className="grid-cols grid-3" style={{ marginBottom: 24 }}>
        <StatCard label="Cadastros pendentes" value={pendentes.length} sub="Aguardando due diligence" />
        <StatCard label="Empresas ativas" value={aprovadas.length} sub="Credenciadas na plataforma" />
        <StatCard label="Total de empresas" value={companies.length} />
      </div>

      {pendentes.length > 0 && (
        <div className="banner" style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid rgba(201,135,31,.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Tem {pendentes.length} cadastro(s) de empresa aguardando due diligence.</span>
          <Link className="btn btn-accent btn-sm" to="/sistema/due-diligence">Rever agora</Link>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 13.5 }}>Apólices</strong>
        <p className="helptext" style={{ marginTop: 8 }}>
          Emita apólices KIXIMA→Cliente e reveja apólices Fornecedor→KIXIMA em{' '}
          <Link to="/sistema/apolices" style={{ color: 'var(--navy-700)', fontWeight: 600 }}>Gestão de Apólices</Link>.
          Alertas de expiração (30 dias) são enviados automaticamente ao Company Admin e Financeiro de cada empresa.
        </p>
      </div>
    </div>
  );
}
