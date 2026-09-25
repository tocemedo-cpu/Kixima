// Porta de frontend/src/pages/comprador/Receptions.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { ReceptionsResponse } from '../../core/models/buyer-tracking.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate } from '../../shared/domain';
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
  { key: 'TODOS', label: 'Todos' }, { key: 'A_RECEBER', label: 'A Receber' },
  { key: 'RECEBIDO', label: 'Recebidos' }, { key: 'DIVERGENCIA', label: 'Com Divergência' },
];
const ST: Record<string, { tone: string; label: string }> = {
  A_RECEBER: { tone: 'info', label: 'A Receber' },
  RECEBIDO: { tone: 'success', label: 'Recebido' },
  DIVERGENCIA: { tone: 'danger', label: 'Com Divergência' },
};

@Component({
  selector: 'app-receptions',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent,
    EmptyRowComponent, SupplierCellComponent, TabsComponent, IconComponent,
  ],
  templateUrl: './receptions.component.html',
})
export class ReceptionsComponent {
  readonly tabs = TABS;
  readonly tab = signal('TODOS');
  readonly q = signal('');
  readonly data = signal<ReceptionsResponse | null>(null);
  readonly error = signal('');

  readonly ST = ST;
  formatDate = formatDate;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'truck', tone: 'info', label: 'A Receber', value: k?.aReceber ?? '—', sub: 'Itens aguardando' },
      { icon: 'reception', tone: 'success', label: 'Recebidos', value: k?.recebidos ?? '—', sub: 'Últimos 90 dias' },
      { icon: 'approvals', tone: 'danger', label: 'Com Divergência', value: k?.divergencia ?? '—', sub: 'Requerem atenção' },
      { icon: 'box', tone: 'neutral', label: 'Total de Itens', value: k?.total ?? '—', sub: 'Últimos 90 dias' },
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
    this.ordersService.buyerReceptions(this.tab(), this.q() || undefined).subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as receções.'),
    });
  }

  verOrdem(poId: string): void {
    this.router.navigateByUrl(`/comprador/ordens/${poId}`);
  }
}
