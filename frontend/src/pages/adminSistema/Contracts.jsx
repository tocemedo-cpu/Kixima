// src/pages/adminSistema/Contracts.jsx
// Gestão de contratos-quadro pelo Admin do Sistema KIXIMA. Lista os contratos
// existentes e permite criar novos — a partir daí, qualquer PO do cliente para
// o fornecedor coberto passa a ser automaticamente um Call-off (deteção em
// poService.createPurchaseOrder).
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner , Field } from '../../components/Common';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { CONTRACT_STATUS, BILLING_PERIODICITY, formatMoney, formatDate } from '../../domain';
import { useI18n } from '../../i18n';
import Button from '../../components/Button';

const EMPTY_FORM = {
  clientCompanyId: '',
  supplierCompanyId: '',
  categoriesCovered: '',
  totalValue: '',
  currency: 'AOA',
  billingPeriodicity: 'TRIMESTRAL',
  paymentTermDays: '30',
  validFrom: '',
  validUntil: '',
};

export default function Contracts() {
  const { t } = useI18n();
  const [contracts, setContracts] = useState(null);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function loadContracts() {
    api.get('/api/contracts').then(setContracts).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadContracts();
    // Empresas aprovadas para preencher os selects (cliente / fornecedor).
    api.get('/api/companies', { type: 'CLIENTE', status: 'APROVADA' }).then(setClients).catch(() => {});
    api.get('/api/companies', { type: 'FORNECEDOR', status: 'APROVADA' }).then(setSuppliers).catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const categories = form.categoriesCovered
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (categories.length === 0) {
      setError(t('Indique pelo menos uma categoria coberta pelo contrato.'));
      return;
    }

    const payload = {
      clientCompanyId: form.clientCompanyId,
      supplierCompanyId: form.supplierCompanyId,
      categoriesCovered: categories,
      totalValue: Number(form.totalValue),
      currency: form.currency || 'AOA',
      billingPeriodicity: form.billingPeriodicity,
      paymentTermDays: Number(form.paymentTermDays),
      validFrom: form.validFrom,
      validUntil: form.validUntil,
    };

    setSaving(true);
    try {
      const created = await api.post('/api/contracts', payload);
      setSuccess(t('Contrato {ref} criado. As POs elegíveis passam agora a Call-off.', { ref: created.reference }));
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadContracts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (row, side) =>
    row[`${side}Company`]?.name || '—';

  return (
    <div>
      <PageHeader
        title="Contratos-Quadro"
        subtitle="Contratos ativos geram Call-offs automáticos, com faturação consolidada e prazo próprio."
        action={
          <Button variant="primary"  onClick={() => { setShowForm((v) => !v); setSuccess(''); setError(''); }}>
            {showForm ? t('Cancelar') : t('Novo contrato-quadro')}
          </Button>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {showForm && (
        <form className="card card-pad" style={{ marginBottom: 16 }} onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label={t('Empresa cliente')}>
              {(id) => (<>
                <select id={id} value={form.clientCompanyId} onChange={set('clientCompanyId')} required>
                  <option value="">{t('Selecione o cliente…')}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>)}
            </Field>
            <Field label={t('Empresa fornecedora')}>
              {(id) => (<>
                <select id={id} value={form.supplierCompanyId} onChange={set('supplierCompanyId')} required>
                  <option value="">{t('Selecione o fornecedor…')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </>)}
            </Field>
          </div>

          <Field label={t('Categorias cobertas')} style={{ marginTop: 16 }}>
            {(id) => (<>
              <input id={id}
                type="text"
                value={form.categoriesCovered}
                onChange={set('categoriesCovered')}
                placeholder={t('Ex.: Válvulas, Tubagem, Bombas (separadas por vírgula)')}
                required
              />
              <small className="helptext">
                {t('Uma PO só vira Call-off se todas as categorias dos seus itens estiverem cobertas.')}
              </small>
            </>)}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <Field label={t('Valor total do contrato')}>
              {(id) => (<>
                <input id={id} type="number" min="0" step="0.01" value={form.totalValue} onChange={set('totalValue')} required />
              </>)}
            </Field>
            <Field label={t('Moeda')}>
              {(id) => (<>
                <input id={id} type="text" value={form.currency} onChange={set('currency')} />
              </>)}
            </Field>
            <Field label={t('Periodicidade de faturação')}>
              {(id) => (<>
                <select id={id} value={form.billingPeriodicity} onChange={set('billingPeriodicity')}>
                  {Object.entries(BILLING_PERIODICITY).map(([key, label]) => (
                    <option key={key} value={key}>{t(label)}</option>
                  ))}
                </select>
              </>)}
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
            <Field label={t('Prazo de pagamento (dias)')}>
              {(id) => (<>
                <input id={id} type="number" min="1" step="1" value={form.paymentTermDays} onChange={set('paymentTermDays')} required />
                <small className="helptext">{t('Substitui os 7 dias padrão para os call-offs deste contrato.')}</small>
              </>)}
            </Field>
            <Field label={t('Válido de')}>
              {(id) => (<>
                <input id={id} type="date" value={form.validFrom} onChange={set('validFrom')} required />
              </>)}
            </Field>
            <Field label={t('Válido até')}>
              {(id) => (<>
                <input id={id} type="date" value={form.validUntil} onChange={set('validUntil')} required />
              </>)}
            </Field>
          </div>

          <div style={{ marginTop: 20 }}>
            <Button variant="primary"  type="submit" disabled={saving}>
              {saving ? t('A criar…') : t('Criar contrato-quadro')}
            </Button>
          </div>
        </form>
      )}

      {!contracts ? (
        <Loading />
      ) : (
        <div className="card">
          <DataTable
            rows={contracts}
            rowKey="id"
            emptyTitle="Ainda não há contratos-quadro"
            emptyBody="Crie o primeiro para habilitar call-offs automáticos entre um cliente e um fornecedor."
            columns={[
              { key: 'reference', header: 'Referência', render: (r) => <span className="mono">{r.reference}</span> },
              { key: 'client', header: 'Cliente', render: (r) => nameOf(r, 'client') },
              { key: 'supplier', header: 'Fornecedor', render: (r) => nameOf(r, 'supplier') },
              {
                key: 'categoriesCovered',
                header: 'Categorias',
                render: (r) => (r.categoriesCovered || []).join(', '),
              },
              { key: 'totalValue', header: 'Valor', render: (r) => formatMoney(r.totalValue, r.currency) },
              {
                key: 'paymentTermDays',
                header: 'Prazo',
                render: (r) => `${r.paymentTermDays} ${t('dias')} · ${t(BILLING_PERIODICITY[r.billingPeriodicity] || r.billingPeriodicity)}`,
              },
              {
                key: 'validity',
                header: 'Vigência',
                render: (r) => `${formatDate(r.validFrom)} → ${formatDate(r.validUntil)}`,
              },
              {
                key: 'status',
                header: 'Estado',
                render: (r) => <Badge tone={CONTRACT_STATUS[r.status]?.tone}>{CONTRACT_STATUS[r.status]?.label || r.status}</Badge>,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
