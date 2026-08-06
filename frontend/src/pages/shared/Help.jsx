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
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
  const { user } = useAuth();
  return user?.role === 'ADMIN_SISTEMA' ? <HelpAdmin /> : <HelpUser />;
}

function HelpUser() {
  const { t } = useI18n();
  const [ov, setOv] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');      // termo efetivamente pesquisado
  const [modal, setModal] = useState(false);
  const [kbCat, setKbCat] = useState(null);    // categoria aberta na base de conhecimento
  const [showTickets, setShowTickets] = useState(false); // ver todos os pedidos
  const [uploadKey, setUploadKey] = useState(null);
  const fileRef = useRef(null);
  const catsRef = useRef(null);
  const ticketsRef = useRef(null);
  const channelsRef = useRef(null);

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

  // Pesquisa: filtra as perguntas frequentes reais e as categorias.
  function runSearch(term) { setQuery((term ?? q).trim()); }
  const cats = ov?.categories || [];
  const ql = query.toLowerCase();
  // Todas as perguntas frequentes reais, planificadas com a respetiva categoria.
  const allFaq = cats.flatMap((c) => (c.faq || []).map((f) => ({ ...f, cat: c.title })));
  const foundFaq = query ? allFaq.filter((f) => `${f.q} ${f.a} ${f.cat}`.toLowerCase().includes(ql)) : [];
  const visibleCats = query
    ? cats.filter((c) => `${c.title} ${c.desc || ''} ${(c.faq || []).map((f) => f.q).join(' ')}`.toLowerCase().includes(ql))
    : cats;

  function scrollTo(ref) { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  // Atalhos: apenas ações que existem de facto na plataforma.
  const faqCount = ov?.faqCount ?? allFaq.length;
  const quick = [
    { k: 'quick_kb', i: 'catalog', t: 'Perguntas Frequentes', s: `${faqCount} respostas disponíveis`, act: () => scrollTo(catsRef) },
    { k: 'quick_contact', i: 'help', t: 'Contato com Suporte', s: 'Abra um pedido de suporte', act: () => setModal(true) },
    { k: 'quick_tickets', i: 'invoice', t: 'Tickets Abertos', s: 'Acompanhe os seus pedidos', badge: ov?.openTickets, act: () => scrollTo(ticketsRef) },
  ];

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
            <div className={`hs-search-ico${ov?.images?.hero ? ' has-img' : ''}`}>{ov?.images?.hero ? <img src={ov.images.hero} alt="" /> : <Icon name="help" size={40} />}</div>
            <div style={{ flex: 1 }}>
              <h2 className="hs-h2">Como podemos ajudá-lo hoje?</h2>
              <p className="bz-sub">Pesquise na nossa base de conhecimento ou faça uma pergunta à equipa de suporte.</p>
              <form className="hs-searchbar" onSubmit={(e) => { e.preventDefault(); runSearch(); }}>
                <div className="bz-search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar nas perguntas frequentes…" /></div>
                <button type="submit" className="btn btn-accent">Buscar</button>
              </form>
              <div className="hs-popular"><span>Sugestões populares:</span>
                {POPULAR.map((p) => <button key={p} className="chip" onClick={() => { setQ(p); runSearch(p); }}>{p}</button>)}
              </div>
            </div>
          </div>

          {/* Resultados da pesquisa (perguntas frequentes reais) */}
          {query ? (
            <div className="bz-panel hs-results">
              <div className="hs-results-head">
                <strong>Resultados para “{query}”</strong>
                <button className="pf-link" onClick={() => { setQuery(''); setQ(''); }}>Limpar pesquisa ✕</button>
              </div>
              {foundFaq.length === 0 && visibleCats.length === 0 ? (
                <p className="bz-sub">Nenhum resultado encontrado. <button className="pf-link" onClick={() => setModal(true)}>Abrir um pedido de suporte</button>.</p>
              ) : (
                <ul className="hs-artlist">
                  {foundFaq.map((f) => (
                    <li key={f.q}><button className="hs-artitem" onClick={() => setKbCat(f.cat)}>
                      <Icon name="help" size={16} /><span><strong>{f.q}</strong><em>{f.cat}</em></span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {/* Atalhos */}
          <div className="hs-quick">
            {quick.map((c) => {
              const img = ov?.images?.[c.k];
              return (
                <button className="hs-quickcard" type="button" key={c.t} onClick={c.act}>
                  <span className={`hs-quick-ico${img ? ' has-img' : ''}`}>{img ? <img src={img} alt="" /> : <Icon name={c.i} size={18} />}{c.badge ? <span className="hs-badge">{c.badge}</span> : null}</span>
                  <div><strong>{c.t}</strong><span className="bz-sub2">{c.s}</span></div>
                </button>
              );
            })}
          </div>

          {/* Perguntas Frequentes (por categoria) */}
          <div className="hs-sec-head" ref={catsRef}>
            <h3 className="pf-h2" style={{ margin: 0 }}>{t('Perguntas Frequentes')}</h3>
            {query ? <button className="pf-link" onClick={() => { setQuery(''); setQ(''); }}>Ver todas as categorias →</button> : null}
          </div>
          <div className="hs-cats">
            {visibleCats.map((c) => (
              <button className="hs-cat" type="button" key={c.key} onClick={() => setKbCat(c.title)}>
                <span className={`hs-cat-ico${c.imageUrl ? ' has-img' : ''}`}>
                  {c.imageUrl ? <img src={c.imageUrl} alt={c.title} /> : <Icon name={c.icon} size={18} />}
                  {ov?.canManageImages ? (
                    <span className="hs-cat-edit" title="Trocar imagem (Admin)" role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); pickImage(c.key); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); pickImage(c.key); } }}><Icon name="certification" size={12} /></span>
                  ) : null}
                </span>
                <div><strong>{c.title}</strong><span className="bz-sub2">{c.desc}</span><span className="hs-cat-art">{c.count} {c.count === 1 ? 'pergunta' : 'perguntas'}</span></div>
              </button>
            ))}
            {query && visibleCats.length === 0 ? <p className="bz-sub">Nenhuma categoria corresponde à pesquisa.</p> : null}
          </div>
          {ov?.canManageImages ? <input ref={fileRef} type="file" accept="image/*" hidden onChange={onCategoryFile} /> : null}

          {/* Ainda precisa de ajuda */}
          <div className="hs-cta">
            {ov?.images?.mascot ? <img className="hs-mascot" src={ov.images.mascot} alt="" /> : null}
            <div>
              <h3>{t('Ainda precisa de ajuda?')}</h3>
              <p className="bz-sub">A nossa equipa está pronta para ajudar.</p>
              <div className="hs-cta-feats">
                <span><Icon name="truck" size={14} /> Resposta rápida — &lt; 2h</span>
                <span><Icon name="certification" size={14} /> Equipa especializada</span>
                <span><Icon name="shield" size={14} /> 98% de satisfação</span>
              </div>
            </div>
            <button className="btn btn-accent" onClick={() => setModal(true)}>Novo Pedido de Suporte</button>
          </div>

          {/* Rodapé interno da página */}
          <footer className="hs-foot">
            <span>KIXIMA — Plataforma de Procurement Garantido para a Indústria Africana</span>
            <span className="bz-sub2">© 2024 KIXIMA. Todos os direitos reservados.</span>
          </footer>
        </div>

        {/* Coluna lateral */}
        <div className="bz-side">
          <div className="bz-panel">
            <div className="hs-hours"><span>Horário de Suporte</span>{ov?.hours?.online ? <Pill tone="success">Online</Pill> : <Pill tone="neutral">Offline</Pill>}</div>
            <p className="bz-sub" style={{ margin: '6px 0 0' }}>{ov?.hours?.label}</p>
            <p className="bz-sub2">{ov?.hours?.tz}</p>
            <button className="btn btn-accent hs-side-btn" onClick={() => setModal(true)}>+ Novo Pedido de Suporte</button>
          </div>

          <div className="bz-panel" ref={ticketsRef}>
            <div className="hs-sec-head"><h3 style={{ margin: 0 }}>{t('Meus Pedidos Recentes')}</h3>{tickets.length > 5 ? <button className="pf-link" onClick={() => setShowTickets(true)}>Ver todos →</button> : null}</div>
            {tickets.length === 0 ? <p className="bz-sub">Sem pedidos ainda.</p> : tickets.slice(0, 5).map((tk) => (
              <div className="hs-ticket" key={tk.id}>
                <div><strong>{tk.subject}</strong><span className="bz-sub2 bz-mono">#{tk.reference}</span></div>
                <div className="hs-ticket-meta"><Pill tone={TICKET_TONE[tk.status]}>{TICKET_LABEL[tk.status]}</Pill><span className="bz-sub2">{formatDateTime(tk.createdAt)}</span></div>
              </div>
            ))}
          </div>

          <div className="bz-panel" ref={channelsRef}>
            <h3>{t('Canais de Suporte')}</h3>
            {(ov?.channels || []).map((c) => (
              <div className="hs-channel" key={c.key}>
                <span className={`hs-channel-ico${c.imageUrl ? ' has-img' : ''}`}>{c.imageUrl ? <img src={c.imageUrl} alt="" /> : <Icon name={c.icon} size={16} />}</span>
                <div><strong>{c.label}</strong><span className="bz-sub2">{c.value}</span> <a className="pf-link" href={channelHref(c)}>{c.action}</a></div>
              </div>
            ))}
          </div>

          <div className="bz-panel">
            <h3>{t('Status do Sistema')}</h3>
            <div className="hs-status"><Icon name="shield" size={16} /><div style={{ flex: 1 }}><strong>Todos os sistemas operacionais</strong><span className="bz-sub2">Atualizado agora</span></div>{ov?.system?.operational ? <Pill tone="success">Operacional</Pill> : <Pill tone="danger">Incidente</Pill>}</div>
          </div>
        </div>
      </div>

      {modal && <NewTicket onClose={() => setModal(false)} onCreated={() => { setModal(false); reload(); }} categories={cats} />}
      {kbCat && <KbModal category={kbCat} faq={allFaq.filter((f) => f.cat === kbCat)} onClose={() => setKbCat(null)} onTicket={() => { setKbCat(null); setModal(true); }} />}
      {showTickets && <AllTickets tickets={tickets} onClose={() => setShowTickets(false)} />}
    </div>
  );
}

// Constrói o link de ação de um canal (email, telefone, chat).
function channelHref(c) {
  const v = c.value || '';
  if (c.key === 'email' || /@/.test(v)) return `mailto:${v}`;
  if (c.key === 'phone' || c.key === 'whatsapp' || /^[+\d][\d\s()-]+$/.test(v)) return `tel:${v.replace(/[^+\d]/g, '')}`;
  return '#';
}

// Modal da base de conhecimento — perguntas frequentes reais da categoria.
function KbModal({ category, faq, onClose, onTicket }) {
  return (
    <div className="av-modal" onClick={onClose}>
      <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hs-modal-head"><h3><Icon name="help" size={18} /> {category}</h3><button className="hs-modal-x" onClick={onClose} aria-label="Fechar">✕</button></div>
        {(!faq || faq.length === 0) ? (
          <p className="bz-sub">Ainda não há perguntas nesta categoria. <button className="pf-link" onClick={onTicket}>Fale com o suporte</button>.</p>
        ) : (
          <div className="hs-faq">
            {faq.map((f) => (
              <details className="hs-faq-item" key={f.q}>
                <summary><Icon name="help" size={16} /> {f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        )}
        <div className="hs-form-actions"><button className="btn btn-ghost" onClick={onClose}>Fechar</button><button className="btn btn-accent" onClick={onTicket}>Ainda preciso de ajuda</button></div>
      </div>
    </div>
  );
}

// Modal com todos os pedidos de suporte do utilizador.
function AllTickets({ tickets, onClose }) {
  const { t } = useI18n();
  return (
    <div className="av-modal" onClick={onClose}>
      <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="hs-modal-head"><h3>{t('Meus Pedidos Recentes')}</h3><button className="hs-modal-x" onClick={onClose} aria-label="Fechar">✕</button></div>
        {tickets.map((tk) => (
          <div className="hs-ticket" key={tk.id}>
            <div><strong>{tk.subject}</strong><span className="bz-sub2 bz-mono">#{tk.reference}</span></div>
            <div className="hs-ticket-meta"><Pill tone={TICKET_TONE[tk.status]}>{TICKET_LABEL[tk.status]}</Pill><span className="bz-sub2">{formatDateTime(tk.createdAt)}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewTicket({ onClose, onCreated, categories }) {
  const { t } = useI18n();
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
        <h3>{t('Novo Pedido de Suporte')}</h3>
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
