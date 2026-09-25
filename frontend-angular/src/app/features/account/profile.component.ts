// Porta de frontend/src/pages/shared/Profile.jsx. Perfil pessoal — mesmo
// formato para todas as personas. Ligado a GET /api/users/profile.
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from './profile.service';
import { ProfileResponse } from '../../core/models/profile.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, ROLE_LABELS, ROLE_HOME, formatMoney, formatDateTime } from '../../shared/domain';
import { PersonaRole } from '../../core/models/user.model';
import { CrumbsComponent, TrilhoItem } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarUploaderComponent } from '../../shared/components/avatar-uploader.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, IconComponent, AvatarUploaderComponent],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  readonly data = signal<ProfileResponse | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly formatDateTime = formatDateTime;

  readonly trail = computed<TrilhoItem[]>(() => {
    const role = this.auth.user()?.role;
    return [{ label: 'Home', to: (role && ROLE_HOME[role]) || '/' }, 'Perfil'];
  });

  readonly kpiCards = computed<KpiCard[]>(() =>
    (this.data()?.cards || []).map((c) => ({
      icon: c.icon,
      tone: c.tone,
      label: c.label,
      value: c.money ? formatMoney(c.value) : c.value,
      sub: c.sub,
    })),
  );

  constructor(
    readonly auth: AuthService,
    private readonly profileService: ProfileService,
  ) {
    this.load();
  }

  private load(): void {
    this.profileService.profile().subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  roleLabel(role: string): string {
    return ROLE_LABELS[role as PersonaRole] || role;
  }

  localizacao(): string {
    const c = this.data()?.company;
    return [c?.city, c?.country].filter(Boolean).join(', ') || 'Angola';
  }

  setAvatar(avatarUrl: string | null): void {
    this.data.update((d) => (d ? { ...d, user: { ...d.user, avatarUrl } } : d));
    this.auth.updateUser({ avatarUrl });
  }
}
