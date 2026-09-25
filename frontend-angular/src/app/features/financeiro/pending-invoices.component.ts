// Porta de frontend/src/pages/financeiro/PendingInvoices.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroInvoiceRow, FinanceiroInvoicesResponse } from '../../core/models/financeiro.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney, formatDate } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { SupplierCellComponent } from '../../shared/buyer-ui/supplier-cell.component';
import { IconComponent } from '../../shared/components/icon.component';
import { FieldComponent } from '../../shared/components/field.component';

@Component({
  selector: 'app-pending-invoices',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent,
    EmptyRowComponent, SupplierCellComponent, IconComponent, FieldComponent,
  ],
  templateUrl: './pending-invoices.component.html',
})
export class PendingInvoicesComponent {
  readonly data = signal<FinanceiroInvoicesResponse | null>(null);
  readonly q = signal('');
  readonly error = signal('');
  readonly toast = signal('');
  readonly paying = signal<string | null>(null);
  readonly payModal = signal<FinanceiroInvoiceRow | null>(null);
  readonly proof = signal<File | null>(null);

  formatMoney = formatMoney;
  formatDate = formatDate;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'invoice', tone: 'pending', label: 'Total Pendentes', value: k?.['pendentes'] ?? '—', sub: k ? formatMoney(k['valorPendente']) : '' },
      { icon: 'history', tone: 'info', label: 'A vencer em 7 dias', value: k?.['aVencer7'] ?? '—', sub: 'Prioritárias' },
      { icon: 'approvals', tone: 'danger', label: 'Vencidas', value: k?.['vencidas'] ?? '—', sub: 'Requerem atenção' },
      { icon: 'reception', tone: 'success', label: 'Pagas (mês)', value: k?.['aprovadasMes'] ?? '—', sub: 'Processadas' },
    ];
  });

  readonly items = computed(() => {
    const termo = this.q().toLowerCase();
    return (this.data()?.items || []).filter(
      (i) => !termo || i.reference.toLowerCase().includes(termo) || (i.supplier || '').toLowerCase().includes(termo),
    );
  });

  constructor(
    private readonly financeiroService: FinanceiroService,
    private readonly router: Router,
  ) {
    this.load();
  }

  private load(): void {
    this.financeiroService.invoices().subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar as faturas.'),
    });
  }

  vencida(i: FinanceiroInvoiceRow): boolean {
    return new Date(i.dueAt).getTime() < Date.now();
  }

  verFatura(poId: string): void {
    this.router.navigateByUrl(`/documento/fatura/${poId}`);
  }

  abrirModal(inv: FinanceiroInvoiceRow): void {
    this.payModal.set(inv);
    this.proof.set(null);
  }

  fecharModal(): void {
    this.payModal.set(null);
    this.proof.set(null);
  }

  tamanhoKb(ficheiro: File): number {
    return Math.round(ficheiro.size / 1024);
  }

  onProofChange(evento: Event): void {
    const ficheiro = (evento.target as HTMLInputElement).files?.[0] || null;
    this.proof.set(ficheiro);
  }

  async confirmarPagamento(): Promise<void> {
    const inv = this.payModal();
    const ficheiro = this.proof();
    if (!inv || !ficheiro) return;
    this.paying.set(inv.id);
    this.error.set('');
    try {
      await firstValueFrom(this.financeiroService.pay(inv.id, ficheiro));
      this.toast.set(`Fatura ${inv.reference} paga — comprovativo anexado.`);
      setTimeout(() => this.toast.set(''), 3500);
      this.fecharModal();
      this.load();
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.paying.set(null);
    }
  }
}
