// src/pages/shared/HelpAdmin.jsx
// Ajuda & Suporte — vista do Administrador do Sistema. Não é a página de
// "pedir ajuda", mas o painel de ADMINISTRAÇÃO: gere os pedidos de suporte de
// toda a plataforma e as imagens da base de conhecimento.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Crumbs, PageHead, KpiRow, Tabs, Pill, Toolbar, EmptyRow } from '../../components/BuyerUI';
import { Icon } from '../../components/icons';
import { formatDateTime } from '../../domain';

const ST = {
  ABERTO: { tone: 'info', label: 'Aberto' },
  EM_ANDAMENTO: { tone: 'info', label: 'Em Andamento' },
  AGUARDANDO_RESPOSTA: { tone: 'pending', label: 'Aguardando Resposta' },
  RESOLVIDO: { tone: 'success', label: 'Resolvido' },
  FECHADO: { tone: 'neutral', label: 'Fechado' },
};
const TABS = [
  { key: '', label: 'Todos' }, { key: 'ABERTO', label: 'Abertos' },
  { key: 'EM_ANDAMENTO', label: 'Em Andamento' }, { key: 'AGUARDANDO_RESPOSTA', label: 'Aguardando' },
  { key: 'RESOLVIDO', label: 'Resolvidos' }, { key: 'FECHADO', label: 'Fechados' },
];

function initials(n = '') { return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase(); }

export default function HelpAdmin() {
  const [ov, setOv] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const [uploadKey, setUploadKey] = useState(null);
  const fileRef = useRef(null);

  function loadOverview() { api.get('/api/support/admin/overview').then(setOv).catch(() => {}); }
  function loadTickets() { api.get('/api/support/admin/tickets', { status: tab || undefined }).then(setTickets).catch(() => {}); }
  useEffect(loadOverview, []);
  useEffect(loadTickets, [tab]);

  function flash(m) { setToast(m); setTimeout(() => setToast(''), 3000); }
  function pickImage(key) { setUploadKey(key); fileRef.current?.click(); }
  function onFile(e) {
    const f = e.target.files?.[0];
    if (f && uploadKey) api.upload(`/api/support/categories/${uploadKey}/image`, f, 'image').then(() => { loadOverview(); flash('Imagem atualizada.'); }).catch(() => {});
    e.target.value = '';
  }
  async function setStatus(id, status) {
    try { await api.patch(`/api/support/tickets/${id}`, { status }); loadTickets(); loadOverview(); flash('Estado atualizado.'); }
    catch { flash('Não foi possível atualizar.'); }
  }

  const k = ov?.kpis;
  const items = (tickets || []).filter((t) => !q || t.reference.toLowerCase().includes(q.toLowerCase()) || t.subject.toLowerCase().includes(q.toLowerCase()) || (t.user?.name || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      {toast ? <div className="svc-toast">{toast}</div> : null}
      <Crumbs trail={['Ajuda & Suporte', 'Administração']} />
      <PageHead title="Ajuda & Suporte — Administração" subtitle="Gerencie os pedidos de suporte da plataforma e as imagens da base de conhecimento." />

      <KpiRow cards={[
        { icon: 'activities', tone: 'info', label: 'Total de Pedidos', value: k?.total ?? '—', sub: 'Toda a plataforma' },
        { icon: 'help', tone: 'info', label: 'Abertos', value: k?.abertos ?? '—', sub: 'Novos' },
        { icon: 'history', tone: 'pending', label: 'Aguardando', value: k?.aguardando ?? '—', sub: 'Resposta do utilizador' },
        { icon: 'certification', tone: 'success', label: 'Resolvidos', value: k?.resolvidos ?? '—', sub: 'Concluídos' },
        { icon: 'approvals', tone: 'neutral', label: 'Fechados', value: k?.fechados ?? '—', sub: 'Arquivados' },
      ]} />

      {/* Gestão das imagens da base de conhecimento */}
      <h3 className="pf-h2">Categorias &amp; Imagens da Base de Conhecimento</h3>
      <p className="bz-sub" style={{ marginTop: -6 }}>Só o Administrador do Sistema pode carregar/trocar estas imagens. Elas aparecem para todos os utilizadores.</p>
      <div className="hs-cats" style={{ marginBottom: 24 }}>
        {(ov?.categories || []).map((c) => (
          <div className="hs-cat" key={c.key}>
            <span className={`hs-cat-ico${c.imageUrl ? ' has-img' : ''}`}>
              {c.imageUrl ? <img src={c.imageUrl} alt={c.title} /> : <Icon name={c.icon} size={18} />}
              <button className="hs-cat-edit" title="Trocar imagem" onClick={() => pickImage(c.key)}><Icon name="certification" size={12} /></button>
            </span>
            <div>
              <strong>{c.title}</strong>
              <span className="bz-sub2">{c.articles} artigos</span>
              <button className="pf-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12 }} onClick={() => pickImage(c.key)}>{c.imageUrl ? 'Trocar imagem' : 'Carregar imagem'}</button>
            </div>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {/* Pedidos de suporte de toda a plataforma */}
      <h3 className="pf-h2">Pedidos de Suporte</h3>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <Toolbar placeholder="Pesquisar por referência, assunto ou utilizador…" q={q} onQ={setQ} />

      <div className="bz-card bz-tablewrap">
        <table className="bz-table">
          <thead><tr><th>Referência</th><th>Utilizador</th><th>Empresa</th><th>Assunto</th><th>Categoria</th><th>Data</th><th>Estado</th></tr></thead>
          <tbody>
            {!tickets ? <tr><td colSpan={7}><EmptyRow>A carregar…</EmptyRow></td></tr>
              : items.length === 0 ? <tr><td colSpan={7}><EmptyRow>Sem pedidos.</EmptyRow></td></tr>
              : items.map((t) => (
                <tr key={t.id}>
                  <td><span className="bz-mono">#{t.reference}</span></td>
                  <td><div className="bz-supplier"><span className="bz-supplier-logo">{initials(t.user?.name || '?')}</span><div><strong>{t.user?.name || '—'}</strong><span className="bz-supplier-loc">{t.user?.email}</span></div></div></td>
                  <td className="bz-muted">{t.company || '—'}</td>
                  <td>{t.subject}</td>
                  <td className="bz-muted">{t.category}</td>
                  <td className="bz-muted">{formatDateTime(t.createdAt)}</td>
                  <td>
                    <select className="hs-status-sel" value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                      {Object.entries(ST).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
