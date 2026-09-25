// Porta de frontend/src/pages/comprador/Deliveries.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { DeliveriesResponse } from '../../core/models/buyer-tracking.model';
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
  { key: 'TODAS', label: 'Todas' }, { key: 'EM_TRANSITO', label: 'Em Trânsito' },
  { key: 'EM_PREPARACAO', label: 'Em Preparação' }, { key: 'ENTREGUE', label: 'Entregues' },
  { key: 'CANCELADA', label: 'Canceladas' },
];
const STAGE_TONE: Record<string, string> = { EM_TRANSITO: 'info', EM_PREPARACAO: 'pending', ENTREGUE: 'success', CANCELADA: 'danger' };
const BAR_COLOR: Record<string, string> = { EM_TRANSITO: 'var(--ocre)', EM_PREPARACAO: 'var(--aviso)', ENTREGUE: 'var(--verde)', CANCELADA: 'var(--vermelho)' };

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent,
    EmptyRowComponent, SupplierCellComponent, TabsComponent, IconComponent,
  ],
  templateUrl: './deliveries.component.html',
})
export class DeliveriesComponent {
  readonly tabs = TABS;
  readonly tab = signal('TODAS');
  readonly q = signal('');
  readonly data = signal<DeliveriesResponse | null>(null);
  readonly error = signal('');

  readonly STAGE_TONE = STAGE_TONE;
  readonly BAR_COLOR = BAR_COLOR;
  formatDate = formatDate;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'truck', tone: 'info', label: 'Em Trânsito', value: k?.emTransito ?? '—', sub: 'Pedidos a caminho' },
      { icon: 'box', tone: 'pending', label: 'Em Preparação', value: k?.emPreparacao ?? '—', sub: 'Aguardando coleta' },
      { icon: 'reception', tone: 'success', label: 'Entregues', value: k?.entregues ?? '—', sub: 'Últimos 90 dias' },
      { icon: 'approvals', tone: 'danger', label: 'Canceladas', value: k?.canceladas ?? '—', sub: 'Últimos 90 dias' },
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
    this.ordersService.buyerDeliveries(this.tab(), this.q() || undefined).subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as entregas.'),
    });
  }

  verOrdem(poId: string): void {
    this.router.navigateByUrl(`/comprador/ordens/${poId}`);
  }
}
