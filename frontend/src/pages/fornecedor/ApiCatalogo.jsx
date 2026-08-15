// src/pages/fornecedor/ApiCatalogo.jsx
// Chaves da API de catálogo (plano Pro).
//
// A chave aparece UMA vez, no momento em que é criada. Este ecrã foi desenhado
// à volta desse facto: a chave nova ocupa o lugar de destaque, com o aviso ao
// lado, porque quem sair daqui sem a copiar tem de a revogar e criar outra.
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, EmptyRow } from '../../components/BuyerUI';
import { ErrorBanner, SuccessBanner } from '../../components/Common';
import { formatDateTime } from '../../domain';
import { useI18n } from '../../i18n';

export default function ApiCatalogo() {
  const { t } = useI18n();
  const [chaves, setChaves] = useState(null);
  const [nome, setNome] = useState('');
  const [nova, setNova] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const carregar = () => api.get('/api/catalog/api-keys').then(setChaves).catch((e) => setError(e));
  useEffect(() => { carregar(); }, []);

  async function criar(e) {
    e.preventDefault();
    setBusy(true); setError(''); setSuccess(''); setNova(null);
    try {
      setNova(await api.post('/api/catalog/api-keys', { nome }));
      setNome('');
      carregar();
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  async function revogar(id, nomeDaChave) {
    // Revogar é imediato e não tem volta: um sistema a usar esta chave para de
    // funcionar no pedido seguinte. Confirmar é o mínimo.
    if (!window.confirm(t('Revogar a chave "{nome}"? Qualquer sistema que a use deixa de aceder ao catálogo de imediato.', { nome: nomeDaChave }))) return;
    setError(''); setSuccess('');
    try {
      await api.del(`/api/catalog/api-keys/${id}`);
      setSuccess(t('Chave revogada.'));
      carregar();
    } catch (err) { setError(err); }
  }

  const ativas = (chaves || []).filter((c) => c.ativa);

  return (
    <div>
      <Crumbs trail={['Catálogo', 'API']} />
      <PageHead
        title="API de catálogo"
        subtitle="Mantenha preços e stock sincronizados a partir do seu próprio sistema. Preço desatualizado num marketplace é o comprador a encomendar por um valor que já não existe."
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      {/* A chave nova, enquanto está no ecrã. Depois de sair, não volta. */}
      {nova ? (
        <div className="bz-card card-pad" style={{ borderColor: 'var(--brand-600)', marginBottom: 16 }}>
          <strong style={{ fontSize: 13.5 }}>{t('Chave criada — copie-a agora')}</strong>
          <p className="error-text" style={{ margin: '6px 0 10px', fontSize: 12.5 }}>{nova.aviso}</p>
          <pre style={{
            background: 'var(--code-bg, #f4f1f0)', border: '1px solid var(--line, #e6e1e0)',
            borderRadius: 4, padding: '10px 12px', overflowX: 'auto', margin: 0, fontSize: 12.5,
          }}><code>{nova.chave}</code></pre>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10 }}
            onClick={() => { navigator.clipboard?.writeText(nova.chave); setSuccess(t('Chave copiada.')); }}
          >
            {t('Copiar')}
          </button>
        </div>
      ) : null}

      <div className="bz-card card-pad" style={{ marginBottom: 16 }}>
        <form onSubmit={criar} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, minWidth: 260 }}>
            <label>{t('Nome da chave')}</label>
            <input
              required value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder={t('ex.: ERP da produção')}
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={busy || !nome.trim()}>
            {busy ? t('A criar…') : t('Criar chave')}
          </button>
        </form>
        <p className="bz-muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
          {t('Dê um nome que diga onde a chave é usada — é por ele que vai saber qual revogar.')}
        </p>
      </div>

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead>
            <tr>
              <th>{t('Nome')}</th><th>{t('Chave')}</th><th>{t('Criada')}</th>
              <th>{t('Último uso')}</th><th>{t('Estado')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!chaves ? <tr><td colSpan={6}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : chaves.length === 0
                ? <tr><td colSpan={6}><EmptyRow>Ainda não criou nenhuma chave.</EmptyRow></td></tr>
                : chaves.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.nome}</strong></td>
                    <td className="mono">{c.prefixo}…</td>
                    <td className="bz-muted">{formatDateTime(c.createdAt)}</td>
                    {/* Uma chave que nunca foi usada é uma chave a revogar. */}
                    <td className="bz-muted">{c.ultimoUso ? formatDateTime(c.ultimoUso) : t('nunca usada')}</td>
                    <td>{c.ativa ? t('Ativa') : t('Revogada')}</td>
                    <td>
                      {c.ativa ? (
                        <button className="btn btn-danger btn-sm" onClick={() => revogar(c.id, c.nome)}>
                          {t('Revogar')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="bz-card card-pad" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 13.5 }}>{t('Como usar')}</strong>
        <p className="bz-muted" style={{ margin: '6px 0 10px', fontSize: 12.5 }}>
          {t('A chave só alcança o catálogo da sua empresa. Não dá acesso a ordens, pagamentos, faturas nem utilizadores.')}
        </p>
        <pre style={{
          background: 'var(--code-bg, #f4f1f0)', border: '1px solid var(--line, #e6e1e0)',
          borderRadius: 4, padding: '10px 12px', overflowX: 'auto', margin: 0, fontSize: 12,
        }}><code>{`# Ler o catálogo
curl -H "Authorization: Bearer kxm_...." \\
  ${window.location.origin}/api/v1/catalogo

# Atualizar preço e stock de um item
curl -X PATCH -H "Authorization: Bearer kxm_...." \\
  -H "Content-Type: application/json" \\
  -d '{"preco": 125000, "stock": 40}' \\
  ${window.location.origin}/api/v1/catalogo/O-SEU-SKU`}</code></pre>
        <p className="bz-muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
          {t('Limite de 120 pedidos por minuto por chave. Cada alteração fica no trilho de auditoria com a chave identificada.')}
        </p>
      </div>

      {ativas.length >= 5 ? (
        <p className="bz-muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          {t('Atingiu o máximo de 5 chaves ativas. Revogue uma antes de criar outra.')}
        </p>
      ) : null}
    </div>
  );
}
