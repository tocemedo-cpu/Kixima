// src/pages/adminSistema/Avaliacoes.jsx
// Moderação das avaliações públicas da homepage ("Avaliações Verificadas").
// Ninguém vê uma avaliação na home sem passar por aqui — o formulário público
// (CorporateHome.jsx) grava sempre com approved=false; esta página é a única
// forma de a aprovar (ou remover) e é por isso que precisa de existir: sem
// ela, tudo o que é submetido fica para sempre pendente e invisível.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, Pill, Tabs, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

const STATUS_TABS = [
  { key: 'pendente', label: 'Por rever' },
  { key: 'aprovado', label: 'Aprovadas' },
  { key: '', label: 'Todas' },
];

export default function Avaliacoes() {
  const { t } = useI18n();
  const [tab, setTab] = useState('pendente');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busy, setBusy] = useState('');

  const carregar = useCallback(() => {
    setError('');
    api.get('/api/admin/feedback', { status: tab || undefined }).then(setData).catch((e) => setError(e.message));
  }, [tab]);
  useEffect(carregar, [carregar]);

  async function aprovar(f) {
    setBusy(f.id); setError(''); setAviso('');
    try {
      await api.patch(`/api/admin/feedback/${f.id}/aprovar`);
      setAviso(t('Avaliação de {nome} ({empresa}) aprovada — já é visível na homepage.', { nome: f.name, empresa: f.company }));
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function remover(f) {
    const ok = window.confirm(t('Remover a avaliação de {nome} ({empresa})? Não fica registo — se aprovada, também sai da homepage.', { nome: f.name, empresa: f.company }));
    if (!ok) return;
    setBusy(f.id); setError('');
    try {
      await api.del(`/api/admin/feedback/${f.id}`);
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const itens = data?.itens || [];

  return (
    <div>
      <Crumbs trail={['Suporte', 'Avaliações']} />
      <PageHead
        title="Avaliações"
        subtitle="O que é submetido no formulário da homepage ('Avaliações Verificadas') fica aqui até ser revisto. Só o que aprovar aparece publicamente."
      />

      {error ? <ErrorBanner message={error} /> : null}
      {aviso ? <SuccessBanner message={aviso} /> : null}

      <Tabs tabs={STATUS_TABS} value={tab} onChange={setTab} />

      <div className="bz-card">
        <div className="bz-scroll-x">
          <table className="bz-table">
            <thead>
              <tr>
                <th>{t('Submetida em')}</th>
                <th>{t('Nome')}</th>
                <th>{t('Empresa')}</th>
                <th>{t('Perfil')}</th>
                <th>{t('Classificação')}</th>
                <th>{t('Mensagem')}</th>
                <th>{t('Estado')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={8}><EmptyRow>{t('A carregar…')}</EmptyRow></td></tr>
              ) : itens.length === 0 ? (
                <tr><td colSpan={8}><EmptyRow>{t('Nenhuma avaliação neste estado.')}</EmptyRow></td></tr>
              ) : itens.map((f) => (
                <tr key={f.id}>
                  <td>{formatDateTime(f.createdAt)}</td>
                  <td>{f.name}</td>
                  <td>{f.company}</td>
                  <td>{t(f.role)}</td>
                  <td>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                  <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{f.message}</td>
                  <td><Pill tone={f.approved ? 'success' : 'pending'}>{f.approved ? 'Aprovada' : 'Por rever'}</Pill></td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {!f.approved ? (
                      <button className="btn btn-accent btn-sm" disabled={busy === f.id} onClick={() => aprovar(f)}>
                        {t('Aprovar')}
                      </button>
                    ) : null}
                    <button className="btn btn-ghost btn-sm" disabled={busy === f.id} onClick={() => remover(f)}>
                      {t('Remover')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
