// src/components/chat/StartConversationButton.jsx
// Arranca (ou reaproveita) uma conversa do Chat Comercial a partir do sítio
// onde faz sentido pedi-la — a ficha de um produto, uma PO, uma cotação, um
// contrato. O backend é que resolve as duas empresas a partir do contexto
// (ver conversationService.iniciar) — aqui só se pede, nunca se decide quem
// fala com quem.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../i18n';

export default function StartConversationButton({
  contextType, contextId, otherCompanyId, label = 'Falar com o fornecedor', className = 'btn btn-ghost btn-sm',
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  async function start() {
    setBusy(true); setErro('');
    try {
      const conversa = await api.post('/api/conversations', { contextType, contextId, otherCompanyId });
      navigate(`/mensagens/chat-comercial?c=${conversa.id}`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="chat-start-btn-wrap">
      <button type="button" className={className} onClick={start} disabled={busy}>
        {busy ? t('A abrir…') : t(label)}
      </button>
      {erro ? <span className="av-error" style={{ display: 'block', marginTop: 6 }}>{erro}</span> : null}
    </span>
  );
}
