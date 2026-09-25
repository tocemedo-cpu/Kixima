// Porta de frontend/src/auth/RequireAuth.jsx (o componente <RequireAuth>) para
// um guard funcional do router Angular. Mesmos três estados: a carregar,
// autenticado, e "sessão indeterminada" (ver AuthService.loadMe — NÃO é o
// mesmo que "sem sessão", e por isso NÃO redirecciona para o login).
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Espera a primeira resolução de loading() antes de decidir — evita que uma
// navegação directa (refrescar a página numa rota protegida) decida "sem
// sessão" só porque o /api/auth/me ainda está em curso.
function esperarCarregamento(auth: AuthService): Promise<void> {
  if (!auth.loading()) return Promise.resolve();
  return new Promise((resolve) => {
    const intervalo = setInterval(() => {
      if (!auth.loading()) {
        clearInterval(intervalo);
        resolve();
      }
    }, 25);
  });
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await esperarCarregamento(auth);

  if (auth.user()) return true;

  // Sessão indeterminada (429/falha de rede na verificação): não expulsa para
  // o login — deixa a rota entrar e o layout decide mostrar o aviso de "tentar
  // de novo" (ver ShellComponent), tal como o React fazia dentro do próprio
  // <RequireAuth>.
  if (auth.sessaoIndeterminada()) return true;

  return router.parseUrl('/login');
};
