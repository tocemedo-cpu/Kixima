// Porta de frontend/src/pages/fornecedor/OrdersReceived.jsx.
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';

@Component({
  selector: 'app-orders-received',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, BadgeComponent],
  templateUrl: './orders-received.component.html',
})
export class OrdersReceivedComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly error = signal('');
  readonly statusFilter = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly statusEntries = Object.entries(PO_STATUS);
  formatDate = formatDate;
  formatMoney = formatMoney;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.load();
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.ordersService.list(this.statusFilter() || undefined).subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as ordens.'),
    });
  }

  verDetalhe(id: string): void {
    this.router.navigateByUrl(`/fornecedor/ordens/${id}`);
  }
}
