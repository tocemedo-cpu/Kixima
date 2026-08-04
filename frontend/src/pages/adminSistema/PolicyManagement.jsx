// src/pages/adminSistema/PolicyManagement.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';
import { POLICY_STATUS, formatDate, formatMoney } from '../../domain';
import { useI18n } from '../../i18n';

export default function PolicyManagement() {
  const { t } = useI18n();
  const [clients, setClients] = useState(null);
  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [clientCompanies, supplierCompanies] = await Promise.all([
        api.get('/api/companies', { status: 'APROVADA', type: 'CLIENTE' }),
        api.get('/api/companies', { type: 'FORNECEDOR' }),
      ]);

      const clientsWithPolicy = await Promise.all(
        clientCompanies.map(async (c) => ({
          company: c,
          policies: await api.get(`/api/policies/company/${c.id}`),
        }))
      );
      const suppliersWithPolicy = await Promise.all(
        supplierCompanies.map(async (c) => ({
          company: c,
          policies: await api.get(`/api/policies/company/${c.id}`),
        }))
      );

      setClients(clientsWithPolicy);
      setSuppliers(suppliersWithPolicy.filter((s) => s.policies.supplierToKixima?.length > 0));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error && !clients) return <ErrorBanner message={error} />;
  if (!clients || !suppliers) return <Loading />;

  return (
    <div>
      <PageHeader title="Gestão de Apólices" subtitle="Emita apólices KIXIMA→Cliente e decida sobre apólices Fornecedor→KIXIMA." />

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>{t('Apólices KIXIMA→Cliente')}</h3>
      {clients.length === 0 ? (
        <p className="helptext" style={{ marginBottom: 20 }}>Nenhuma empresa cliente aprovada ainda.</p>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {clients.map(({ company, policies }) => (
            <ClientPolicyRow key={company.id} company={company} currentPolicy={policies.kiximaToClient?.[0]} onIssued={load} />
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 15, marginBottom: 12 }}>{t('Apólices Fornecedor→KIXIMA submetidas')}</h3>
      {suppliers.length === 0 ? (
        <p className="helptext">Nenhuma apólice de fornecedor submetida por rever.</p>
      ) : (
        suppliers.map(({ company, policies }) => (
          <SupplierPolicyRow key={company.id} company={company} policy={policies.supplierToKixima[0]} onDecided={load} />
        ))
      )}
    </div>
  );
}

function ClientPolicyRow({ company, currentPolicy, onIssued }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ policyNumber: '', insurer: '', coverageAmount: '', currency: 'AOA', validFrom: '', validUntil: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/policies/kixima-to-client/${company.id}`, { ...form, coverageAmount: Number(form.coverageAmount) });
      setShowForm(false);
      onIssued();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong>{company.name}</strong>
          {currentPolicy ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 3 }}>
              <span className="mono">{currentPolicy.policyNumber}</span> · válida até {formatDate(currentPolicy.validUntil)}{' '}
              <Badge tone={POLICY_STATUS[currentPolicy.status]?.tone}>{POLICY_STATUS[currentPolicy.status]?.label}</Badge>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--ink-400)', marginTop: 3 }}>Sem apólice KIXIMA→Cliente emitida.</div>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : currentPolicy ? 'Renovar apólice' : 'Emitir apólice'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
          <ErrorBanner message={error} />
          <div className="grid-cols grid-2">
            <div className="field">
              <label>Nº da apólice</label>
              <input required value={form.policyNumber} onChange={(e) => update('policyNumber', e.target.value)} />
            </div>
            <div className="field">
              <label>Seguradora</label>
              <input required value={form.insurer} onChange={(e) => update('insurer', e.target.value)} />
            </div>
          </div>
          <div className="grid-cols grid-2">
            <div className="field">
              <label>Cobertura (AOA)</label>
              <input required type="number" min="0" step="0.01" value={form.coverageAmount} onChange={(e) => update('coverageAmount', e.target.value)} />
            </div>
            <div className="field">
              <label>Válida até</label>
              <input required type="date" value={form.validUntil} onChange={(e) => update('validUntil', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Válida a partir de</label>
            <input required type="date" value={form.validFrom} onChange={(e) => update('validFrom', e.target.value)} />
          </div>
          <button className="btn btn-accent" disabled={busy} type="submit">{busy ? 'A emitir…' : 'Confirmar emissão'}</button>
        </form>
      )}
    </div>
  );
}

function SupplierPolicyRow({ company, policy, onDecided }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(approve) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/api/policies/supplier-to-kixima/${policy.id}/decision`, { approve });
      onDecided();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <strong>{company.name}</strong>
        <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 3 }}>
          <span className="mono">{policy.policyNumber}</span> · {policy.insurer} · {formatMoney(policy.coverageAmount, policy.currency)}
        </div>
        <ErrorBanner message={error} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Badge tone={POLICY_STATUS[policy.status]?.tone}>{POLICY_STATUS[policy.status]?.label}</Badge>
        {policy.status === 'SUBMETIDA' && (
          <>
            <button className="btn btn-accent btn-sm" disabled={busy} onClick={() => decide(true)}>Aprovar</button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => decide(false)}>Rejeitar</button>
          </>
        )}
      </div>
    </div>
  );
}
