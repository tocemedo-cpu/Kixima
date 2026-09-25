// src/realtime/RealtimeContext.jsx
// Uma única ligação em tempo real por sessão — o Chat de Suporte, o Chat
// Comercial e as notificações partilham-na, cada um só ouvindo os eventos que
// lhe dizem respeito. Ligada ao ciclo de vida da sessão: liga quando há
// utilizador autenticado, desliga quando deixa de haver (logout, sessão
// expirada).
//
// O transporte é uma decisão de build, não dos ecrãs: VITE_REALTIME escolhe
// entre o Socket.IO do backend Node (`socketio`, o valor por omissão — é o
// que está em produção e o caminho de recuo durante o cutover) e o STOMP do
// backend Java (`stomp`). Os dois adaptadores expõem a MESMA forma — ver
// socketioAdapter.js / stompAdapter.js — e por isso quem consome
// `useRealtime()` não muda uma linha.
//
// O servidor é quem decide se um "join" é permitido — ver realtimeService.js
// (Node) e RealtimeAuthInterceptor.java: mandar um conversationId/ticketId
// aqui não dá acesso nenhum, só pede; o `ack` devolve `{ ok:false }` quando a
// pessoa não tem autorização, e é isso (não a UI) que decide se a sala se junta.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ligarSocketIO } from './socketioAdapter';
import { ligarStomp } from './stompAdapter';

const RealtimeContext = createContext(null);

const ADAPTADORES = { socketio: ligarSocketIO, stomp: ligarStomp };

// Qualquer valor que não seja 'stomp' cai no Socket.IO — um VITE_REALTIME mal
// escrito nunca pode deixar a produção sem tempo real.
export function transporteAtivo() {
  return import.meta.env.VITE_REALTIME === 'stomp' ? 'stomp' : 'socketio';
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [ligacao, setLigacao] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setLigacao(null);
      setConnected(false);
      return undefined;
    }

    const nova = ADAPTADORES[transporteAtivo()]({ aoMudarLigacao: setConnected });
    setLigacao(nova);

    return () => {
      nova.desligar();
      setConnected(false);
    };
    // Religa quando o ID muda (troca de conta) — não em cada atualização de
    // campos do user (avatar, nome), que não afetam a sessão do socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo(() => ({
    socket: ligacao?.socket ?? null,
    connected,
    joinTicket: (id, cb) => ligacao?.joinTicket(id, cb),
    leaveTicket: (id) => ligacao?.leaveTicket(id),
    joinConversation: (id, cb) => ligacao?.joinConversation(id, cb),
    leaveConversation: (id) => ligacao?.leaveConversation(id),
  }), [ligacao, connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime deve ser usado dentro de <RealtimeProvider>.');
  return ctx;
}
