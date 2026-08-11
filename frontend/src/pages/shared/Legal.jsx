// src/pages/shared/Legal.jsx
// Termos de Uso e Política de Privacidade — páginas públicas (folha legível,
// imprimível), no idioma selecionado. O texto vive em legalContent.js, uma
// versão completa por idioma (PT/EN/FR): documentos jurídicos traduzem-se por
// documento inteiro, não por frase solta.
// NOTA: conteúdo-modelo profissional; recomenda-se revisão por advogado por
// idioma antes do lançamento comercial.
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { LEGAL } from './legalContent';

function Section({ n, title, paras }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 14.5, margin: '0 0 6px' }}>{n}. {title}</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {paras.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}

export default function Legal({ kind }) {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const L = LEGAL[lang] || LEGAL.pt;
  const doc = kind === 'privacidade' ? L.privacy : L.terms;

  return (
    <div className="doc-page">
      <div className="doc-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>{L.back}</button>
        <button className="btn btn-accent" onClick={() => window.print()}>{L.print}</button>
      </div>

      <div className="pdoc-sheet">
        <header className="pdoc-head">
          <div className="pdoc-tagline" style={{ fontSize: 15 }}><strong>KIXIMA</strong> {L.tagline}</div>
          <div className="pdoc-tagline">{L.updatedLabel}: {L.updated}</div>
        </header>

        <div className="pdoc-titlebar">
          <h1>{doc.title}</h1>
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          {doc.sections.map((s) => <Section key={s.n} n={s.n} title={s.title} paras={s.paras} />)}
        </div>

        <p className="pdoc-muted no-print" style={{ marginTop: 22, fontSize: 11 }}>
          {L.also} <Link to="/termos">{L.termsLink}</Link> · <Link to="/privacidade">{L.privacyLink}</Link>
        </p>
      </div>
    </div>
  );
}
