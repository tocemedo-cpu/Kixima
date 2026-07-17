// src/auth/RequireAuth.jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ROLE_HOME } from '../domain';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-text">A verificar sessão…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireRole({ role }) {
  const { user } = useAuth();
  if (user.role !== role) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}
