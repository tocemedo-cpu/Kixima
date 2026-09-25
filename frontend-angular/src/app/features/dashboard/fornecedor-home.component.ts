// Porta de frontend/src/pages/fornecedor/Home.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from '../orders/orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { DataTableComponent } from '../../shared/components/data-table.component';
import { TableColumnDirective } from '../../shared/components/table-column.directive';
import { BadgeComponent } from '../../shared/components/badge.component';

@Component({
  selector: 'app-fornecedor-home',
  standalone: true,
  imports: [
    PageHeaderComponent,
    LoadingComponent,
    ErrorBannerComponent,
    StatCardComponent,
    DataTableComponent,
    TableColumnDirective,
    BadgeComponent,
  ],
  templateUrl: './fornecedor-home.component.html',
})
export class FornecedorHomeComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly formatDate = formatDate;
  readonly formatMoney = formatMoney;

  readonly novas = computed(() => (this.orders() || []).filter((o) => o.status === 'APROVADA'));
  readonly aguardandoPagamento = computed(() =>
    (this.orders() || []).filter((o) => o.status === 'ACEITE_FORNECEDOR' || o.status === 'AGUARDANDO_PAGAMENTO'),
  );
  readonly pagas = computed(() => (this.orders() || []).filter((o) => o.paidAt));
  readonly recentes = computed(() => (this.orders() || []).slice(0, 8));

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.ordersService.list().subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  verOrdem(row: PurchaseOrderDto): void {
    this.router.navigate(['/fornecedor/ordens', row.id]);
  }
}
