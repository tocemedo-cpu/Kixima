// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, temSessao, marcarSessao } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    // A marca evita um pedido garantidamente 401 em cada visita de quem nunca
    // entrou. Não é credencial — o cookie httpOnly é que autentica; se a marca
    // estiver de pé sem cookie válido, o /me responde 401 e limpa-se.
    if (!temSessao()) {
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get('/api/auth/me');
      setUser(me);
    } catch {
      marcarSessao(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const result = await api.post('/api/auth/login', { email, password });
    // Conta com 2FA: a senha não basta — devolve o desafio para o 2º passo
    // (verify2fa) sem iniciar sessão.
    if (result.requires2fa) return result;
    marcarSessao(true);
    // A 2FA é obrigatória para quem aprova dinheiro; o servidor diz se está por
    // ativar, para a interface poder avisar antes de o prazo esgotar.
    setUser({ ...result.user, mfaPendente: result.mfaPendente, mfaPrazo: result.mfaPrazo });
    return result.user;
  }

  // 2º passo do login com 2FA: desafio + código TOTP → sessão completa.
  async function verify2fa(challenge, code) {
    const result = await api.post('/api/auth/2fa/verify', { challenge, code });
    marcarSessao(true);
    setUser({ ...result.user, mfaPendente: result.mfaPendente, mfaPrazo: result.mfaPrazo });
    return result.user;
  }

  async function logout() {
    // Revoga a sessão no servidor (best-effort) e limpa o estado local.
    try { await api.post('/api/auth/logout'); } catch { /* ignora falhas de rede */ }
    marcarSessao(false);
    setUser(null);
  }

  // Atualiza o utilizador em memória (ex.: após trocar a foto de perfil) para
  // que o header e outras vistas reflitam a mudança imediatamente.
  const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, verify2fa, logout, refreshUser: loadMe, updateUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
