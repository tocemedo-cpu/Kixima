// Porta de frontend/src/pages/financeiro/Home.jsx (função FinanceiroHome —
// escolhe entre esta vista CLIENTE e SupplierFinanceCenterComponent consoante
// o tipo de empresa, tal como o React fazia dentro do mesmo ficheiro).
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { FinanceiroOverviewResponse } from '../../core/models/financeiro.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney, formatDate } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { IconComponent } from '../../shared/components/icon.component';
import { SupplierFinanceCenterComponent } from './supplier-finance-center.component';

@Component({
  selector: 'app-financeiro-home',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, IconComponent, SupplierFinanceCenterComponent],
  templateUrl: './financeiro-home.component.html',
})
export class FinanceiroHomeComponent {
  readonly isSupplierSide: boolean;
  readonly d = signal<FinanceiroOverviewResponse | null>(null);
  readonly error = signal('');

  readonly formatMoney = formatMoney;
  readonly formatDate = formatDate;

  readonly maxSerie = computed(() => Math.max(1, ...this.d()!.series.map((s) => Math.max(s.faturas, s.pagamentos))));

  readonly kpis = computed<KpiCard[]>(() => {
    const d = this.d()!;
    return [
      { icon: 'payment', tone: 'danger', label: 'Pagamentos Pendentes', value: formatMoney(d.kpis.pagamentosPendentes), sub: `${d.kpis.pagamentosPendentesCount} faturas`, to: '/financeiro/faturas' },
      { icon: 'invoice', tone: 'info', label: 'Faturas Recebidas', value: d.kpis.faturasRecebidas, sub: 'Total', to: '/financeiro/historico' },
      { icon: 'wallet', tone: 'success', label: 'Pagamentos (Mês)', value: formatMoney(d.kpis.pagosMes), sub: 'Processados' },
      { icon: 'approvals', tone: 'pending', label: 'A Aprovar/Pagar', value: d.kpis.aprovacoesPendentes, sub: `${d.kpis.aVencer7} a vencer em 7 dias`, to: '/financeiro/faturas' },
    ];
  });

  constructor(
    auth: AuthService,
    private readonly financeiroService: FinanceiroService,
    private readonly router: Router,
  ) {
    this.isSupplierSide = auth.user()?.companyType === 'FORNECEDOR';
    if (!this.isSupplierSide) {
      this.financeiroService.overview().subscribe({
        next: (d) => this.d.set(d),
        error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
      });
    }
  }

  alturaBarra(value: number): number {
    return Math.round((value / this.maxSerie()) * 100);
  }

  ir(caminho: string): void {
    this.router.navigateByUrl(caminho);
  }
}
