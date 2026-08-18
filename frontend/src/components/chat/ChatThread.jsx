// src/components/chat/ChatThread.jsx
// Lista de mensagens + caixa de envio — reutilizada pelo Chat de Suporte e
// pelo Chat Comercial. Os dois sistemas ficam separados nos dados e nas
// rotas; só esta peça de interface (e o padrão visual) é comum entre eles.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { useI18n } from '../../i18n';
import { formatDateTime } from '../../domain';

export default function ChatThread({
  messages, mine, onSend, disabled, disabledReason, placeholder = 'Escreva uma mensagem…',
  renderAuthor, emptyLabel = 'Ainda não há mensagens — comece a conversa.', busy,
}) {
  const { t } = useI18n();
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages?.length]);

  async function submit(e) {
    e.preventDefault();
    if (sending || disabled || (!body.trim() && !file)) return;
    setSending(true);
    try {
      await onSend(body.trim(), file);
      setBody('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-thread">
      <div className="chat-messages">
        {busy ? <p className="bz-sub chat-loading">{t('A carregar…')}</p> : null}
        {!busy && (!messages || messages.length === 0) ? <p className="bz-sub chat-empty">{t(emptyLabel)}</p> : null}
        {(messages || []).map((m) => (
          <div key={m.id} className={`chat-bubble-row${mine(m) ? ' mine' : ''}`}>
            <div className="chat-bubble">
              {renderAuthor ? <span className="chat-bubble-author">{renderAuthor(m)}</span> : null}
              {m.body ? <p>{m.body}</p> : null}
              {m.attachmentUrl ? (
                <a className="chat-attachment" href={m.attachmentUrl} target="_blank" rel="noreferrer">
                  <Icon name="contract" size={14} /> {m.attachmentName || t('Anexo')}
                </a>
              ) : null}
              <span className="chat-bubble-time">{formatDateTime(m.createdAt)}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {disabled ? (
        <div className="chat-disabled">{t(disabledReason || 'Esta conversa está fechada.')}</div>
      ) : (
        <form className="chat-composer" onSubmit={submit}>
          <button
            type="button" className="btn btn-ghost btn-sm chat-attach-btn"
            onClick={() => fileRef.current?.click()} title={t('Anexar ficheiro')}
          >
            <Icon name="contract" size={16} />
          </button>
          <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <input
            className="chat-input" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={t(placeholder)}
          />
          <button type="submit" className="btn btn-accent btn-sm" disabled={sending || (!body.trim() && !file)}>
            {sending ? t('A enviar…') : t('Enviar')}
          </button>
        </form>
      )}
      {file ? (
        <div className="chat-file-pending">
          <Icon name="contract" size={14} /> {file.name}
          <button type="button" className="pf-link" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>{t('remover')}</button>
        </div>
      ) : null}
    </div>
  );
}
