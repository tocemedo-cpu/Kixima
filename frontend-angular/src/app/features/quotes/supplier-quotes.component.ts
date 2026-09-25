// Porta de frontend/src/pages/fornecedor/SupplierQuotes.jsx. Route-aware tal
// como o original: /fornecedor/pedidos/solicitacoes mostra ABERTA com
// formulário de resposta; /fornecedor/pedidos/cotacoes mostra as respondidas/
// encerradas (só leitura).
import { Component, computed, signal } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuotesService } from './quotes.service';
import { QuoteRequestDto, QuoteStatus } from '../../core/models/quote.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';

const STATUS_TONE: Record<QuoteStatus, { label: string; tone: 'pending' | 'info' | 'neutral' }> = {
  ABERTA: { label: 'Aberta', tone: 'pending' },
  RESPONDIDA: { label: 'Respondida', tone: 'info' },
  FECHADA: { label: 'Encerrada', tone: 'neutral' },
};

@Component({
  selector: 'app-supplier-quotes',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, BadgeComponent],
  templateUrl: './supplier-quotes.component.html',
})
export class SupplierQuotesComponent {
  readonly quotes = signal<QuoteRequestDto[] | null>(null);
  readonly error = signal('');
  readonly success = signal('');

  // Definido por dados de rota (ver app.routes.ts): { inbox: true|false }.
  readonly isInbox = signal(false);

  readonly list = computed(() => {
    const todas = this.quotes();
    if (!todas) return null;
    return todas.filter((q) => (this.isInbox() ? q.status === 'ABERTA' : q.status !== 'ABERTA'));
  });

  formatDate = formatDate;
  formatMoney = formatMoney;

  constructor(
    private readonly quotesService: QuotesService,
    route: ActivatedRoute,
  ) {
    this.isInbox.set(route.snapshot.data['inbox'] === true);
    this.load();
  }

  load(): void {
    this.quotesService.list().subscribe({
      next: (list) => this.quotes.set(list),
      error: (e) => this.error.set(this.mensagem(e)),
    });
  }

  statusLabel(status: QuoteStatus): string {
    return STATUS_TONE[status]?.label ?? status;
  }

  statusTone(status: QuoteStatus): 'pending' | 'info' | 'neutral' {
    return STATUS_TONE[status]?.tone ?? 'neutral';
  }

  async responder(quote: QuoteRequestDto, price: string, leadDays: string, note: string): Promise<void> {
    this.error.set('');
    const preco = Number(price);
    if (!price || preco <= 0) {
      this.error.set('Indique um preço válido.');
      return;
    }
    try {
      await firstValueFrom(
        this.quotesService.respond(quote.id, {
          price: preco,
          leadDays: leadDays ? Number(leadDays) : undefined,
          note: note || undefined,
        }),
      );
      this.success.set('Cotação enviada ao comprador.');
      this.load();
    } catch (err) {
      this.error.set(this.mensagem(err));
    }
  }

  private mensagem(err: unknown): string {
    return err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado.';
  }
}
