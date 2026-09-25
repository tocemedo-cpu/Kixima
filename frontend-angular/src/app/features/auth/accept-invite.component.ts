// Porta de frontend/src/pages/shared/AcceptInvite.jsx.
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InviteService } from './invite.service';
import { ResolvedInviteDto } from '../../core/models/invite.model';
import { ApiError } from '../../core/models/api-error.model';
import { LogoComponent } from '../../shared/components/logo.component';
import { FieldComponent } from '../../shared/components/field.component';

const PERFIS_SENSIVEIS = ['COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA'];
const ROLE_LABELS: Record<string, string> = {
  FORNECEDOR: 'Vendedor',
  COMPRADOR: 'Comprador',
  FINANCEIRO: 'Financeiro',
  COMPANY_ADMIN: 'Administrador da empresa',
};

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  imports: [RouterLink, LogoComponent, FieldComponent],
  templateUrl: './accept-invite.component.html',
})
export class AcceptInviteComponent {
  private readonly token: string;

  readonly invite = signal<ResolvedInviteDto | null>(null);
  readonly loadError = signal('');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly termsAccepted = signal(false);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly done = signal(false);

  // Um convite de COMPANY_ADMIN só acontece quando a empresa acaba de nascer
  // (candidatura aprovada) — não há administrador nenhum à espera de confirmar.
  readonly isFounding = computed(() => this.invite()?.role === 'COMPANY_ADMIN');

  readonly minimoSenha = computed(() => (this.invite() && PERFIS_SENSIVEIS.includes(this.invite()!.role) ? 12 : 10));

  constructor(
    route: ActivatedRoute,
    private readonly inviteService: InviteService,
  ) {
    this.token = route.snapshot.paramMap.get('token')!;
    this.inviteService.resolve(this.token).subscribe({
      next: (invite) => {
        this.invite.set(invite);
        if (invite.name) this.name.set(invite.name);
        if (invite.email) this.email.set(invite.email);
      },
      error: (e) => this.loadError.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  roleLabel(role: string): string {
    return ROLE_LABELS[role] || role;
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.submitting.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        this.inviteService
          .accept(this.token, { name: this.name(), email: this.email(), password: this.password(), termsAccepted: true })
          .subscribe({ next: () => resolve(), error: (e) => reject(e) });
      });
      this.done.set(true);
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.submitting.set(false);
    }
  }
}
