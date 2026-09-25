// Porta de frontend/src/pages/shared/AcceptAdminInvite.jsx.
import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminInviteService } from './admin-invite.service';
import { ResolvedAdminInviteDto } from '../../core/models/invite.model';
import { ApiError } from '../../core/models/api-error.model';
import { LogoComponent } from '../../shared/components/logo.component';
import { ADMIN_AREA_LABELS } from '../../shared/domain';

@Component({
  selector: 'app-accept-admin-invite',
  standalone: true,
  imports: [RouterLink, LogoComponent],
  templateUrl: './accept-admin-invite.component.html',
})
export class AcceptAdminInviteComponent {
  private readonly token: string;

  readonly invite = signal<ResolvedAdminInviteDto | null>(null);
  readonly loadError = signal('');
  readonly password = signal('');
  readonly termsAccepted = signal(false);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly done = signal(false);

  readonly ADMIN_AREA_LABELS = ADMIN_AREA_LABELS;

  constructor(
    route: ActivatedRoute,
    private readonly adminInviteService: AdminInviteService,
  ) {
    this.token = route.snapshot.paramMap.get('token')!;
    this.adminInviteService.resolve(this.token).subscribe({
      next: (invite) => this.invite.set(invite),
      error: (e) => this.loadError.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.submitting.set(true);
    try {
      // Só senha + aceite dos termos — mesmo que houvesse um campo de áreas
      // aqui, o servidor despe-o do pedido antes de o ler.
      await new Promise<void>((resolve, reject) => {
        this.adminInviteService
          .accept(this.token, { password: this.password(), termsAccepted: true })
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
