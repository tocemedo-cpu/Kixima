// src/pages/adminSistema/Avaliacoes.jsx
// Moderação das avaliações públicas da homepage ("Avaliações Verificadas").
// Ninguém vê uma avaliação na home sem passar por aqui — a submissão
// (Suporte → Feedback, dentro da app, sempre autenticada) grava sempre com
// approved=false; esta página é a única forma de a aprovar (ou remover).
// Nome/empresa vêm sempre da conta que submeteu (nunca texto livre), e a
// categoria + "relacionado a" mostram o alvo real (fornecedor, produto,
// pedido…) validado no momento da submissão — ver feedbackService.js.
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

const CATEGORIA_LABEL = {
  FORNECEDOR: 'Fornecedor / Empresa',
  PRODUTO: 'Produto',
  SERVICO: 'Serviço',
  PEDIDO: 'Pedido',
  ENTREGA: 'Entrega',
  PAGAMENTO: 'Pagamento',
  ATENDIMENTO: 'Atendimento',
  EXPERIENCIA_GERAL: 'Experiência geral',
};

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
      setAviso(t('Avaliação de {nome} ({empresa}) aprovada — já é visível na homepage.', { nome: f.user.name, empresa: f.company.name }));
      carregar();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function remover(f) {
    const ok = window.confirm(t('Remover a avaliação de {nome} ({empresa})? Não fica registo — se aprovada, também sai da homepage.', { nome: f.user.name, empresa: f.company.name }));
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
        subtitle="O que é submetido em Suporte → Feedback por utilizadores autenticados fica aqui até ser revisto. Só o que aprovar aparece na homepage ('Avaliações Verificadas')."
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
                <th>{t('Categoria')}</th>
                <th>{t('Relacionado a')}</th>
                <th>{t('Classificação')}</th>
                <th>{t('Mensagem')}</th>
                <th>{t('Verificado')}</th>
                <th>{t('Estado')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={10}><EmptyRow>{t('A carregar…')}</EmptyRow></td></tr>
              ) : itens.length === 0 ? (
                <tr><td colSpan={10}><EmptyRow>{t('Nenhuma avaliação neste estado.')}</EmptyRow></td></tr>
              ) : itens.map((f) => (
                <tr key={f.id}>
                  <td>{formatDateTime(f.createdAt)}</td>
                  <td>{f.user.name}</td>
                  <td>{f.company.name}</td>
                  <td>{t(CATEGORIA_LABEL[f.categoria] || f.categoria)}</td>
                  <td>{f.targetLabel || '—'}</td>
                  <td>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                  <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{f.message}</td>
                  <td>{f.verified ? <Pill tone="success">✓ {t('Verificado')}</Pill> : '—'}</td>
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
