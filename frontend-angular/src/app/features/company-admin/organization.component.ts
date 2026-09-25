// Porta de frontend/src/pages/companyAdmin/Organization.jsx.
import { Component, computed, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from './organization.service';
import { OrganizacaoResponse } from '../../core/models/organizacao.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { IconComponent } from '../../shared/components/icon.component';
import { BankDetailsPanelComponent } from './bank-details-panel.component';

interface ResumoCard {
  icon: string;
  t: number;
  s: string;
}

@Component({
  selector: 'app-organization',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, PillComponent, IconComponent, BankDetailsPanelComponent],
  templateUrl: './organization.component.html',
})
export class OrganizationComponent {
  readonly data = signal<OrganizacaoResponse | null>(null);
  readonly error = signal('');

  formatDate = formatDate;

  readonly typeLabel = computed(() =>
    this.data()!.company.type === 'FORNECEDOR' ? 'Prestadora de Serviços' : 'Empresa Cliente',
  );

  readonly location = computed(() => {
    const c = this.data()!.company;
    return [c.city, c.province, c.country].filter(Boolean).join(', ') || 'Angola';
  });

  readonly contactAddress = computed(() => {
    const c = this.data()!.company;
    return c.address || [c.city, c.country].filter(Boolean).join(', ') || 'Angola';
  });

  readonly resumo = computed<ResumoCard[]>(() => {
    const s = this.data()!.summary;
    return [
      { icon: 'users', t: s.users, s: 'Usuários' },
      { icon: 'contract', t: s.contracts, s: 'Contratos' },
      { icon: 'reception', t: s.documents, s: 'Documentos' },
      { icon: 'certification', t: s.certifications, s: 'Certificações/Apólices' },
    ];
  });

  constructor(
    readonly auth: AuthService,
    private readonly organizationService: OrganizationService,
  ) {
    this.organizationService.organizacao().subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }
}
