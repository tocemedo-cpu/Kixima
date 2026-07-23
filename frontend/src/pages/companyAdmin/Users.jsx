// src/pages/companyAdmin/Users.jsx
// Utilizadores & Perfis. O Company Admin gera links de convite por perfil,
// partilha-os com a equipa (Comprador, Vendedor, Financeiro) e aceita os
// cadastros submetidos. O Vendedor só existe em empresas fornecedoras.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PageHeader, Loading, ErrorBanner, SuccessBanner } from '../../components/Common';
import Badge from '../../components/Badge';

// Perfis convidáveis por tipo de empresa (espelha o backend). Rótulos no
// contexto da equipa: FORNECEDOR aparece como "Vendedor".
const ROLE_OPTIONS = {
  CLIENTE: [
    { value: 'COMPRADOR', label: 'Comprador' },
    { value: 'FINANCEIRO', label: 'Financeiro' },
  ],
  FORNECEDOR: [
    { value: 'COMPRADOR', label: 'Comprador' },
    { value: 'FORNECEDOR', label: 'Vendedor' },
    { value: 'FINANCEIRO', label: 'Financeiro' },
  ],
};

function roleLabel(role, companyType) {
  if (role === 'COMPANY_ADMIN') return 'Company Admin';
  if (role === 'FORNECEDOR') return companyType === 'FORNECEDOR' ? 'Vendedor' : 'Fornecedor';
  if (role === 'COMPRADOR') return 'Comprador';
  if (role === 'FINANCEIRO') return 'Financeiro';
  return role;
}

export default function Users() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState(null);
  const [role, setRole] = useState('COMPRADOR');
  const [invite, setInvite] = useState(null); // { url, role }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function loadUsers() {
    api.get('/api/companies/users').then(setUsers).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (user.companyId) {
      api.get(`/api/companies/${user.companyId}`).then(setCompany).catch((e) => setError(e.message));
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.companyId]);

  const options = company ? ROLE_OPTIONS[company.type] || [] : [];

  async function generateInvite(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInvite(null);
    setCopied(false);
    setBusy(true);
    try {
      const res = await api.post('/api/companies/invites', { role });
      const url = `${window.location.origin}/convite/${res.token}`;
      setInvite({ url, role: res.role });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function accept(id, name) {
    setError('');
    setSuccess('');
    try {
      await api.patch(`/api/companies/users/${id}/activate`);
      setSuccess(`Cadastro de ${name} aceite. A conta está ativa.`);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reject(id, name) {
    setError('');
    setSuccess('');
    try {
      await api.del(`/api/companies/users/${id}`);
      setSuccess(`Cadastro de ${name} recusado.`);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  const companyType = company?.type;
  const pending = (users || []).filter((u) => !u.active);
  const activeUsers = (users || []).filter((u) => u.active);

  return (
    <div>
      <PageHeader
        title="Utilizadores & Perfis"
        subtitle="Convide a sua equipa por link (Comprador, Vendedor, Financeiro) e aceite os cadastros."
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="card card-pad" style={{ maxWidth: 560, marginBottom: 18 }}>
        <h3 style={{ marginTop: 0 }}>Convidar utilizador</h3>
        <p className="helptext" style={{ marginTop: 0 }}>
          Escolha o perfil, gere o link e partilhe-o com a pessoa. Ela cria a própria conta e o
          cadastro fica pendente da sua aprovação.
        </p>
        <form onSubmit={generateInvite} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, minWidth: 200 }}>
            <label>Perfil a convidar</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-accent" disabled={busy || !options.length} type="submit">
            {busy ? 'A gerar…' : 'Gerar link de convite'}
          </button>
        </form>

        {invite ? (
          <div className="card-pad" style={{ marginTop: 14, background: 'var(--surface-2, #f6f7f9)', borderRadius: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginBottom: 6 }}>
              Link de convite ({roleLabel(invite.role, companyType)}) — válido 7 dias:
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input readOnly value={invite.url} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 220 }} />
              <button type="button" className="btn btn-ghost" onClick={copyLink}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {!users ? (
        <Loading />
      ) : (
        <>
          {pending.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
                <strong>Cadastros pendentes ({pending.length})</strong>
              </div>
              {pending.map((u) => (
                <div key={u.id} className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', gap: 10 }}>
                  <div>
                    <strong>{u.name}</strong>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2 }}>
                      {u.email} · {roleLabel(u.role, companyType)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-accent" onClick={() => accept(u.id, u.name)}>Aceitar</button>
                    <button className="btn btn-danger" onClick={() => reject(u.id, u.name)}>Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
              <strong>Equipa ativa ({activeUsers.length})</strong>
            </div>
            {activeUsers.length === 0 ? (
              <div className="card-pad"><p className="helptext" style={{ margin: 0 }}>Ainda sem utilizadores ativos.</p></div>
            ) : (
              activeUsers.map((u) => (
                <div key={u.id} className="card-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', gap: 10 }}>
                  <div>
                    <strong>{u.name}</strong>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2 }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Badge tone="info">{roleLabel(u.role, companyType)}</Badge>
                    {u.role !== 'COMPANY_ADMIN' && (
                      <button className="btn btn-ghost" onClick={() => reject(u.id, u.name)}>Remover</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
