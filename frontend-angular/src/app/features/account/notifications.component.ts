// Porta de frontend/src/pages/shared/Notifications.jsx.
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsService } from '../../core/services/notifications.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationDto } from '../../core/models/notification.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDateTime, resolverDestinoNotificacao } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { LoadingComponent } from '../../shared/components/loading.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [PageHeaderComponent, ErrorBannerComponent, LoadingComponent],
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent {
  readonly notifications = signal<NotificationDto[] | null>(null);
  readonly error = signal('');

  readonly formatDateTime = formatDateTime;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {
    this.load();
  }

  private load(): void {
    this.notificationsService.list(undefined, 100).subscribe({
      next: (r) => this.notifications.set(r.itens || []),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  destino(n: NotificationDto): string | null {
    return resolverDestinoNotificacao(n, this.auth.user());
  }

  clicavel(n: NotificationDto): boolean {
    return !n.readAt || !!this.destino(n);
  }

  abrir(n: NotificationDto): void {
    if (!this.clicavel(n)) return;
    if (!n.readAt) {
      this.notificationsService.markRead(n.id).subscribe({
        next: () => {
          this.notifications.update((prev) => (prev ? prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : prev));
        },
        error: () => {
          // silencioso, tal como o React.
        },
      });
    }
    const destino = this.destino(n);
    if (destino) this.router.navigateByUrl(destino);
  }
}
