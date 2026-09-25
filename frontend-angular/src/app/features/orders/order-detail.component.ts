// Porta de frontend/src/pages/shared/OrderDetail.jsx. Partilhado por 4
// personas (COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO) tal como no
// React — as acções disponíveis são as MESMAS condições client-side do
// original (canApprove, canAcceptRefuse, …), com o RBAC real sempre
// aplicado pelo servidor, nunca só aqui. O botão "Falar com…" foi omitido
// (chat/tempo real ainda não portado — ver PLANO.md).
import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from './orders.service';
import { AuditLogEntry, PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { PersonaRole } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';
import { PO_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { FieldComponent } from '../../shared/components/field.component';
import { ButtonComponent } from '../../shared/components/button.component';

const BACK_BY_ROLE: Record<PersonaRole, string> = {
  COMPRADOR: '/comprador/ordens',
  COMPANY_ADMIN: '/empresa/aprovacoes',
  FORNECEDOR: '/fornecedor/ordens',
  FINANCEIRO: '/financeiro',
  ADMIN_SISTEMA: '/sistema',
};

const TIMELINE_LABELS: Record<string, { label: string; icon: string }> = {
  PO_CRIADA: { label: 'PO criada', icon: '📝' },
  PO_APROVADA: { label: 'Aprovada pelo Company Admin', icon: '✅' },
  PO_REJEITADA: { label: 'Rejeitada pelo Company Admin', icon: '⛔' },
  PO_APROVADA_ERP: { label: 'Aprovada pelo ERP', icon: '✅' },
  PO_REJEITADA_ERP: { label: 'Rejeitada pelo ERP', icon: '⛔' },
  PAGAMENTO_CONFIRMADO_ERP: { label: 'Pagamento confirmado pelo ERP', icon: '💳' },
  PO_ACEITE: { label: 'Aceite pelo fornecedor', icon: '🤝' },
  PO_RECUSADA_FORNECEDOR: { label: 'Recusada pelo fornecedor', icon: '⛔' },
  PAGAMENTO_EXECUTADO: { label: 'Pagamento efetuado', icon: '💳' },
  PO_DESPACHADA: { label: 'Entrega despachada', icon: '🚚' },
  PO_ENTREGUE: { label: 'Marcada como entregue', icon: '📦' },
  RECECAO_MERCADORIA: { label: 'Receção confirmada', icon: '📥' },
  DIVERGENCIA_RESOLVIDA: { label: 'Divergência resolvida', icon: '🛠️' },
  PO_CONCLUIDA: { label: 'Ordem concluída', icon: '🏁' },
};

function timelineDetail(detail: Record<string, unknown> | null | undefined): string | null {
  if (!detail) return null;
  if (detail['motivo']) return `Motivo: ${detail['motivo']}`;
  if (detail['desfecho']) return `Desfecho: ${detail['desfecho'] === 'REPOSICAO' ? 'reposição solicitada' : 'entrega aceite'}`;
  if (typeof detail['conforme'] === 'boolean') return detail['conforme'] ? 'Sem divergências' : 'Com divergência';
  if (detail['valor']) return `Valor: ${formatMoney(detail['valor'] as string, (detail['moeda'] as string) || 'AOA')}`;
  return null;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, BadgeComponent, FieldComponent, ButtonComponent],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent {
  readonly po = signal<PurchaseOrderDto | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly busy = signal(false);
  readonly history = signal<AuditLogEntry[] | null>(null);

  readonly rejectReason = signal('');
  readonly showReject = signal(false);
  readonly refuseReason = signal('');
  readonly showRefuse = signal(false);
  readonly receptionNotes = signal('');
  readonly showDivergence = signal(false);
  readonly resolveOutcome = signal<'ACEITE' | 'REPOSICAO' | null>(null);
  readonly resolveNotes = signal('');
  readonly showCreditNote = signal(false);
  readonly cnMotivo = signal('');
  readonly cnAmount = signal('');
  readonly showAnular = signal(false);
  readonly anularMotivo = signal('');
  readonly anularBusy = signal(false);

  readonly PO_STATUS = PO_STATUS;
  readonly TIMELINE_LABELS = TIMELINE_LABELS;
  formatDate = formatDate;
  formatMoney = formatMoney;
  timelineDetail = timelineDetail;

  private readonly id: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {
    this.id = route.snapshot.paramMap.get('id')!;
    this.load();
  }

  get user() {
    return this.auth.user()!;
  }

  get backUrl(): string {
    return BACK_BY_ROLE[this.user.role];
  }

  get statusInfo() {
    const po = this.po();
    return po ? PO_STATUS[po.status] : undefined;
  }

  get canApprove(): boolean {
    const po = this.po();
    return !!po && this.user.role === 'COMPANY_ADMIN' && po.status === 'AGUARDANDO_APROVACAO' && !po.isCallOff && !po.erpManaged;
  }
  get canAcceptRefuse(): boolean {
    const po = this.po();
    return !!po && this.user.role === 'FORNECEDOR' && po.status === 'APROVADA';
  }
  get canDispatch(): boolean {
    const po = this.po();
    if (!po || this.user.role !== 'FORNECEDOR') return false;
    return (po.isCallOff && po.status === 'EM_EXECUCAO' && !po.dispatchedAt) || (!po.isCallOff && po.status === 'PAGA');
  }
  get canMarkDelivered(): boolean {
    const po = this.po();
    return !!po && this.user.role === 'FORNECEDOR' && po.status === 'EM_EXECUCAO' && !!po.dispatchedAt;
  }
  get canReceive(): boolean {
    const po = this.po();
    return !!po && this.user.role === 'COMPRADOR' && ['ENTREGUE', 'EM_EXECUCAO'].includes(po.status);
  }
  get canResolveDivergence(): boolean {
    const po = this.po();
    return !!po && ['COMPRADOR', 'COMPANY_ADMIN'].includes(this.user.role) && po.status === 'RECEBIDA_COM_DIVERGENCIA';
  }
  get canCreditNote(): boolean {
    const po = this.po();
    return !!po && ['FORNECEDOR', 'ADMIN_SISTEMA'].includes(this.user.role) && !!po.invoice;
  }
  get temAcaoDisponivel(): boolean {
    return this.canApprove || this.canAcceptRefuse || this.canDispatch || this.canMarkDelivered || this.canReceive || this.canResolveDivergence;
  }
  get totalCreditado(): number {
    return (this.po()?.invoice?.creditNotes || []).reduce((s, n) => s + Number(n.amount), 0);
  }
  get porCreditar(): number {
    const inv = this.po()?.invoice;
    return inv ? Number(inv.amount) - this.totalCreditado : 0;
  }
  get cnAmountValida(): boolean {
    const v = Number(this.cnAmount());
    return v > 0 && v <= this.porCreditar;
  }

  private load(): void {
    this.ordersService.get(this.id).subscribe({
      next: (po) => this.po.set(po),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar a ordem.'),
    });
    // Linha do tempo — não bloqueia o resto do ecrã se falhar.
    this.ordersService.history(this.id).subscribe({
      next: (h) => this.history.set(h),
      error: () => this.history.set([]),
    });
  }

  private async runAction(action: () => Promise<unknown>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await action();
      this.success.set('Ação registada com sucesso.');
      this.load();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.busy.set(false);
    }
  }

  aprovar(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.approve(this.id)));
  }
  confirmarRejeicao(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.reject(this.id, { reason: this.rejectReason() })));
  }
  aceitar(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.accept(this.id)));
  }
  confirmarRecusa(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.refuse(this.id, { reason: this.refuseReason().trim() })));
  }
  despachar(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.dispatch(this.id)));
  }
  marcarEntregue(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.markDelivered(this.id)));
  }
  confirmarRececaoConforme(): void {
    void this.runAction(() => firstValueFrom(this.ordersService.confirmReception(this.id, { conforme: true })));
  }
  reportarDivergencia(): void {
    void this.runAction(() =>
      firstValueFrom(this.ordersService.confirmReception(this.id, { conforme: false, notes: this.receptionNotes() })),
    );
  }
  confirmarResolucaoDivergencia(): void {
    const outcome = this.resolveOutcome();
    if (!outcome) return;
    void this.runAction(() =>
      firstValueFrom(this.ordersService.resolveDivergence(this.id, { outcome, notes: this.resolveNotes().trim() || undefined })),
    );
  }

  async submitCreditNote(): Promise<void> {
    const po = this.po();
    if (!po?.invoice) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await firstValueFrom(this.ordersService.emitirNotaCredito(po.invoice.id, this.cnMotivo().trim(), Number(this.cnAmount())));
      this.success.set('Ação registada com sucesso.');
      this.showCreditNote.set(false);
      this.cnMotivo.set('');
      this.cnAmount.set('');
      this.load();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.busy.set(false);
    }
  }

  async submitAnular(): Promise<void> {
    const po = this.po();
    if (!po?.invoice) return;
    this.anularBusy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await firstValueFrom(this.ordersService.anularFatura(po.invoice.id, this.anularMotivo().trim() || undefined));
      this.success.set('Ação registada com sucesso.');
      this.showAnular.set(false);
      this.anularMotivo.set('');
      this.load();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.anularBusy.set(false);
    }
  }

  navigateBack(): void {
    this.router.navigateByUrl(this.backUrl);
  }

  verPdfPo(): void {
    this.router.navigateByUrl(`/documento/po/${this.id}`);
  }
  baixarPdfPo(): void {
    this.router.navigateByUrl(`/documento/po/${this.id}?baixar=1`);
  }
  verPdfFatura(): void {
    this.router.navigateByUrl(`/documento/fatura/${this.id}`);
  }
  baixarPdfFatura(): void {
    this.router.navigateByUrl(`/documento/fatura/${this.id}?baixar=1`);
  }
}
