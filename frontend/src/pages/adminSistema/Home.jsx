// src/pages/adminSistema/Home.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, StatCard, Loading, ErrorBanner } from '../../components/Common';
import { useI18n } from '../../i18n';

export default function AdminHome() {
  const { t } = useI18n();
  const [companies, setCompanies] = useState(null);
  const [error, setError] = useState('');
  const [semAcesso, setSemAcesso] = useState(false);

  useEffect(() => {
    api.get('/api/companies').then(setCompanies).catch((e) => {
      // Um 403 aqui não é uma falha — é um assessor cuja área não inclui
      // Cadastro & Empresas. Este painel é inteiro sobre isso (cadastros
      // pendentes, empresas ativas); mostrar o banner de erro vermelho da
      // aplicação assustaria alguém a fazer exatamente o que devia — entrar
      // com a conta que lhe foi dada.
      if (e.status === 403) setSemAcesso(true);
      else setError(e.message);
    });
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (semAcesso) {
    return (
      <div>
        <PageHeader title="Visão geral" subtitle="Cadastros pendentes, apólices a expirar e empresas ativas." />
        <div className="card card-pad">
          <strong style={{ fontSize: 13.5 }}>{t('Sem acesso a Cadastro & Empresas')}</strong>
          <p className="helptext" style={{ marginTop: 8 }}>
            {t('O seu acesso não inclui esta área. Veja no menu à esquerda as páginas que já pode usar.')}
          </p>
        </div>
      </div>
    );
  }
  if (!companies) return <Loading />;

  const pendentes = companies.filter((c) => c.status === 'PENDENTE');
  const aprovadas = companies.filter((c) => c.status === 'APROVADA');

  return (
    <div>
      <PageHeader title="Visão geral" subtitle="Cadastros pendentes, apólices a expirar e empresas ativas." />

      <div className="grid-cols grid-3" style={{ marginBottom: 24 }}>
        {/* "12 cadastros pendentes" é um convite a agir; sem ligação, é só um
            número que obriga a procurar o menu. */}
        <StatCard label="Cadastros pendentes" value={pendentes.length} sub="Aguardando due diligence" to="/sistema/due-diligence" />
        <StatCard label="Empresas ativas" value={aprovadas.length} sub="Credenciadas na plataforma" to="/sistema/empresas" />
        <StatCard label="Total de empresas" value={companies.length} to="/sistema/empresas" />
      </div>

      {pendentes.length > 0 && (
        <div className="banner" style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid rgba(201,135,31,.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('Tem {n} cadastro(s) de empresa aguardando due diligence.', { n: pendentes.length })}</span>
          <Link className="btn btn-accent btn-sm" to="/sistema/due-diligence">{t('Rever agora')}</Link>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 13.5 }}>{t('Apólices')}</strong>
        <p className="helptext" style={{ marginTop: 8 }}>
          {t('Emita apólices KIXIMA→Cliente e reveja apólices Fornecedor→KIXIMA em')}{' '}
          <Link to="/sistema/apolices" style={{ color: 'var(--brand-600)', fontWeight: 600 }}>{t('Gestão de Apólices')}</Link>.
          {' '}{t('Alertas de expiração (30 dias) são enviados automaticamente ao Company Admin e Financeiro de cada empresa.')}
        </p>
      </div>
    </div>
  );
}
