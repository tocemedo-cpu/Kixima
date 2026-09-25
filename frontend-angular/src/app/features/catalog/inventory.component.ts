// Porta de frontend/src/pages/fornecedor/Inventory.jsx. Lista os produtos da
// própria empresa com o stock real e permite editar quantidade, estoque
// mínimo, armazém e disponibilidade em linha.
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from './catalog.service';
import { ProductDto, PRODUCT_AVAILABILITY } from '../../core/models/product.model';
import { UpdateStockBody } from '../../core/models/stock-movement.model';
import { ApiError } from '../../core/models/api-error.model';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { BadgeComponent } from '../../shared/components/badge.component';

interface StockDraft {
  stockQuantity: string;
  minStock: string;
  warehouse: string;
  availability: string;
}

function isLow(p: ProductDto): boolean {
  return p.stockQuantity != null && p.minStock != null && p.stockQuantity <= p.minStock;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, StatCardComponent, BadgeComponent],
  templateUrl: './inventory.component.html',
})
export class InventoryComponent {
  readonly PRODUCT_AVAILABILITY = PRODUCT_AVAILABILITY;
  readonly isLow = isLow;

  readonly products = signal<ProductDto[] | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly editing = signal<string | null>(null);
  readonly draft = signal<StockDraft>({ stockQuantity: '', minStock: '', warehouse: '', availability: 'Em stock' });
  readonly saving = signal(false);

  readonly lowCount = computed(() => (this.products() || []).filter(isLow).length);
  readonly totalUnits = computed(() => (this.products() || []).reduce((s, p) => s + (p.stockQuantity || 0), 0));

  constructor(
    private readonly auth: AuthService,
    private readonly catalogService: CatalogService,
  ) {
    this.load();
  }

  private load(): void {
    const companyId = this.auth.user()!.companyId!;
    this.catalogService.list({ supplierId: companyId }).subscribe({
      next: (produtos) => this.products.set(produtos),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  startEdit(p: ProductDto): void {
    this.success.set('');
    this.editing.set(p.id);
    this.draft.set({
      stockQuantity: p.stockQuantity != null ? String(p.stockQuantity) : '',
      minStock: p.minStock != null ? String(p.minStock) : '',
      warehouse: p.warehouse || '',
      availability: p.availability || 'Em stock',
    });
  }

  cancelarEdicao(): void {
    this.editing.set(null);
  }

  updateDraft<K extends keyof StockDraft>(campo: K, valor: string): void {
    this.draft.update((d) => ({ ...d, [campo]: valor }));
  }

  async save(id: string): Promise<void> {
    this.saving.set(true);
    this.error.set('');
    try {
      const d = this.draft();
      const body: UpdateStockBody = {
        stockQuantity: d.stockQuantity === '' ? undefined : Number(d.stockQuantity),
        minStock: d.minStock === '' ? undefined : Number(d.minStock),
        warehouse: d.warehouse || undefined,
        availability: d.availability || undefined,
      };
      await new Promise<void>((resolve, reject) => {
        this.catalogService.updateStock(id, body).subscribe({ next: () => resolve(), error: reject });
      });
      this.success.set('Inventário atualizado.');
      this.editing.set(null);
      this.load();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.saving.set(false);
    }
  }
}
