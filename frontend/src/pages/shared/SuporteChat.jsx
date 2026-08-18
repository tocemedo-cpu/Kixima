// src/pages/shared/SuporteChat.jsx
// Suporte → Chat. Duas vistas na mesma rota, tal como Help.jsx já faz para a
// página de Ajuda: quem NÃO é assessor de Suporte só vê os seus próprios
// pedidos; quem gere Suporte (área "suporte" ou Super Admin) vê o painel do
// agente — fila, assumir, transferir, resolver, fechar/reabrir. O servidor é
// quem decide de facto (um 403 aqui não é alarme, é a fronteira normal).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useRealtime } from '../../realtime/RealtimeContext';
import { Icon } from '../../components/icons';
import { Crumbs, PageHead, Pill, Tabs, EmptyRow } from '../../components/BuyerUI';
import ChatThread from '../../components/chat/ChatThread';
import { useI18n } from '../../i18n';

const STATUS_TONE = { ABERTO: 'info', EM_ANDAMENTO: 'info', AGUARDANDO_RESPOSTA: 'pending', RESOLVIDO: 'success', FECHADO: 'neutral' };
const STATUS_LABEL = { ABERTO: 'Novo', EM_ANDAMENTO: 'Em Atendimento', AGUARDANDO_RESPOSTA: 'Aguardando Cliente', RESOLVIDO: 'Resolvido', FECHADO: 'Fechado' };

async function enviarComAnexo(url, body, file) {
  const fd = new FormData();
  if (body) fd.append('body', body);
  if (file) fd.append('attachment', file);
  return api.postForm(url, fd);
}

export default function SuporteChat() {
  const { user } = useAuth();
  return user?.role === 'ADMIN_SISTEMA' ? <AgentPanel /> : <UserPanel />;
}

// --- Vista do utilizador ----------------------------------------------------

