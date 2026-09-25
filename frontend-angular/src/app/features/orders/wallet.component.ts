// Porta de frontend/src/pages/fornecedor/Wallet.jsx. Resumo financeiro do
// fornecedor: já recebido, a receber e em execução, a partir das ordens
// recebidas; e o extrato da Taxa KIXIMA (não bloqueia a página se falhar).
import { Component, computed, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from './orders.service';
import { PlatformFeesService } from '../admin/platform-fees.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { PlatformFeeStatementDto } from '../../core/models/platform-fee.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { BadgeComponent } from '../../shared/components/badge.component';

const RECEIVED = new Set(['PAGA', 'EM_EXECUCAO', 'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA']);
const PENDING = new Set(['ACEITE_FORNECEDOR', 'AGUARDANDO_PAGAMENTO']);

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, StatCardComponent, BadgeComponent],
  templateUrl: './wallet.component.html',
})
export class WalletComponent {
  readonly orders = signal<PurchaseOrderDto[] | null>(null);
  readonly feeStatement = signal<PlatformFeeStatementDto | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly formatMoney = formatMoney;

  private readonly companyId: string;

  readonly received = computed(() => this.somar(RECEIVED));
  readonly pending = computed(() => this.somar(PENDING));
  readonly recentPaid = computed(() =>
    (this.orders() || [])
      .filter((o) => o.invoice?.payment)
      .slice()
      .sort((a, b) => this.dataPagamento(b) - this.dataPagamento(a))
      .slice(0, 8),
  );

  constructor(
    private readonly auth: AuthService,
    private readonly ordersService: OrdersService,
    private readonly platformFeesService: PlatformFeesService,
  ) {
    this.companyId = auth.user()!.companyId!;
    this.ordersService.list().subscribe({
      next: (orders) => this.orders.set(orders),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
    this.platformFeesService.forCompany(this.companyId).subscribe({ next: (fees) => this.feeStatement.set(fees), error: () => {} });
  }

  private somar(status: Set<string>): number {
    return (this.orders() || []).filter((o) => status.has(o.status)).reduce((s, o) => s + Number(o.totalAmount), 0);
  }

  private dataPagamento(o: PurchaseOrderDto): number {
    return new Date(o.invoice?.payment?.processedAt || o.createdAt).getTime();
  }

  extratoTaxas(): void {
    window.open(`/documento/taxas/${this.companyId}`, '_blank');
  }
}
