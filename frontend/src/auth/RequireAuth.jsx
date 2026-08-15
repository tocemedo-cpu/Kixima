// src/auth/RequireAuth.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useI18n } from '../i18n';
import { ROLE_HOME } from '../domain';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="loading-text">{t('A verificar sessão…')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * `role` aceita um papel ou vários. Há ecrãs que servem mais do que uma
 * persona — a subscrição é vista pelo Company Admin (que escolhe o plano) e
 * pelo Financeiro (que faz a transferência e carrega o comprovativo), tal como
 * o servidor permite. Com um só papel, o menu do Financeiro tinha uma entrada
 * que o expulsava para o seu dashboard sem dizer porquê.
 */
export function RequireRole({ role }) {
  const { user } = useAuth();
  const permitidos = Array.isArray(role) ? role : [role];
  if (!permitidos.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}
