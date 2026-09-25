// Porta de frontend/src/pages/companyAdmin/Contracts.jsx.
import { Component, computed, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ContractsService } from './contracts.service';
import { ContractDto } from '../../core/models/contract.model';
import { ApiError } from '../../core/models/api-error.model';
import { CONTRACT_STATUS, BILLING_PERIODICITY, formatMoney, formatDate } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';

const TRINTA_DIAS_MS = 30 * 864e5;

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent, EmptyRowComponent],
  templateUrl: './contracts.component.html',
})
export class ContractsComponent {
  readonly rows = signal<ContractDto[] | null>(null);
  readonly q = signal('');
  readonly error = signal('');

  readonly CONTRACT_STATUS = CONTRACT_STATUS;
  readonly BILLING_PERIODICITY = BILLING_PERIODICITY;
  formatMoney = formatMoney;
  formatDate = formatDate;

  // Contraparte: a OUTRA empresa do contrato, vista pela empresa do utilizador
  // actual — mesma regra de Contracts.jsx (c.clientCompanyId === user.companyId ? supplier : client).
  contraparte = (c: ContractDto): { id: string; name: string } | null => {
    const companyId = this.auth.user()?.companyId;
    return c.clientCompanyId === companyId ? c.supplierCompany : c.clientCompany;
  };

  readonly kpis = computed(() => {
    const r = this.rows() || [];
    const in30 = Date.now() + TRINTA_DIAS_MS;
    return {
      total: r.length,
      ativos: r.filter((c) => c.status === 'ATIVO').length,
      aVencer: r.filter((c) => c.status === 'ATIVO' && new Date(c.validUntil).getTime() <= in30).length,
      vencidos: r.filter((c) => c.status === 'EXPIRADO').length,
      valor: r.reduce((s, c) => s + Number(c.totalValue || 0), 0),
    };
  });

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.kpis();
    return [
      { icon: 'contract', tone: 'info', label: 'Total de Contratos', value: k.total, sub: 'Todos os contratos' },
      { icon: 'certification', tone: 'success', label: 'Ativos', value: k.ativos, sub: 'Contratos ativos' },
      { icon: 'history', tone: 'pending', label: 'A Vencer (30 dias)', value: k.aVencer, sub: 'Próximos do vencimento' },
      { icon: 'approvals', tone: 'danger', label: 'Vencidos', value: k.vencidos, sub: 'Contratos vencidos' },
      { icon: 'payment', tone: 'neutral', label: 'Valor Total', value: formatMoney(k.valor), sub: 'Valor dos contratos' },
    ];
  });

  readonly list = computed(() => {
    const termo = this.q().toLowerCase();
    return (this.rows() || []).filter(
      (c) => !termo || c.reference.toLowerCase().includes(termo) || (this.contraparte(c)?.name || '').toLowerCase().includes(termo),
    );
  });

  readonly proximosAVencer = computed(() =>
    (this.rows() || [])
      .filter((c) => c.status === 'ATIVO')
      .sort((a, b) => new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime())
      .slice(0, 5),
  );

  constructor(
    private readonly auth: AuthService,
    private readonly contractsService: ContractsService,
  ) {
    this.contractsService.list().subscribe({
      next: (rows) => this.rows.set(rows),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar os contratos.'),
    });
  }
}
