// src/pages/shared/Help.jsx
// Ajuda & Suporte — base de conhecimento, canais de suporte, estado do sistema
// e pedidos de suporte (tickets) do utilizador, ligados a /api/support.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Icon } from '../../components/icons';
import { Crumbs, Pill } from '../../components/BuyerUI';
import { formatDateTime } from '../../domain';
import HelpAdmin from './HelpAdmin';

const POPULAR = ['Ordens de Compra', 'Faturação', 'Contratos', 'Pagamentos', 'Catálogo'];
const TICKET_TONE = {
  ABERTO: 'info', EM_ANDAMENTO: 'info', AGUARDANDO_RESPOSTA: 'pending', RESOLVIDO: 'success', FECHADO: 'neutral',
};
const TICKET_LABEL = {
  ABERTO: 'Aberto', EM_ANDAMENTO: 'Em Andamento', AGUARDANDO_RESPOSTA: 'Aguardando Resposta', RESOLVIDO: 'Resolvido', FECHADO: 'Fechado',
};

// O Administrador do Sistema vê o painel de administração; os restantes
// utilizadores veem a página de pedir ajuda.
export default function Help() {
  const { user } = useAuth();
  return user?.role === 'ADMIN_SISTEMA' ? <HelpAdmin /> : <HelpUser />;
}

