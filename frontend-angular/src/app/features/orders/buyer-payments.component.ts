// Porta de frontend/src/pages/comprador/Payments.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { BuyerPaymentRow, BuyerPaymentsResponse } from '../../core/models/buyer-payments.model';
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
  { key: '', label: 'Todos' }, { key: 'ABERTO', label: 'Em Aberto' },
  { key: 'CONCLUIDO', label: 'Concluídos' }, { key: 'ATRASADO', label: 'Atrasados' },
];

@Component({
  selector: 'app-buyer-payments',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent,
    EmptyRowComponent, SupplierCellComponent, TabsComponent, IconComponent,
  ],
  templateUrl: './buyer-payments.component.html',
})
export class BuyerPaymentsComponent {
  readonly tabs = TABS;
  readonly tab = signal('');
  readonly q = signal('');
  readonly data = signal<BuyerPaymentsResponse | null>(null);
  readonly error = signal('');

  readonly INVOICE_STATUS = INVOICE_STATUS;
  formatMoney = formatMoney;
  formatDate = formatDate;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'payment', tone: 'pending', label: 'Valor Total a Pagar', value: k ? formatMoney(k.aPagar) : '—', sub: 'Em aberto' },
      { icon: 'wallet', tone: 'success', label: 'Pagamentos Concluídos', value: k ? formatMoney(k.concluidos) : '—', sub: 'Este mês' },
      { icon: 'approvals', tone: 'danger', label: 'Pagamentos Atrasados', value: k ? formatMoney(k.atrasados) : '—', sub: 'Requer atenção' },
      { icon: 'invoice', tone: 'info', label: 'Valor Total das PO', value: k ? formatMoney(k.totalPO) : '—', sub: 'Todas as faturas' },
    ];
  });

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.load();
  }

  setTab(tab: string): void {
    this.tab.set(tab);
    this.load();
  }

  onQ(q: string): void {
    this.q.set(q);
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.ordersService.buyerPayments(this.tab() || undefined, this.q() || undefined).subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar os pagamentos.'),
    });
  }

  verOrdem(poId: string): void {
    this.router.navigateByUrl(`/comprador/ordens/${poId}`);
  }

  irParaAjuda(): void {
    this.router.navigateByUrl('/ajuda');
  }

  readonly items = computed<BuyerPaymentRow[]>(() => this.data()?.items || []);
}
