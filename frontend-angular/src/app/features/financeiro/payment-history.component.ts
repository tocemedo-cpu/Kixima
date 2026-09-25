// Porta de frontend/src/pages/financeiro/PaymentHistory.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroInvoiceRow, FinanceiroPaymentsResponse } from '../../core/models/financeiro.model';
import { ApiError } from '../../core/models/api-error.model';
import { INVOICE_STATUS, formatMoney, formatDate } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { SupplierCellComponent } from '../../shared/buyer-ui/supplier-cell.component';
import { TabsComponent, TabDef } from '../../shared/buyer-ui/tabs.component';
import { IconComponent } from '../../shared/components/icon.component';

const TABS: TabDef[] = [
  { key: '', label: 'Todos' }, { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'PAGO', label: 'Pagos' }, { key: 'VENCIDO', label: 'Vencidos' },
];

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent,
    EmptyRowComponent, SupplierCellComponent, TabsComponent, IconComponent,
  ],
  templateUrl: './payment-history.component.html',
})
export class PaymentHistoryComponent {
  readonly tabs = TABS;
  readonly tab = signal('');
  readonly q = signal('');
  readonly data = signal<FinanceiroPaymentsResponse | null>(null);
  readonly error = signal('');

  readonly INVOICE_STATUS = INVOICE_STATUS;
  formatMoney = formatMoney;
  formatDate = formatDate;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'payment', tone: 'pending', label: 'Total a Pagar', value: k ? formatMoney(k['aPagar']) : '—', sub: 'Em aberto' },
      { icon: 'wallet', tone: 'success', label: 'Pagos (Mês)', value: k ? formatMoney(k['pagosMes']) : '—', sub: 'Processados' },
      { icon: 'approvals', tone: 'danger', label: 'Vencidos', value: k ? formatMoney(k['vencidos']) : '—', sub: 'Requerem atenção' },
      { icon: 'invoice', tone: 'info', label: 'Total de Faturas', value: k?.['total'] ?? '—', sub: 'Da empresa' },
    ];
  });

  readonly items = computed(() => {
    const termo = this.q().toLowerCase();
    return (this.data()?.items || []).filter(
      (i) => !termo || i.reference.toLowerCase().includes(termo) || (i.supplier || '').toLowerCase().includes(termo),
    );
  });

  constructor(
    private readonly financeiroService: FinanceiroService,
    private readonly router: Router,
  ) {
    this.load();
  }

  setTab(tab: string): void {
    this.tab.set(tab);
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.financeiroService.payments(this.tab() || undefined).subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar os pagamentos.'),
    });
  }

  vencida(i: FinanceiroInvoiceRow): boolean {
    return i.status === 'PENDENTE' && new Date(i.dueAt).getTime() < Date.now();
  }

  verFatura(poId: string): void {
    this.router.navigateByUrl(`/documento/fatura/${poId}`);
  }

  verPo(poId: string): void {
    this.router.navigateByUrl(`/documento/po/${poId}`);
  }
}
