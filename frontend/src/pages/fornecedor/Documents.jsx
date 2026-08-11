// src/pages/fornecedor/Documents.jsx
// Documentação do fornecedor. Reúne os documentos técnicos dos produtos (ficha
// técnica, certificado, catálogo, etc.) e os documentos de credenciamento da
// empresa (alvará, licença ANPG, certidão). A vista adapta-se ao submenu ativo.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner } from '../../components/Common';
import { Icon } from '../../components/icons';
import { useI18n } from '../../i18n';

const PRODUCT_DOC_LABELS = {
  FICHA_TECNICA: 'Ficha Técnica', DATASHEET: 'Datasheet', MANUAL: 'Manual',
  CATALOGO: 'Catálogo PDF', CERTIFICADO: 'Certificado', DESENHO_TECNICO: 'Desenho Técnico',
};
const COMPANY_DOC_LABELS = {
  CERTIDAO_COMERCIAL: 'Certidão Comercial', ALVARA_COMERCIAL: 'Alvará Comercial', LICENCA_ANPG: 'Licença da ANPG',
};

// Submenu (último segmento da rota) -> o que mostrar.
const VIEWS = {
  certificacoes: { title: 'Certificações', kind: 'product', types: ['CERTIFICADO'] },
  catalogos: { title: 'Catálogos PDF', kind: 'product', types: ['CATALOGO'] },
  fichas: { title: 'Fichas Técnicas', kind: 'product', types: ['FICHA_TECNICA'] },
  licencas: { title: 'Licenças & Alvarás', kind: 'company' },
};

export default function Documents() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const seg = pathname.split('/').filter(Boolean).pop();
  const view = VIEWS[seg] || { title: 'Documentação', kind: 'all' };

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/catalog/documents').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <Loading />;

  // Filtra os documentos de produto conforme a vista.
  let productDocs = data.productDocs || [];
  if (view.kind === 'product') productDocs = productDocs.filter((d) => view.types.includes(d.type));
  if (view.kind === 'company') productDocs = [];
  const companyDocs = view.kind === 'product' ? [] : (data.companyDocs || []);

  const empty = productDocs.length === 0 && companyDocs.length === 0;

  return (
    <div>
      <PageHeader
        title={`Documentação — ${view.title}`}
        subtitle="Todos os documentos técnicos dos seus produtos e o credenciamento da empresa num só sítio."
      />

      {empty ? (
        <div className="empty-state">
          <div style={{ color: 'var(--brand-600)', marginBottom: 10 }}><Icon name="contract" size={30} /></div>
          <h3>{t('Sem documentos nesta secção')}</h3>
          <p>{t('Anexe documentos ao publicar/editar produtos (aba Documentos) ou no cadastro da empresa.')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {companyDocs.length > 0 && (
            <DocSection title={t('Documentos da empresa')}>
              {companyDocs.map((d) => (
                <DocLink key={d.id} href={d.fileUrl} label={t(COMPANY_DOC_LABELS[d.type] || d.type)} name={d.originalName} />
              ))}
            </DocSection>
          )}
          {productDocs.length > 0 && (
            <DocSection title={t('Documentos de produtos')}>
              {productDocs.map((d) => (
                <DocLink
                  key={d.id}
                  href={d.fileUrl}
                  label={t(PRODUCT_DOC_LABELS[d.type] || d.type)}
                  name={d.originalName}
                  meta={d.productName}
                />
              ))}
            </DocSection>
          )}
        </div>
      )}
    </div>
  );
}

function DocSection({ title, children }) {
  return (
    <div className="card">
      <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}><strong>{title}</strong></div>
      <div className="card-pad"><div className="doc-list">{children}</div></div>
    </div>
  );
}

function DocLink({ href, label, name, meta }) {
  return (
    <a className="doc-item" href={href} target="_blank" rel="noreferrer">
      <Icon name="invoice" size={16} className="doc-ic" />
      <span>{label}{meta ? <span style={{ color: 'var(--ink-400)' }}> · {meta}</span> : null}</span>
      <span className="doc-name">{name}</span>
    </a>
  );
}
