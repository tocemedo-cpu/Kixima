// Porta do `if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;`
// no topo de frontend/src/pages/shared/LoginPage.jsx: quem já tem sessão não
// vê o formulário de login outra vez — vai direito para a sua área.
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ROLE_HOME } from '../../shared/domain';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  if (user) return router.parseUrl(ROLE_HOME[user.role]);
  return true;
};
