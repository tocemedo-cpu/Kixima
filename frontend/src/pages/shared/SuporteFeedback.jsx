// src/pages/shared/SuporteFeedback.jsx
// Suporte → Feedback — a única forma de avaliar a KIXIMA passou a ser aqui,
// autenticado (nunca anónimo, ver feedbackService.js/CorporateHome.jsx). O
// dropdown de "sobre o que é" só mostra alvos reais do histórico da empresa
// (GET /api/feedback/opcoes) — nunca um campo de texto livre a inventar a
// que se refere a avaliação.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner, Field } from '../../components/Common';
import { Pill, EmptyRow } from '../../components/BuyerUI';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

const CATEGORIAS = [
  { value: 'EXPERIENCIA_GERAL', label: 'Experiência geral' },
  { value: 'FORNECEDOR', label: 'Fornecedor / Empresa' },
  { value: 'PRODUTO', label: 'Produto' },
  { value: 'SERVICO', label: 'Serviço' },
  { value: 'PEDIDO', label: 'Pedido' },
  { value: 'ENTREGA', label: 'Entrega' },
  { value: 'PAGAMENTO', label: 'Pagamento' },
  { value: 'ATENDIMENTO', label: 'Atendimento' },
];

function StarPicker({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="feedback-star-picker" role="radiogroup" aria-label={t('Classificação')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" role="radio" aria-checked={value === n}
          className={`feedback-star-btn${n <= value ? ' on' : ''}`}
          onClick={() => onChange(n)}
        >★</button>
      ))}
    </div>
  );
}

export default function SuporteFeedback() {
  const { t } = useI18n();
  const [opcoes, setOpcoes] = useState(null);
  const [minhas, setMinhas] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [categoria, setCategoria] = useState('EXPERIENCIA_GERAL');
  const [targetId, setTargetId] = useState('');
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');

  function carregarMinhas() {
    api.get('/api/feedback/minhas').then(setMinhas).catch((e) => setError(e.message));
  }

  useEffect(() => {
    api.get('/api/feedback/opcoes').then(setOpcoes).catch((e) => setError(e.message));
    carregarMinhas();
  }, []);

  const alvos = opcoes?.[categoria] || [];

  function mudarCategoria(v) {
    setCategoria(v);
    setTargetId('');
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (categoria !== 'EXPERIENCIA_GERAL' && !targetId) {
      setError(t('Escolha a que se refere esta avaliação.'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/feedback', {
        categoria,
        targetId: categoria === 'EXPERIENCIA_GERAL' ? undefined : targetId,
        rating,
        message,
      });
      setSuccess(t('Obrigado! A sua avaliação foi recebida e será publicada depois de revista.'));
      setCategoria('EXPERIENCIA_GERAL'); setTargetId(''); setRating(5); setMessage('');
      carregarMinhas();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!opcoes || !minhas) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Feedback"
        subtitle="Avalie a sua experiência com um fornecedor, produto, serviço, pedido, entrega, pagamento ou atendimento — ou deixe uma experiência geral. Cada avaliação é revista antes de ser publicada na homepage."
      />
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="card card-pad" style={{ marginBottom: 24, maxWidth: 620 }}>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label={t('Sobre o que é')} style={{ flex: 1 }}>
              {(id) => (
                <select id={id} value={categoria} onChange={(e) => mudarCategoria(e.target.value)}>
                  {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
                </select>
              )}
            </Field>
            {categoria !== 'EXPERIENCIA_GERAL' ? (
              <Field label={t('Qual')} style={{ flex: 1.4 }}>
                {(id) => (
                  <select id={id} value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={alvos.length === 0}>
                    <option value="">{alvos.length === 0 ? t('— nada disponível ainda —') : t('— escolher —')}</option>
                    {alvos.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                )}
              </Field>
            ) : null}
          </div>
          {categoria !== 'EXPERIENCIA_GERAL' && alvos.length === 0 ? (
            <p className="helptext" style={{ marginTop: -6 }}>{t('Ainda não há histórico real nesta categoria para a sua empresa.')}</p>
          ) : null}

          <Field label={t('Classificação')}>
            {() => <StarPicker value={rating} onChange={setRating} />}
          </Field>

          <Field label={t('A sua experiência')}>
            {(id) => <textarea id={id} required rows={4} maxLength={700} value={message} onChange={(e) => setMessage(e.target.value)} />}
          </Field>

          <button className="btn btn-accent" type="submit" disabled={saving}>{saving ? t('A enviar…') : t('Enviar avaliação')}</button>
        </form>
      </div>

      <h3 style={{ margin: '18px 0 10px' }}>{t('As minhas avaliações')}</h3>
      <div className="bz-card">
        <div className="bz-scroll-x">
          <table className="bz-table">
            <thead>
              <tr>
                <th>{t('Data')}</th>
                <th>{t('Categoria')}</th>
                <th>{t('Relacionado a')}</th>
                <th>{t('Classificação')}</th>
                <th>{t('Comentário')}</th>
                <th>{t('Estado')}</th>
              </tr>
            </thead>
            <tbody>
              {minhas.length === 0 ? (
                <tr><td colSpan={6}><EmptyRow>{t('Ainda não enviou nenhuma avaliação.')}</EmptyRow></td></tr>
              ) : minhas.map((f) => (
                <tr key={f.id}>
                  <td>{formatDateTime(f.createdAt)}</td>
                  <td>{t(CATEGORIAS.find((c) => c.value === f.categoria)?.label || f.categoria)}</td>
                  <td>{f.targetLabel || '—'}</td>
                  <td>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</td>
                  <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{f.message}</td>
                  <td><Pill tone={f.approved ? 'success' : 'pending'}>{f.approved ? 'Aprovada' : 'Por rever'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
