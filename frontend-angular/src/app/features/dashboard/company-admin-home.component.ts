// Porta de frontend/src/pages/companyAdmin/Home.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { CompanyAdminDashboardResponse } from '../../core/models/dashboard.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatMoney, formatDateTime } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-company-admin-home',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, IconComponent],
  templateUrl: './company-admin-home.component.html',
})
export class CompanyAdminHomeComponent {
  readonly d = signal<CompanyAdminDashboardResponse | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly formatDateTime = formatDateTime;

  readonly maxVolume = computed(() => Math.max(1, ...this.d()!.volume.map((v) => v.value)));

  readonly kpisTopo = computed<KpiCard[]>(() => {
    const d = this.d()!;
    return [
      { icon: 'orders', tone: 'info', label: 'Ordens de Compra', value: d.kpis.pedidos, sub: 'Total da empresa', to: '/empresa/aprovacoes' },
      { icon: 'truck', tone: 'pending', label: 'Em Execução', value: d.kpis.emExecucao, sub: 'A decorrer', to: '/empresa/aprovacoes' },
      { icon: 'payment', tone: 'success', label: 'Volume de Negócios', value: formatMoney(d.kpis.volumeNegocios), sub: 'Valor total' },
      { icon: 'approvals', tone: 'danger', label: 'POs a Aprovar', value: d.kpis.aprovarPO, sub: 'Requerem a sua ação', to: '/empresa/aprovacoes' },
    ];
  });

  readonly kpisResumo = computed<KpiCard[]>(() => {
    const d = this.d()!;
    return [
      { icon: 'users', tone: 'info', label: 'Usuários Ativos', value: d.resumo.usuariosAtivos, sub: 'Na empresa', to: '/empresa/utilizadores' },
      { icon: 'contract', tone: 'success', label: 'Contratos Ativos', value: d.resumo.contratosAtivos, sub: `de ${d.resumo.totalContratos}`, to: '/empresa/contratos' },
      { icon: 'reception', tone: 'pending', label: 'Ordens Concluídas', value: d.resumo.concluidas, sub: 'Recebidas' },
      { icon: 'shield', tone: 'success', label: 'Compliance', value: `${d.resumo.compliance}%`, sub: 'Conformidade' },
    ];
  });

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly router: Router,
  ) {
    this.dashboardService.companyAdmin().subscribe({
      next: (d) => this.d.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  ir(caminho: string): void {
    this.router.navigateByUrl(caminho);
  }

  alturaBarra(value: number): number {
    return Math.round((value / this.maxVolume()) * 100);
  }
}
