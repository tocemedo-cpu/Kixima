// Porta de frontend/src/pages/fornecedor/Payments.jsx. Mesma página serve
// duas rotas/personas — FORNECEDOR (/fornecedor/pagamentos) e FINANCEIRO
// (/financeiro/recebidos, quando a empresa também vende) — ver
// frontend/src/App.jsx:236,268. O destino do detalhe muda consoante o papel.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, formatDateTime, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';

@Component({
  selector: 'app-supplier-payments',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, BadgeComponent],
  templateUrl: './supplier-payments.component.html',
})
export class SupplierPaymentsComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly error = signal('');
  readonly toast = signal('');
  readonly confirming = signal<string | null>(null);

  formatDate = formatDate;
  formatDateTime = formatDateTime;
  formatMoney = formatMoney;

  readonly orderPath = computed(() => (this.auth.user()?.role === 'FINANCEIRO' ? '/financeiro/ordens' : '/fornecedor/ordens'));

  // Só as VENDAS da empresa (lado fornecedor) — mesma regra do React: quando
  // a empresa também compra, as compras pagas não aparecem aqui (vivem no
  // histórico de pagamentos FEITOS, não recebidos).
  readonly paid = computed(() => {
    const user = this.auth.user();
    return (this.orders() || []).filter((o) => o.supplierCompanyId === user?.companyId && o.invoice?.payment);
  });

  constructor(
    private readonly auth: AuthService,
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.load();
  }

  private load(): void {
    this.ordersService.list().subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar os pagamentos.'),
    });
  }

  async confirmReceived(payment: { id: string }): Promise<void> {
    this.confirming.set(payment.id);
    this.error.set('');
    try {
      await firstValueFrom(this.ordersService.confirmPaymentReceived(payment.id));
      this.toast.set('Receção do valor confirmada. Obrigado!');
      setTimeout(() => this.toast.set(''), 3500);
      this.load();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.confirming.set(null);
    }
  }

  verComprovativo(url: string, evento: Event): void {
    evento.stopPropagation();
    window.open(url, '_blank');
  }

  verDetalhe(id: string): void {
    this.router.navigateByUrl(`${this.orderPath()}/${id}`);
  }
}
