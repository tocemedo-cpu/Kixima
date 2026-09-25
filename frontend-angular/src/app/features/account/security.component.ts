// Porta de frontend/src/pages/shared/Security.jsx. Alteração da própria
// senha + 2FA (TOTP/email) + direitos do titular dos dados. As duas
// últimas secções vivem em componentes próprios (TwoFactorSection/
// DadosPessoaisSection no React), portados aqui como componentes standalone
// distintos para facilitar o teste de cada um isoladamente.
import { Component, signal } from '@angular/core';
import { SecurityService } from './security.service';
import { ApiError } from '../../core/models/api-error.model';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { FieldComponent } from '../../shared/components/field.component';
import { TwoFactorSectionComponent } from './two-factor-section.component';
import { PersonalDataSectionComponent } from './personal-data-section.component';

interface FormularioSenha {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}

const EMPTY_FORM: FormularioSenha = { currentPassword: '', newPassword: '', confirm: '' };

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [PageHeaderComponent, ErrorBannerComponent, SuccessBannerComponent, FieldComponent, TwoFactorSectionComponent, PersonalDataSectionComponent],
  templateUrl: './security.component.html',
})
export class SecurityComponent {
  readonly form = signal<FormularioSenha>({ ...EMPTY_FORM });
  readonly error = signal('');
  readonly success = signal('');
  readonly saving = signal(false);

  constructor(private readonly securityService: SecurityService) {}

  setCampo(campo: keyof FormularioSenha, valor: string): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  submit(): void {
    this.error.set('');
    this.success.set('');
    const f = this.form();

    if (f.newPassword.length < 10) {
      this.error.set('A nova senha deve ter pelo menos 10 caracteres.');
      return;
    }
    if (f.newPassword !== f.confirm) {
      this.error.set('A confirmação não coincide com a nova senha.');
      return;
    }

    this.saving.set(true);
    this.securityService.changePassword({ currentPassword: f.currentPassword, newPassword: f.newPassword }).subscribe({
      next: () => {
        this.success.set('Senha alterada com sucesso.');
        this.form.set({ ...EMPTY_FORM });
        this.saving.set(false);
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.saving.set(false);
      },
    });
  }
}
