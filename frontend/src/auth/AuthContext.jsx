// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, temSessao, marcarSessao, definirBearerNativo } from '../api/client';

const AuthContext = createContext(null);

// Quantas vezes se insiste antes de admitir que não se consegue perguntar, e
// quanto se espera entre tentativas. Um 429 do próprio limitador passa em
// segundos; um servidor a reiniciar, idem.
const TENTATIVAS = 3;
const ESPERA_MS = [400, 1200];

const dormir = (ms) => new Promise((r) => { setTimeout(r, ms); });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Três estados, não dois: com sessão, sem sessão, e NÃO SE SABE. Ver abaixo.
  const [sessaoIndeterminada, setSessaoIndeterminada] = useState(false);

  const loadMe = useCallback(async () => {
    // A marca evita um pedido garantidamente 401 em cada visita de quem nunca
    // entrou. Não é credencial — o cookie httpOnly é que autentica; se a marca
    // estiver de pé sem cookie válido, o /me responde 401 e limpa-se.
    if (!temSessao()) {
      setLoading(false);
      return;
    }
    setSessaoIndeterminada(false);

    // SÓ UM 401 SIGNIFICA "ESTA SESSÃO NÃO VALE".
    //
    // Antes, qualquer falha caía no mesmo saco: um 429, uma falha de rede, um
    // 500 de meio segundo — todos apagavam a marca e punham a pessoa no ecrã de
    // entrada, como se a sessão tivesse terminado. Quem estivesse com a cesta
    // meia perdia-a por causa de um soluço.
    //
    // Não é hipotético: apanhou-se com o limitador da própria plataforma. Numa
    // execução dos testes o /api/auth/me levou 97 respostas 429 e as páginas
    // apareceram como se ninguém estivesse autenticado. Foi preciso ler o
    // registo do servidor para perceber — do lado de fora era indistinguível de
    // uma sessão expirada, que é precisamente o problema.
    for (let i = 0; i < TENTATIVAS; i += 1) {
      try {
        const { user: me } = await api.get('/api/auth/me');
        setUser(me);
        setLoading(false);
        return;
      } catch (err) {
        if (err && err.status === 401) {
          marcarSessao(false);
          setLoading(false);
          return;
        }
        if (i < TENTATIVAS - 1) await dormir(ESPERA_MS[i]);
      }
    }

    // Esgotaram-se as tentativas sem um 401. A marca FICA: o problema é de quem
    // responde, não da sessão, e apagá-la obrigaria a entrar de novo por algo
    // que provavelmente já passou. Quem decide o que mostrar é o RequireAuth.
    setSessaoIndeterminada(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function login(email, password) {
    const result = await api.post('/api/auth/login', { email, password });
    // Conta com 2FA: a senha não basta — devolve o desafio para o 2º passo
    // (verify2fa) sem iniciar sessão.
    if (result.requires2fa) return result;
    // Sem efeito fora do Capacitor (ver definirBearerNativo em api/client.js)
    // — na Web a sessão continua a ser só o cookie httpOnly, como sempre foi.
    definirBearerNativo(result.token);
    marcarSessao(true);
    // A 2FA é obrigatória para quem aprova dinheiro; o servidor diz se está por
    // ativar, para a interface poder avisar antes de o prazo esgotar.
    setUser({ ...result.user, mfaPendente: result.mfaPendente, mfaPrazo: result.mfaPrazo });
    return result.user;
  }

  // 2º passo do login com 2FA: desafio + código TOTP → sessão completa.
  async function verify2fa(challenge, code) {
    const result = await api.post('/api/auth/2fa/verify', { challenge, code });
    definirBearerNativo(result.token);
    marcarSessao(true);
    setUser({ ...result.user, mfaPendente: result.mfaPendente, mfaPrazo: result.mfaPrazo });
    return result.user;
  }

  async function logout() {
    // Revoga a sessão no servidor (best-effort) e limpa o estado local.
    try { await api.post('/api/auth/logout'); } catch { /* ignora falhas de rede */ }
    definirBearerNativo(null);
    marcarSessao(false);
    setUser(null);
  }

  // Atualiza o utilizador em memória (ex.: após trocar a foto de perfil) para
  // que o header e outras vistas reflitam a mudança imediatamente.
  const updateUser = useCallback((patch) => setUser((u) => (u ? { ...u, ...patch } : u)), []);

  return (
    <AuthContext.Provider value={{
      user, loading, sessaoIndeterminada, login, verify2fa, logout, refreshUser: loadMe, updateUser,
    }}
    >{children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return ctx;
}
