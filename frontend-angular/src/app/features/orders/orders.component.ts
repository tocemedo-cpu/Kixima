// Porta de frontend/src/pages/comprador/Orders.jsx.
import { Component, computed, effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { BuyerOrdersResult } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { TabsComponent, TabDef } from '../../shared/buyer-ui/tabs.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { SupplierCellComponent } from '../../shared/buyer-ui/supplier-cell.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { PaginationComponent } from '../../shared/buyer-ui/pagination.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';

const TABS: TabDef[] = [
  { key: '', label: 'Todas as Ordens' }, { key: 'ANDAMENTO', label: 'Em Andamento' },
  { key: 'CONCLUIDAS', label: 'Concluídas' }, { key: 'CANCELADAS', label: 'Canceladas' },
];

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, TabsComponent, ToolbarComponent,
    SupplierCellComponent, PillComponent, EmptyRowComponent, PaginationComponent, IconComponent, ErrorBannerComponent,
  ],
  templateUrl: './orders.component.html',
})
export class OrdersComponent {
  readonly TABS = TABS;
  readonly tab = signal('');
  readonly q = signal('');
  readonly page = signal(1);
  readonly data = signal<BuyerOrdersResult | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  formatDate = formatDate;
  formatMoney = formatMoney;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'orders', tone: 'info', label: 'Total de Ordens', value: k?.total ?? '—', sub: 'Todas as PO emitidas' },
      { icon: 'payment', tone: 'pending', label: 'Valor Total das PO', value: k ? formatMoney(k.valorTotal) : '—', sub: 'Valor total' },
      { icon: 'truck', tone: 'info', label: 'Em Andamento', value: k?.emAndamento ?? '—', sub: 'PO em processamento' },
      { icon: 'reception', tone: 'success', label: 'Concluídas', value: k?.concluidas ?? '—', sub: 'PO concluídas' },
      { icon: 'approvals', tone: 'danger', label: 'Canceladas', value: k?.canceladas ?? '—', sub: 'PO canceladas' },
    ];
  });

  private ultimoFiltro = '';

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    // Um único efeito: se tab/q mudaram desde a última execução, volta à 1ª
    // página primeiro (mesma regra do React: dois useEffect separados, um
    // "reset page" e outro "fetch" — aqui combinados para nunca disparar
    // dois pedidos por uma só mudança de filtro).
    effect(() => {
      const filtro = `${this.tab()}::${this.q()}`;
      const pagina = filtro === this.ultimoFiltro ? this.page() : 1;
      this.ultimoFiltro = filtro;
      if (pagina !== this.page()) {
        this.page.set(pagina);
        return; // a mudança de `page` volta a disparar este efeito com a página certa.
      }
      this.load(pagina);
    });
  }

  private load(page: number): void {
    this.error.set('');
    this.ordersService
      .buyerOrders({ status: this.tab() || undefined, q: this.q() || undefined, page, limit: 15 })
      .subscribe({
        next: (d) => this.data.set(d),
        error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as ordens.'),
      });
  }

  verDetalhe(id: string): void {
    this.router.navigateByUrl(`/comprador/ordens/${id}`);
  }
}
