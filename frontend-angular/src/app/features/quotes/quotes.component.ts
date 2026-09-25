// Porta de frontend/src/pages/comprador/Quotes.jsx. Mesma regra de negócio:
// o fornecedor do pedido é DERIVADO dos produtos escolhidos (todos têm de
// pertencer ao mesmo fornecedor) — não há campo de fornecedor no formulário,
// tal como no original.
import { Component, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QuotesService } from './quotes.service';
import { CatalogService } from '../catalog/catalog.service';
import { ProductDto } from '../../core/models/product.model';
import { QuoteRequestDto, QuoteStatus } from '../../core/models/quote.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';

interface Linha {
  productId: string;
  quantity: number;
}

const STATUS_TONE: Record<QuoteStatus, { label: string; tone: 'pending' | 'success' | 'neutral' }> = {
  ABERTA: { label: 'Aguardando resposta', tone: 'pending' },
  RESPONDIDA: { label: 'Cotada', tone: 'success' },
  FECHADA: { label: 'Encerrada', tone: 'neutral' },
};

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, BadgeComponent],
  templateUrl: './quotes.component.html',
})
export class QuotesComponent {
  readonly catalog = signal<ProductDto[] | null>(null);
  readonly quotes = signal<QuoteRequestDto[] | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly showForm = signal(false);
  readonly lines = signal<Linha[]>([{ productId: '', quantity: 1 }]);
  readonly note = signal('');
  readonly saving = signal(false);

  readonly carregado = computed(() => this.catalog() !== null && this.quotes() !== null);

  readonly byId = computed(() => new Map((this.catalog() || []).map((p) => [p.id, p])));

  readonly chosen = computed(() =>
    this.lines()
      .filter((l) => l.productId)
      .map((l) => this.byId().get(l.productId))
      .filter((p): p is ProductDto => Boolean(p)),
  );

  readonly supplierIds = computed(() => [...new Set(this.chosen().map((p) => p.supplier?.id).filter(Boolean))]);
  readonly sameSupplier = computed(() => this.supplierIds().length <= 1);

  constructor(
    private readonly quotesService: QuotesService,
    private readonly catalogService: CatalogService,
  ) {
    this.catalogService.list().subscribe({
      next: (list) => this.catalog.set(list),
      error: (e) => this.error.set(this.mensagem(e)),
    });
    this.loadQuotes();
  }

  loadQuotes(): void {
    this.quotesService.list().subscribe({
      next: (list) => this.quotes.set(list),
      error: (e) => this.error.set(this.mensagem(e)),
    });
  }

  statusLabel(status: QuoteStatus): string {
    return STATUS_TONE[status]?.label ?? status;
  }

  statusTone(status: QuoteStatus): 'pending' | 'success' | 'neutral' {
    return STATUS_TONE[status]?.tone ?? 'neutral';
  }

  formatDate = formatDate;
  formatMoney = formatMoney;

  toggleForm(): void {
    const abrir = !this.showForm();
    this.showForm.set(abrir);
    if (!abrir) this.resetForm();
  }

  abrirFormulario(): void {
    this.showForm.set(true);
  }

  setLine(index: number, patch: Partial<Linha>): void {
    this.lines.update((ls) => ls.map((l, idx) => (idx === index ? { ...l, ...patch } : l)));
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, { productId: '', quantity: 1 }]);
  }

  removeLine(index: number): void {
    this.lines.update((ls) => ls.filter((_, idx) => idx !== index));
  }

  resetForm(): void {
    this.lines.set([{ productId: '', quantity: 1 }]);
    this.note.set('');
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.success.set('');
    const items = this.lines()
      .filter((l) => l.productId)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) || 1 }));
    if (items.length === 0) {
      this.error.set('Adicione pelo menos um produto.');
      return;
    }
    if (!this.sameSupplier()) {
      this.error.set('Todos os produtos do pedido devem ser do mesmo fornecedor.');
      return;
    }
    const supplierCompanyId = this.supplierIds()[0]!;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.quotesService.create({ supplierCompanyId, items, note: this.note() || undefined }),
      );
      this.success.set('Pedido de cotação enviado.');
      this.resetForm();
      this.showForm.set(false);
      this.loadQuotes();
    } catch (err) {
      this.error.set(this.mensagem(err));
    } finally {
      this.saving.set(false);
    }
  }

  async close(id: string): Promise<void> {
    try {
      await firstValueFrom(this.quotesService.close(id));
      this.loadQuotes();
    } catch (err) {
      this.error.set(this.mensagem(err));
    }
  }

  private mensagem(err: unknown): string {
    return err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.';
  }
}
