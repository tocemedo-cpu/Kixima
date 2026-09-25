// Porta de frontend/src/pages/companyAdmin/Users.jsx.
import { Component, computed, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CompaniesService } from '../admin/companies.service';
import { TeamService } from './team.service';
import { CompanyDetail } from '../../core/models/company.model';
import { CompanyUserDto } from '../../core/models/invite.model';
import { InviteDto } from '../../core/models/invite-management.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDateTime } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { IconComponent } from '../../shared/components/icon.component';

interface RoleOption {
  value: string;
  label: string;
}

const ROLE_OPTIONS: Record<string, RoleOption[]> = {
  CLIENTE: [{ value: 'COMPRADOR', label: 'Comprador' }, { value: 'FINANCEIRO', label: 'Financeiro' }],
  FORNECEDOR: [
    { value: 'COMPRADOR', label: 'Comprador' }, { value: 'FORNECEDOR', label: 'Vendedor' }, { value: 'FINANCEIRO', label: 'Financeiro' },
  ],
};
const ROLE_TONE: Record<string, string> = { COMPANY_ADMIN: 'danger', COMPRADOR: 'info', FORNECEDOR: 'success', FINANCEIRO: 'pending' };
const INVITE_TONE: Record<string, string> = { PENDENTE: 'pending', ACEITO: 'success', EXPIRADO: 'neutral', CANCELADO: 'danger' };
const INVITE_LABEL: Record<string, string> = { PENDENTE: 'Pendente', ACEITO: 'Aceito', EXPIRADO: 'Expirado', CANCELADO: 'Cancelado' };
const PERFIS = [
  { icon: 'cart', t: 'Comprador', d: 'Cria pedidos, solicita cotações e acompanha compras.' },
  { icon: 'suppliers', t: 'Vendedor', d: 'Envia propostas, negoceia e acompanha oportunidades.' },
  { icon: 'payment', t: 'Financeiro', d: 'Gerencia pagamentos, faturas e reconciliações.' },
  { icon: 'approvals', t: 'Company Admin', d: 'Aprova processos, contratos e gere a equipa.' },
];

function initials(n = ''): string {
  return n.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, PillComponent, ToolbarComponent, EmptyRowComponent, ErrorBannerComponent, IconComponent],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  readonly company = signal<CompanyDetail | null>(null);
  readonly users = signal<CompanyUserDto[] | null>(null);
  readonly invites = signal<InviteDto[]>([]);
  readonly q = signal('');
  readonly role = signal('COMPRADOR');
  readonly name = signal('');
  readonly email = signal('');
  readonly error = signal<string | ApiError | null>(null);
  readonly formError = signal<string | ApiError | null>(null);
  readonly toast = signal('');
  readonly busy = signal(false);
  readonly modal = signal(false);

  readonly ROLE_TONE = ROLE_TONE;
  readonly INVITE_TONE = INVITE_TONE;
  readonly INVITE_LABEL = INVITE_LABEL;
  readonly PERFIS = PERFIS;
  initials = initials;
  formatDateTime = formatDateTime;

  readonly options = computed<RoleOption[]>(() => (this.company() ? ROLE_OPTIONS[this.company()!.type] || [] : []));
  readonly companyType = computed(() => this.company()?.type);

  readonly pending = computed(() => (this.users() || []).filter((u) => !u.active));
  readonly list = computed(() => {
    const termo = this.q().toLowerCase();
    return (this.users() || []).filter((u) => !termo || u.name.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo));
  });

  constructor(
    private readonly auth: AuthService,
    private readonly companiesService: CompaniesService,
    private readonly teamService: TeamService,
  ) {
    const companyId = this.auth.user()?.companyId;
    if (companyId) {
      this.companiesService.get(companyId).subscribe({ next: (c) => this.company.set(c), error: () => {} });
    }
    this.loadUsers();
    this.loadInvites();
  }

  roleLabel(role: string): string {
    const companyType = this.companyType();
    if (role === 'COMPANY_ADMIN') return 'Company Admin';
    if (role === 'FORNECEDOR') return companyType === 'FORNECEDOR' ? 'Vendedor' : 'Fornecedor';
    if (role === 'COMPRADOR') return 'Comprador';
    if (role === 'FINANCEIRO') return 'Financeiro';
    return role;
  }

  private loadUsers(): void {
    this.teamService.listUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (e) => this.error.set(e),
    });
  }

  private loadInvites(): void {
    this.teamService.listInvites().subscribe({ next: (invites) => this.invites.set(invites), error: () => {} });
  }

  private flash(m: string): void {
    this.toast.set(m);
    setTimeout(() => this.toast.set(''), 3500);
  }

  openInviteModal(): void {
    this.modal.set(true);
    this.formError.set(null);
    this.name.set('');
    this.email.set('');
    this.role.set(this.options()[0]?.value || 'COMPRADOR');
  }

  async sendInvite(): Promise<void> {
    this.formError.set(null);
    this.busy.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        this.teamService.createInvite({ role: this.role(), name: this.name(), email: this.email() }).subscribe({
          next: () => resolve(),
          error: (e) => reject(e),
        });
      });
      this.modal.set(false);
      this.flash('Convite enviado com sucesso para o email do funcionário.');
      this.loadInvites();
    } catch (e) {
      this.formError.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  resendInvite(id: string, to: string): void {
    this.teamService.resendInvite(id).subscribe({
      next: () => {
        this.flash(`Convite reenviado para ${to}.`);
        this.loadInvites();
      },
      error: (e) => this.error.set(e),
    });
  }

  cancelInvite(id: string): void {
    this.teamService.cancelInvite(id).subscribe({
      next: () => {
        this.flash('Convite cancelado.');
        this.loadInvites();
      },
      error: (e) => this.error.set(e),
    });
  }

  accept(id: string, name: string): void {
    this.teamService.activateUser(id).subscribe({
      next: () => {
        this.flash(`Cadastro de ${name} aceite.`);
        this.loadUsers();
      },
      error: (e) => this.error.set(e),
    });
  }

  reject(id: string, name: string): void {
    this.teamService.removeUser(id).subscribe({
      next: () => {
        this.flash(`Cadastro de ${name} removido.`);
        this.loadUsers();
      },
      error: (e) => this.error.set(e),
    });
  }
}
