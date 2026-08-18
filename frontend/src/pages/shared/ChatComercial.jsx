// src/pages/shared/ChatComercial.jsx
// Mensagens → Chat Comercial. Comprador ↔ Fornecedor/Prestador — cada
// conversa listada aqui já passou pela verificação de autorização do
// backend (conversationService.listarConversas só devolve as da empresa de
// quem está autenticado); esta página não filtra nada, só apresenta.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useRealtime } from '../../realtime/RealtimeContext';
import { Icon } from '../../components/icons';
import { Crumbs, PageHead, EmptyRow } from '../../components/BuyerUI';
import ChatThread from '../../components/chat/ChatThread';
import { useI18n } from '../../i18n';
import { formatDateTime } from '../../domain';

async function enviarComAnexo(url, body, file) {
  const fd = new FormData();
  if (body) fd.append('body', body);
  if (file) fd.append('attachment', file);
  return api.postForm(url, fd);
}

export default function ChatComercial() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [conversas, setConversas] = useState([]);
  const selected = params.get('c') || null;

  const load = useCallback(() => { api.get('/api/conversations').then(setConversas).catch(() => {}); }, []);
  useEffect(load, [load]);

  function select(id) { setParams(id ? { c: id } : {}); }
  const conversa = conversas.find((c) => c.id === selected);

  return (
    <div>
      <Crumbs trail={['Mensagens', 'Chat Comercial']} />
      <PageHead title="Chat Comercial" subtitle="Converse diretamente com compradores e fornecedores sobre produtos, cotações e pedidos." />
      <div className="chat-layout">
        <aside className="chat-list-panel bz-panel">
          {conversas.length === 0 ? (
            <EmptyRow>{t('Sem conversas ainda — inicie uma a partir de um produto ou de um pedido.')}</EmptyRow>
          ) : (
            <ul className="chat-list">
              {conversas.map((c) => (
                <li key={c.id}>
                  <button className={`chat-list-item${selected === c.id ? ' on' : ''}`} onClick={() => select(c.id)}>
                    <strong>{c.counterpart?.name || t('Empresa')}</strong>
                    {c.lastMessage ? <span className="bz-sub2 chat-list-preview">{c.lastMessage.body || t('Anexo')}</span> : null}
                    {c.lastMessage ? <span className="bz-sub2">{formatDateTime(c.lastMessage.createdAt)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="chat-thread-panel bz-panel">
          {conversa ? (
            <ConversationThread conversation={conversa} onUpdated={load} />
          ) : (
            <div className="chat-placeholder"><Icon name="chat" size={32} /><p>{t('Escolha uma conversa para ver as mensagens.')}</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConversationThread({ conversation, onUpdated }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { joinConversation, leaveConversation, socket } = useRealtime();
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setBusy(true);
    api.get(`/api/conversations/${conversation.id}/messages`).then(setMessages).catch(() => {}).finally(() => setBusy(false));
    api.post(`/api/conversations/${conversation.id}/read`).catch(() => {});
    joinConversation(conversation.id);
    return () => leaveConversation(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    if (!socket) return undefined;
    function onMessage(m) { if (m.conversationId === conversation.id) { setMessages((prev) => [...prev, m]); onUpdated(); } }
    socket.on('conversation:message', onMessage);
    return () => socket.off('conversation:message', onMessage);
  }, [socket, conversation.id, onUpdated]);

  async function send(body, file) {
    await enviarComAnexo(`/api/conversations/${conversation.id}/messages`, body, file);
  }

  return (
    <>
      <div className="chat-thread-head">
        <div><strong>{conversation.counterpart?.name || t('Empresa')}</strong></div>
      </div>
      <div className="chat-safety-notice">
        <Icon name="shield" size={14} />
        {t('Para garantir segurança, rastreabilidade e proteção das partes, recomendamos manter a negociação e o pagamento dentro do Kixima.')}
      </div>
      <ChatThread messages={messages} busy={busy} mine={(m) => m.senderCompanyId === user.companyId} onSend={send} />
    </>
  );
}
