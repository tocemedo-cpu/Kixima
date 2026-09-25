// Porta de frontend/src/pages/shared/PasswordReset.jsx. Duas fases na
// mesma rota: /recuperar (pedir o link) e /recuperar/:token (definir a nova
// senha) — o React usa o mesmo componente para as duas, aqui também.
import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PasswordResetService } from './password-reset.service';
import { ApiError } from '../../core/models/api-error.model';
import { AuthHeroComponent } from '../../shared/components/auth-hero.component';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [RouterLink, AuthHeroComponent],
  templateUrl: './password-reset.component.html',
})
export class PasswordResetComponent {
  readonly token: string | null;

  // Fase 1 — pedir o link.
  readonly email = signal('');
  readonly sent = signal(false);
  readonly requestError = signal('');
  readonly requestSubmitting = signal(false);

  // Fase 2 — definir a nova senha.
  readonly password = signal('');
  readonly confirm = signal('');
  readonly done = signal(false);
  readonly resetError = signal('');
  readonly resetSubmitting = signal(false);

  constructor(
    route: ActivatedRoute,
    private readonly passwordResetService: PasswordResetService,
    private readonly router: Router,
  ) {
    this.token = route.snapshot.paramMap.get('token');
  }

  async requestLink(): Promise<void> {
    this.requestError.set('');
    this.requestSubmitting.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        this.passwordResetService.forgotPassword(this.email()).subscribe({ next: () => resolve(), error: (e) => reject(e) });
      });
      this.sent.set(true);
    } catch (e) {
      this.requestError.set(e instanceof ApiError ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      this.requestSubmitting.set(false);
    }
  }

  tryAgain(): void {
    this.sent.set(false);
  }

  async resetPassword(): Promise<void> {
    this.resetError.set('');
    if (this.password() !== this.confirm()) {
      this.resetError.set('As senhas não coincidem.');
      return;
    }
    this.resetSubmitting.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        this.passwordResetService.resetPassword(this.token!, this.password()).subscribe({ next: () => resolve(), error: (e) => reject(e) });
      });
      this.done.set(true);
      setTimeout(() => this.router.navigateByUrl('/login'), 2500);
    } catch (e) {
      this.resetError.set(e instanceof ApiError ? e.message : 'Não foi possível redefinir a senha.');
    } finally {
      this.resetSubmitting.set(false);
    }
  }

  // O React usa uma regex no TEXTO do erro do servidor para decidir se
  // mostra o link "pedir novo link" — não há um código de erro estruturado
  // para isto, por isso mantém-se a mesma heurística aqui.
  get mostrarNovoLink(): boolean {
    return /expirado|utilizado|inválido/i.test(this.resetError());
  }
}
