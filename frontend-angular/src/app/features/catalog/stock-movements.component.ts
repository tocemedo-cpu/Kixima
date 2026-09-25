// Porta de frontend/src/pages/fornecedor/StockMovements.jsx. Regista
// movimentos de inventário (que ajustam o stock do produto) e lista o
// histórico do tipo correspondente à rota (/entradas ou /saidas — ver
// data.isEntrada em app.routes.ts, mesmo padrão de SupplierQuotesComponent).
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from './catalog.service';
import { ProductDto } from '../../core/models/product.model';
import { StockMovementListItemDto } from '../../core/models/stock-movement.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDateTime } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { FieldComponent } from '../../shared/components/field.component';

interface MovementForm {
  productId: string;
  quantity: string;
  note: string;
}

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, FieldComponent],
  templateUrl: './stock-movements.component.html',
})
export class StockMovementsComponent {
  readonly isEntrada: boolean;
  readonly title: string;

  readonly products = signal<ProductDto[] | null>(null);
  readonly movements = signal<StockMovementListItemDto[] | null>(null);
  readonly total = signal(0);
  readonly form = signal<MovementForm>({ productId: '', quantity: '', note: '' });
  readonly error = signal('');
  readonly success = signal('');
  readonly saving = signal(false);

  readonly formatDateTime = formatDateTime;

  private readonly companyId: string;

  constructor(
    auth: AuthService,
    private readonly catalogService: CatalogService,
    route: ActivatedRoute,
  ) {
    this.isEntrada = route.snapshot.data['isEntrada'] === true;
    this.title = this.isEntrada ? 'Entradas' : 'Saídas';
    this.companyId = auth.user()!.companyId!;

    this.catalogService.list({ supplierId: this.companyId }).subscribe({
      next: (produtos) => this.products.set(produtos),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
    this.loadMovements();
  }

  private loadMovements(): void {
    this.catalogService.movements(this.isEntrada ? 'ENTRADA' : 'SAIDA', 100).subscribe({
      next: (r) => {
        this.movements.set(r.itens || []);
        this.total.set(r.total || 0);
      },
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  update<K extends keyof MovementForm>(campo: K, valor: string): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  productName(id: string): string {
    return this.products()?.find((p) => p.id === id)?.name || '—';
  }

  async handleSubmit(): Promise<void> {
    this.error.set('');
    this.success.set('');
    const f = this.form();
    if (!f.productId) {
      this.error.set('Escolha o produto.');
      return;
    }
    if (!f.quantity || Number(f.quantity) <= 0) {
      this.error.set('Indique uma quantidade válida.');
      return;
    }
    this.saving.set(true);
    try {
      await new Promise<void>((resolve, reject) => {
        this.catalogService
          .createMovement({
            productId: f.productId,
            type: this.isEntrada ? 'ENTRADA' : 'SAIDA',
            quantity: Number(f.quantity),
            note: f.note || undefined,
          })
          .subscribe({ next: () => resolve(), error: reject });
      });
      this.success.set(this.isEntrada ? 'Entrada registada. O stock foi atualizado.' : 'Saída registada. O stock foi atualizado.');
      this.form.set({ productId: '', quantity: '', note: '' });
      this.loadMovements();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.saving.set(false);
    }
  }
}