function HelpUser() {
  const [ov, setOv] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [uploadKey, setUploadKey] = useState(null);
  const fileRef = useRef(null);

  function reload() {
    api.get('/api/support/overview').then(setOv).catch(() => {});
    api.get('/api/support/tickets').then(setTickets).catch(() => {});
  }
  useEffect(reload, []);

  // Upload da imagem de uma categoria (apenas Administrador do Sistema).
  function pickImage(key) { setUploadKey(key); fileRef.current?.click(); }
  function onCategoryFile(e) {
    const f = e.target.files?.[0];
    if (f && uploadKey) api.upload(`/api/support/categories/${uploadKey}/image`, f, 'image').then(reload).catch(() => {});
    e.target.value = '';
  }

  return (
    <div>
      <Crumbs trail={['Ajuda & Suporte', 'Visão Geral']} />
      <div className="bz-head">
        <div>
          <h1 className="bz-title"><Icon name="help" size={22} /> Ajuda &amp; Suporte</h1>
          <p className="bz-sub">Estamos aqui para ajudar. Encontre respostas, tutoriais e suporte especializado.</p>
        </div>
        <div className="bz-head-actions"><button className="btn btn-accent" onClick={() => setModal(true)}>+ Novo Pedido de Suporte</button></div>
      </div>

      <div className="hs-layout">
        <div>
          {/* Pesquisa */}
          <div className="bz-panel hs-search">
            <div className="hs-search-ico"><Icon name="help" size={40} /></div>
            <div style={{ flex: 1 }}>
              <h2 className="hs-h2">Como podemos ajudá-lo hoje?</h2>
              <p className="bz-sub">Pesquise na nossa base de conhecimento ou faça uma pergunta à equipa de suporte.</p>
              <div className="hs-searchbar">
                <div className="bz-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artigos, tutoriais, guias e documentos…" /></div>
                <button className="btn btn-accent">Buscar</button>
              </div>
              <div className="hs-popular"><span>Sugestões populares:</span>
                {POPULAR.map((p) => <button key={p} className="chip" onClick={() => setQ(p)}>{p}</button>)}
              </div>
            </div>
          </div>

          {/* Atalhos */}
          <div className="hs-quick">
            {[
              { i: 'catalog', t: 'Base de Conhecimento', s: 'Artigos, guias e FAQs' },
              { i: 'chart', t: 'Vídeos Tutoriais', s: 'Tutoriais passo a passo' },
              { i: 'help', t: 'Contato com Suporte', s: 'Fale com a nossa equipa' },
              { i: 'invoice', t: 'Tickets Abertos', s: 'Acompanhe seus pedidos', badge: ov?.openTickets },
            ].map((c) => (
              <div className="hs-quickcard" key={c.t}>
                <span className="hs-quick-ico"><Icon name={c.i} size={18} />{c.badge ? <span className="hs-badge">{c.badge}</span> : null}</span>
                <div><strong>{c.t}</strong><span className="bz-sub2">{c.s}</span></div>
              </div>
            ))}
          </div>

          {/* Categorias */}
          <h3 className="pf-h2">Categorias de Ajuda</h3>
          <div className="hs-cats">
            {(ov?.categories || []).map((c) => (
              <div className="hs-cat" key={c.key}>
                <span className={`hs-cat-ico${c.imageUrl ? ' has-img' : ''}`}>
                  {c.imageUrl ? <img src={c.imageUrl} alt={c.title} /> : <Icon name={c.icon} size={18} />}
                  {ov?.canManageImages ? (
                    <button className="hs-cat-edit" title="Trocar imagem (Admin)" onClick={() => pickImage(c.key)}><Icon name="certification" size={12} /></button>
                  ) : null}
                </span>
                <div><strong>{c.title}</strong><span className="bz-sub2">{c.desc}</span><span className="hs-cat-art">{c.articles} artigos</span></div>
              </div>
            ))}
          </div>
          {ov?.canManageImages ? <input ref={fileRef} type="file" accept="image/*" hidden onChange={onCategoryFile} /> : null}

          {/* Ainda precisa de ajuda */}
          <div className="hs-cta">
            <div>
              <h3>Ainda precisa de ajuda?</h3>
              <p className="bz-sub">A nossa equipa está pronta para ajudar.</p>
              <div className="hs-cta-feats">
                <span><Icon name="truck" size={14} /> Resposta rápida — &lt; 2h</span>
                <span><Icon name="certification" size={14} /> Equipa especializada</span>
                <span><Icon name="shield" size={14} /> 98% de satisfação</span>
              </div>
            </div>
            <button className="btn btn-accent" onClick={() => setModal(true)}>Novo Pedido de Suporte</button>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="bz-side">
          <div className="bz-panel">
            <div className="hs-hours"><span>Horário de Suporte</span>{ov?.hours?.online ? <Pill tone="success">Online</Pill> : <Pill tone="neutral">Offline</Pill>}</div>
            <p className="bz-sub" style={{ margin: '6px 0 0' }}>{ov?.hours?.label}</p>
            <p className="bz-sub2">{ov?.hours?.tz}</p>
          </div>

          <div className="bz-panel">
            <h3>Meus Pedidos Recentes</h3>
            {tickets.length === 0 ? <p className="bz-sub">Sem pedidos ainda.</p> : tickets.slice(0, 5).map((t) => (
              <div className="hs-ticket" key={t.id}>
                <div><strong>{t.subject}</strong><span className="bz-sub2 bz-mono">#{t.reference}</span></div>
                <div className="hs-ticket-meta"><Pill tone={TICKET_TONE[t.status]}>{TICKET_LABEL[t.status]}</Pill><span className="bz-sub2">{formatDateTime(t.createdAt)}</span></div>
              </div>
            ))}
          </div>

          <div className="bz-panel">
            <h3>Canais de Suporte</h3>
            {(ov?.channels || []).map((c) => (
              <div className="hs-channel" key={c.key}>
                <span className="hs-channel-ico"><Icon name={c.icon} size={16} /></span>
                <div><strong>{c.label}</strong><span className="bz-sub2">{c.value}</span> <a className="pf-link" href="#">{c.action}</a></div>
              </div>
            ))}
          </div>

          <div className="bz-panel">
            <h3>Status do Sistema</h3>
            <div className="hs-status"><Icon name="shield" size={16} /><div style={{ flex: 1 }}><strong>Todos os sistemas operacionais</strong><span className="bz-sub2">Atualizado agora</span></div>{ov?.system?.operational ? <Pill tone="success">Operacional</Pill> : <Pill tone="danger">Incidente</Pill>}</div>
          </div>
        </div>
      </div>

      {modal && <NewTicket onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} categories={ov?.categories || []} />}
    </div>
  );
}

function NewTicket({ onClose, onCreated, categories }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(categories[0]?.title || 'Geral');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/api/support/tickets', { subject, category, message }); onCreated(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="av-modal" onClick={onClose}>
      <form className="hs-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Novo Pedido de Suporte</h3>
        {error ? <p className="av-error" style={{ maxWidth: 'none' }}>{error}</p> : null}
        <label className="field"><span>Assunto</span><input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Resumo do problema" /></label>
        <label className="field"><span>Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {(categories.length ? categories.map((c) => c.title) : ['Geral']).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>Mensagem</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} placeholder="Descreva o que precisa…" /></label>
        <div className="hs-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? 'A enviar…' : 'Enviar Pedido'}</button>
        </div>
      </form>
    </div>
  );
}
