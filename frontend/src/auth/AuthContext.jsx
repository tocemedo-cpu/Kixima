// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get('/api/auth/me');
      setUser(me);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const result = await api.post('/api/auth/login', { email, password });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  // Atualiza o utilizador em memória (ex.: após trocar a foto de perfil) para
  // que o header e outras vistas reflitam a mudança imediatamente.
  const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: loadMe, updateUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
