// Porta de frontend/src/pages/companyAdmin/Approvals.jsx.
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent],
  templateUrl: './approvals.component.html',
})
export class ApprovalsComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly error = signal('');

  formatDate = formatDate;
  formatMoney = formatMoney;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.ordersService.list('AGUARDANDO_APROVACAO').subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as ordens.'),
    });
  }

  rever(id: string): void {
    this.router.navigateByUrl(`/empresa/aprovacoes/${id}`);
  }
}