function UserPanel() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(params.get('ticket') || null);
  const [modal, setModal] = useState(false);

  const loadTickets = useCallback(() => { api.get('/api/support/tickets').then(setTickets).catch(() => {}); }, []);
  useEffect(loadTickets, [loadTickets]);

  function select(id) { setSelected(id); setParams(id ? { ticket: id } : {}); }
  const ticket = tickets.find((tk) => tk.id === selected);

  return (
    <div>
      <Crumbs trail={['Suporte', 'Chat']} />
      <PageHead
        title="Suporte — Chat" subtitle="Converse em tempo real com a equipa de Suporte."
        actions={<button className="btn btn-accent" onClick={() => setModal(true)}>+ {t('Novo Pedido')}</button>}
      />
      <div className="chat-layout">
        <aside className="chat-list-panel bz-panel">
          <h3 className="chat-list-title">{t('Os meus pedidos')}</h3>
          {tickets.length === 0 ? <EmptyRow>{t('Sem pedidos ainda.')}</EmptyRow> : (
            <ul className="chat-list">
              {tickets.map((tk) => (
                <li key={tk.id}>
                  <button className={`chat-list-item${selected === tk.id ? ' on' : ''}`} onClick={() => select(tk.id)}>
                    <strong>{tk.subject}</strong>
                    <span className="bz-sub2 bz-mono">#{tk.reference}</span>
                    <Pill tone={STATUS_TONE[tk.status]}>{STATUS_LABEL[tk.status]}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="chat-thread-panel bz-panel">
          {ticket ? (
            <TicketThread ticket={ticket} onUpdated={loadTickets} />
          ) : (
            <div className="chat-placeholder"><Icon name="chat" size={32} /><p>{t('Escolha um pedido para ver a conversa.')}</p></div>
          )}
        </section>
      </div>
      {modal ? <NewTicketModal onClose={() => setModal(false)} onCreated={(tk) => { setModal(false); loadTickets(); select(tk.id); }} /> : null}
    </div>
  );
}

function TicketThread({ ticket, onUpdated }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { joinTicket, leaveTicket, socket } = useRealtime();
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState(ticket.status);

  useEffect(() => {
    setStatus(ticket.status);
    setBusy(true);
    api.get(`/api/support/tickets/${ticket.id}/messages`).then(setMessages).catch(() => {}).finally(() => setBusy(false));
    api.post(`/api/support/tickets/${ticket.id}/read`).catch(() => {});
    joinTicket(ticket.id);
    return () => leaveTicket(ticket.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  useEffect(() => {
    if (!socket) return undefined;
    function onMessage(m) { if (m.ticketId === ticket.id) setMessages((prev) => [...prev, m]); }
    function onUpdatedTicket(t2) { if (t2.id === ticket.id) { setStatus(t2.status); onUpdated(); } }
    socket.on('support:message', onMessage);
    socket.on('support:updated', onUpdatedTicket);
    return () => { socket.off('support:message', onMessage); socket.off('support:updated', onUpdatedTicket); };
  }, [socket, ticket.id, onUpdated]);

  async function send(body, file) {
    await enviarComAnexo(`/api/support/tickets/${ticket.id}/messages`, body, file);
  }

  return (
    <>
      <div className="chat-thread-head">
        <div><strong>{ticket.subject}</strong><span className="bz-sub2 bz-mono">#{ticket.reference}</span></div>
        <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
      </div>
      <ChatThread
        messages={messages} busy={busy} mine={(m) => m.authorId === user.id} onSend={send}
        disabled={status === 'FECHADO'} disabledReason="Este pedido está fechado."
      />
    </>
  );
}

function NewTicketModal({ onClose, onCreated }) {
  const { t } = useI18n();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const tk = await api.post('/api/support/tickets', { subject, category: 'Geral', message }); onCreated(tk); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="av-modal" onClick={onClose}>
      <form className="hs-form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{t('Novo Pedido de Suporte')}</h3>
        {error ? <p className="av-error" style={{ maxWidth: 'none' }}>{error}</p> : null}
        <label className="field"><span>{t('Assunto')}</span><input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder={t('Resumo do problema')} /></label>
        <label className="field"><span>{t('Mensagem')}</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} placeholder={t('Descreva o que precisa…')} /></label>
        <div className="hs-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
          <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? t('A enviar…') : t('Iniciar Conversa')}</button>
        </div>
      </form>
    </div>
  );
}

// --- Painel do agente --------------------------------------------------------

function AgentPanel() {
  const { t } = useI18n();
  const [tab, setTab] = useState('fila');
  const [fila, setFila] = useState([]);
  const [meus, setMeus] = useState([]);
  const [selected, setSelected] = useState(null);
  const [semAcesso, setSemAcesso] = useState(false);

  const reload = useCallback(() => {
    api.get('/api/support/admin/queue').then(setFila).catch((err) => { if (err.status === 403) setSemAcesso(true); });
    api.get('/api/support/admin/my-tickets').then(setMeus).catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  const lista = tab === 'fila' ? fila : meus;

  if (semAcesso) {
    return (
      <div>
        <Crumbs trail={['Suporte', 'Chat']} />
        <PageHead title="Suporte — Chat" />
        <div className="bz-panel"><p className="bz-sub">{t('Sem acesso a Suporte — fale com quem lhe deu acesso ao sistema.')}</p></div>
      </div>
    );
  }

  return (
    <div>
      <Crumbs trail={['Suporte', 'Chat']} />
      <PageHead title="Suporte — Chat" subtitle="Fila de pedidos e atendimentos em curso." />
      <Tabs tabs={[{ key: 'fila', label: 'Fila', count: fila.length }, { key: 'meus', label: 'Os meus atendimentos', count: meus.length }]} value={tab} onChange={setTab} />
      <div className="chat-layout">
        <aside className="chat-list-panel bz-panel">
          {lista.length === 0 ? <EmptyRow>{t('Nada por aqui.')}</EmptyRow> : (
            <ul className="chat-list">
              {lista.map((tk) => (
                <li key={tk.id}>
                  <button className={`chat-list-item${selected === tk.id ? ' on' : ''}`} onClick={() => setSelected(tk.id)}>
                    <strong>{tk.subject}</strong>
                    <span className="bz-sub2 bz-mono">#{tk.reference}</span>
                    <Pill tone={STATUS_TONE[tk.status]}>{STATUS_LABEL[tk.status]}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="chat-thread-panel bz-panel">
          {selected ? (
            <AgentTicketThread
              ticketId={selected}
              onChanged={() => { reload(); }}
              onClosedAway={() => setSelected(null)}
            />
          ) : (
            <div className="chat-placeholder"><Icon name="chat" size={32} /><p>{t('Escolha um pedido para atender.')}</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function AgentTicketThread({ ticketId, onChanged }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { joinTicket, leaveTicket, socket } = useRealtime();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [agents, setAgents] = useState([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const acting = useRef(false);

  const load = useCallback(() => {
    setBusy(true);
    Promise.all([
      api.get(`/api/support/tickets/${ticketId}`),
      api.get(`/api/support/tickets/${ticketId}/messages`),
    ]).then(([tk, msgs]) => { setTicket(tk); setMessages(msgs); }).finally(() => setBusy(false));
  }, [ticketId]);

  useEffect(() => {
    load();
    joinTicket(ticketId);
    return () => leaveTicket(ticketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => {
    if (!socket) return undefined;
    function onMessage(m) { if (m.ticketId === ticketId) setMessages((prev) => [...prev, m]); }
    function onUpdatedTicket(t2) { if (t2.id === ticketId) setTicket(t2); }
    socket.on('support:message', onMessage);
    socket.on('support:updated', onUpdatedTicket);
    return () => { socket.off('support:message', onMessage); socket.off('support:updated', onUpdatedTicket); };
  }, [socket, ticketId]);

  async function send(body, file) {
    await enviarComAnexo(`/api/support/tickets/${ticketId}/messages`, body, file);
  }

  async function acao(fn) {
    if (acting.current) return;
    acting.current = true;
    try { const tk = await fn(); setTicket(tk); onChanged(); } finally { acting.current = false; }
  }

  function abrirTransferir() {
    if (!agents.length) api.get('/api/support/admin/agents').then(setAgents).catch(() => {});
    setTransferOpen(true);
  }

  if (!ticket) return busy ? <p className="bz-sub">{t('A carregar…')}</p> : null;

  return (
    <>
      <div className="chat-thread-head">
        <div><strong>{ticket.subject}</strong><span className="bz-sub2 bz-mono">#{ticket.reference}</span></div>
        <Pill tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Pill>
      </div>
      <div className="chat-agent-actions">
        {!ticket.assignedToId ? (
          <button className="btn btn-accent btn-sm" onClick={() => acao(() => api.post(`/api/support/admin/tickets/${ticket.id}/assume`))}>{t('Assumir')}</button>
        ) : null}
        {ticket.assignedToId ? <button className="btn btn-ghost btn-sm" onClick={abrirTransferir}>{t('Transferir')}</button> : null}
        {ticket.status !== 'RESOLVIDO' && ticket.status !== 'FECHADO' ? (
          <button className="btn btn-ghost btn-sm" onClick={() => acao(() => api.post(`/api/support/admin/tickets/${ticket.id}/resolve`))}>{t('Marcar como Resolvido')}</button>
        ) : null}
        {ticket.status !== 'FECHADO' ? (
          <button className="btn btn-ghost btn-sm" onClick={() => acao(() => api.post(`/api/support/admin/tickets/${ticket.id}/close`))}>{t('Fechar')}</button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => acao(() => api.post(`/api/support/admin/tickets/${ticket.id}/reopen`))}>{t('Reabrir')}</button>
        )}
      </div>
      <ChatThread
        messages={messages} busy={busy} mine={(m) => m.authorId === user.id} onSend={send}
        disabled={ticket.status === 'FECHADO'} disabledReason="Este pedido está fechado. Reabra para continuar."
        renderAuthor={(m) => (m.authorId === ticket.userId ? t('Cliente') : t('Suporte'))}
      />
      {transferOpen ? (
        <div className="av-modal" onClick={() => setTransferOpen(false)}>
          <div className="hs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hs-modal-head"><h3>{t('Transferir para…')}</h3><button className="hs-modal-x" onClick={() => setTransferOpen(false)} aria-label={t('Fechar')}>✕</button></div>
            {agents.filter((a) => a.id !== user.id).map((a) => (
              <button key={a.id} className="chat-list-item" onClick={() => { acao(() => api.post(`/api/support/admin/tickets/${ticket.id}/transfer`, { toUserId: a.id })); setTransferOpen(false); }}>
                <strong>{a.name}</strong><span className="bz-sub2">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
