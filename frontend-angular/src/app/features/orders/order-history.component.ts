// Porta de frontend/src/pages/fornecedor/OrderHistory.jsx. Ordens já
// concluídas/fechadas recebidas pela empresa.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';

const CLOSED = new Set(['CONCLUIDA', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA']);

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, BadgeComponent],
  templateUrl: './order-history.component.html',
})
export class OrderHistoryComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly formatDate = formatDate;
  readonly formatMoney = formatMoney;

  readonly closed = computed(() => (this.orders() || []).filter((o) => CLOSED.has(o.status)));

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.ordersService.list().subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  verOrdem(id: string): void {
    this.router.navigate(['/fornecedor/ordens', id]);
  }
}
