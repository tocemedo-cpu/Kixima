// Porta de SupplierFinanceCenter em frontend/src/pages/financeiro/Home.jsx —
// Centro Financeiro de uma empresa FORNECEDORA: recebimentos + Taxa KIXIMA +
// compras próprias a pagar.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from '../orders/orders.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { PlatformFeesService } from '../admin/platform-fees.service';
import { PurchaseOrderDto, PaymentDto } from '../../core/models/purchase-order.model';
import { PendingInvoiceRow } from '../../core/models/financeiro.model';
import { PlatformFeeStatementDto } from '../../core/models/platform-fee.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney, formatDate } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-supplier-finance-center',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, IconComponent],
  templateUrl: './supplier-finance-center.component.html',
})
export class SupplierFinanceCenterComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly fees = signal<PlatformFeeStatementDto | null>(null);
  readonly pendingInvoices = signal<PendingInvoiceRow[]>([]);
  readonly error = signal('');

  readonly formatMoney = formatMoney;
  readonly formatDate = formatDate;

  private readonly companyId: string;

  readonly sales = computed(() => (this.orders() || []).filter((o) => o.supplierCompanyId === this.companyId));
  readonly payments = computed<PaymentDto[]>(() =>
    this.sales()
      .filter((o) => o.invoice?.payment)
      .map((o) => o.invoice!.payment!),
  );
  readonly confirmados = computed(() => this.payments().filter((p) => p.receivedAt));
  readonly porConfirmar = computed(() => this.payments().filter((p) => !p.receivedAt));
  readonly aPagar = computed(() => this.pendingInvoices().reduce((s, i) => s + Number(i.amount), 0));

  readonly kpis = computed<KpiCard[]>(() => [
    {
      icon: 'wallet', tone: 'success', label: 'Recebido (confirmado)',
      value: formatMoney(this.somar(this.confirmados())), sub: `${this.confirmados().length} pagamentos`, to: '/financeiro/recebidos',
    },
    {
      icon: 'payment', tone: 'pending', label: 'Por confirmar receção',
      value: formatMoney(this.somar(this.porConfirmar())), sub: `${this.porConfirmar().length} pagamentos`, to: '/financeiro/recebidos',
    },
    {
      icon: 'invoice', tone: 'danger', label: 'Compras a pagar',
      value: formatMoney(this.aPagar()), sub: `${this.pendingInvoices().length} faturas pendentes`, to: '/financeiro/faturas',
    },
    {
      icon: 'orders', tone: 'info', label: 'Taxa KIXIMA por liquidar',
      value: this.fees() ? formatMoney(this.fees()!.kpis.pendingAOA) : '—',
      sub: this.fees() ? `${this.fees()!.kpis.pendentes} taxas pendentes` : '',
    },
  ]);

  constructor(
    auth: AuthService,
    private readonly ordersService: OrdersService,
    private readonly financeiroService: FinanceiroService,
    private readonly platformFeesService: PlatformFeesService,
    private readonly router: Router,
  ) {
    this.companyId = auth.user()!.companyId!;
    this.ordersService.list().subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
    this.platformFeesService.forCompany(this.companyId).subscribe({ next: (fees) => this.fees.set(fees), error: () => {} });
    this.financeiroService.pendingInvoicesToPay().subscribe({ next: (list) => this.pendingInvoices.set(list), error: () => {} });
  }

  private somar(list: PaymentDto[]): number {
    return list.reduce((s, p) => s + Number(p.amount), 0);
  }

  ir(caminho: string): void {
    this.router.navigateByUrl(caminho);
  }

  extratoTaxas(): void {
    window.open(`/documento/taxas/${this.companyId}`, '_blank');
  }
}
