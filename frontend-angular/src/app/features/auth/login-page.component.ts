// Porta de frontend/src/pages/shared/LoginPage.jsx. Mesmo fluxo de negócio,
// ponto por ponto: login → (2FA opcional: TOTP ou EMAIL) → sessão → redirect
// para ROLE_HOME (ou para o catálogo com a pesquisa `?q=` vinda da página
// corporativa, para quem entra como COMPRADOR).
//
// Pendente desta migração (não removido — apenas ainda não portado, ver
// docs/migracao-angular/PLANO.md): o seletor de idioma (i18n PT/EN/FR).
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ApiError } from '../../core/models/api-error.model';
import { isRequires2fa } from '../../core/models/user.model';
import { ROLE_HOME } from '../../shared/domain';
import { AuthHeroComponent } from '../../shared/components/auth-hero.component';
import { IconComponent } from '../../shared/components/icon.component';
import { TemaSelectorComponent } from '../../shared/tema/tema-selector.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AuthHeroComponent, IconComponent, TemaSelectorComponent],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly codeForm = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly error = signal('');
  readonly aviso = signal('');
  readonly submitting = signal(false);
  readonly challenge = signal('');
  readonly metodo = signal<'TOTP' | 'EMAIL' | ''>('');
  readonly enviadoPara = signal('');

  readonly user = computed(() => this.auth.user());

  constructor(
    private readonly auth: AuthService,
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  private destino(role: keyof typeof ROLE_HOME): string {
    const q = (this.route.snapshot.queryParamMap.get('q') || '').trim();
    return role === 'COMPRADOR' && q ? `/comprador/servicos?q=${encodeURIComponent(q)}` : ROLE_HOME[role];
  }

  async handleSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.error.set('');
    this.submitting.set(true);
    try {
      const { email, password } = this.loginForm.getRawValue();
      const result = await this.auth.login(email!, password!);
      if (isRequires2fa(result)) {
        this.challenge.set(result.challenge);
        this.metodo.set(result.metodo || 'TOTP');
        this.enviadoPara.set((result as { enviadoPara?: string }).enviadoPara || '');
        return;
      }
      await this.router.navigateByUrl(this.destino(result.user.role), { replaceUrl: true });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      this.submitting.set(false);
    }
  }

  async handleVerify(): Promise<void> {
    if (this.codeForm.invalid) return;
    this.error.set('');
    this.submitting.set(true);
    try {
      const code = (this.codeForm.getRawValue().code || '').trim();
      const result = await this.auth.verify2fa(this.challenge(), code);
      await this.router.navigateByUrl(this.destino(result.user.role), { replaceUrl: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Código incorreto.';
      this.error.set(message);
      if (/expirado|inválid/i.test(message)) {
        this.challenge.set('');
        this.codeForm.reset();
        this.metodo.set('');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  voltarAoLogin(): void {
    this.challenge.set('');
    this.codeForm.reset();
    this.error.set('');
    this.metodo.set('');
  }

  async reenviar(): Promise<void> {
    this.error.set('');
    this.aviso.set('');
    try {
      const r = await firstValueFrom(
        this.api.post<{ enviadoPara?: string }>('/api/auth/2fa/reenviar', { challenge: this.challenge() }),
      );
      this.enviadoPara.set(r.enviadoPara || this.enviadoPara());
      this.aviso.set('Enviámos outro código.');
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Não foi possível reenviar o código.');
    }
  }
}
