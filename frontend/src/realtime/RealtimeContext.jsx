// src/realtime/RealtimeContext.jsx
// Uma única ligação de tempo real por sessão (Socket.IO no backend Node, STOMP no Java) — o Chat de Suporte,
// o Chat Comercial e as notificações partilham-na, cada um só ouvindo os eventos que lhe dizem
// respeito. Ligado ao ciclo de vida da sessão: liga quando há utilizador
// autenticado, desliga quando deixa de haver (logout, sessão expirada).
//
// O servidor é quem decide se um "join" é permitido — ver realtimeService.js
// no backend: mandar um conversationId/ticketId aqui não dá acesso nenhum,
// só pede; o `ack` devolve `{ ok:false }` quando a pessoa não tem autorização,
// e é isso (não a UI) que decide se a sala se junta.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { apiBaseUrl, bearerNativoAtual } from '../api/client';

const RealtimeContext = createContext(null);

// O transporte escolhe-se NA COMPILAÇÃO: a imagem do backend Java (backend-java/Dockerfile) compila o SPA com
// VITE_REALTIME=stomp, porque o Java só fala STOMP; a do Node fica com o Socket.IO por omissão. O Vite substitui
// a constante e remove o ramo que não se usa (e a biblioteca respectiva) do pacote final.
const USAR_STOMP = import.meta.env.VITE_REALTIME === 'stomp';

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    if (USAR_STOMP) {
      // STOMP (backend Java): mesma sessão (cookie httpOnly no upgrade, ou Bearer na app nativa) e a mesma
      // base da API. Carregado à parte para não pesar no pacote do Node, onde este ramo nem existe.
      let cancelado = false;
      import('./stompSocket').then(({ criarSocketStomp }) => {
        if (cancelado) return;
        const s = criarSocketStomp({
          base: apiBaseUrl(),
          bearer: bearerNativoAtual(),
          aoLigar: () => setConnected(true),
          aoDesligar: () => setConnected(false),
        });
        socketRef.current = s;
        setSocket(s);
      });
      return () => {
        cancelado = true;
        socketRef.current?.disconnect();
        socketRef.current = null;
      };
    }

    // withCredentials envia o MESMO cookie httpOnly de sessão que a API usa.
    // Dentro do Capacitor isso tem duas questões próprias da API REST (ver
    // api/client.js): '/' resolve-se contra a origem falsa do WebView, não
    // contra kixima.net — por isso a MESMA base (apiBaseUrl()); e o cookie
    // cross-origin pode não sobreviver — por isso o MESMO Bearer em memória,
    // aqui passado no handshake (auth.token), que é onde o backend também o
    // procura (ver backend/src/services/realtimeService.js).
    const s = io(apiBaseUrl() || '/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: bearerNativoAtual() ? { token: bearerNativoAtual() } : undefined,
    });
    socketRef.current = s;
    setSocket(s);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // Religa quando o ID muda (troca de conta) — não em cada atualização de
    // campos do user (avatar, nome), que não afetam a sessão do socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo(() => ({
    socket, connected,
    joinTicket: (id, cb) => socket?.emit('support:join', id, cb),
    leaveTicket: (id) => socket?.emit('support:leave', id),
    joinConversation: (id, cb) => socket?.emit('conversation:join', id, cb),
    leaveConversation: (id) => socket?.emit('conversation:leave', id),
  }), [socket, connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime deve ser usado dentro de <RealtimeProvider>.');
  return ctx;
}
