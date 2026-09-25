// Porta de frontend/src/auth/RequireAuth.jsx (o componente <RequireRole>) para
// um guard funcional parametrizável. Aceita um ou vários papéis — a mesma
// razão do original: alguns ecrãs servem mais do que uma persona (ex.:
// Assinatura é vista pelo Company Admin E pelo Financeiro).
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PersonaRole } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { ROLE_HOME } from '../../shared/domain';

export function roleGuard(...permitidos: PersonaRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    // O authGuard corre primeiro na árvore de rotas; chegar aqui sem user é o
    // mesmo caso do React sem sessão ainda carregada — manda para o login.
    if (!user) return router.parseUrl('/login');
    if (!permitidos.includes(user.role)) return router.parseUrl(ROLE_HOME[user.role]);
    return true;
  };
}
