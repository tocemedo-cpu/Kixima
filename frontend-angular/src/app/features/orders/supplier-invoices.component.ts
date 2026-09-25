// Porta de frontend/src/pages/fornecedor/Invoices.jsx.
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService, PurchaseOrdersPage } from './orders.service';
import { ApiError } from '../../core/models/api-error.model';
import { INVOICE_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { PaginationComponent } from '../../shared/buyer-ui/pagination.component';

@Component({
  selector: 'app-supplier-invoices',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, BadgeComponent, PaginationComponent],
  templateUrl: './supplier-invoices.component.html',
})
export class SupplierInvoicesComponent {
  readonly data = signal<PurchaseOrdersPage | null>(null);
  readonly page = signal(1);
  readonly error = signal('');

  readonly INVOICE_STATUS = INVOICE_STATUS;
  formatDate = formatDate;
  formatMoney = formatMoney;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.ordersService.listPage({ invoiced: 'true', page: this.page(), limit: 15 }).subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as faturas.'),
    });
  }

  irPara(page: number): void {
    this.page.set(page);
    this.load();
  }

  verDetalhe(id: string): void {
    this.router.navigateByUrl(`/fornecedor/ordens/${id}`);
  }
}
