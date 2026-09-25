// Porta de frontend/src/pages/comprador/ItemDetail.jsx. O botão "Falar com o
// fornecedor" (StartConversationButton) foi omitido nesta migração — depende
// do sistema de conversas/tempo real, ainda não portado (ver
// docs/migracao-angular/PLANO.md, "Tempo real"). Nada mais foi removido.
import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogService } from './catalog.service';
import { CartService } from '../cart/cart.service';
import { ProductDto } from '../../core/models/product.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney } from '../../shared/domain';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';
import { FieldComponent } from '../../shared/components/field.component';

const DOC_LABELS: Record<string, string> = {
  FICHA_TECNICA: 'Ficha Técnica', DATASHEET: 'Datasheet', MANUAL: 'Manual',
  CATALOGO: 'Catálogo PDF', CERTIFICADO: 'Certificado', DESENHO_TECNICO: 'Desenho Técnico',
};
const SPEC_FIELDS: Array<[keyof ProductDto, string]> = [
  ['material', 'Material'], ['weight', 'Peso'], ['height', 'Altura'], ['width', 'Largura'],
  ['length', 'Comprimento'], ['pressure', 'Pressão'], ['temperature', 'Temperatura'],
  ['power', 'Potência'], ['voltage', 'Tensão'], ['measurementUnit', 'Unidade de Medida'],
];
const IDENT_FIELDS: Array<[keyof ProductDto, string]> = [
  ['brand', 'Marca'], ['manufacturer', 'Fabricante'], ['model', 'Modelo'],
  ['sku', 'SKU'], ['manufacturerCode', 'Código do Fabricante'], ['countryOfOrigin', 'País de Origem'],
];

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [RouterLink, LoadingComponent, ErrorBannerComponent, ProductCoverComponent, FieldComponent],
  templateUrl: './item-detail.component.html',
})
export class ItemDetailComponent {
  readonly product = signal<ProductDto | null>(null);
  readonly error = signal('');
  readonly quantity = signal(1);
  readonly added = signal(false);
  readonly activeImg = signal<string | null>(null);

  readonly DOC_LABELS = DOC_LABELS;
  formatMoney = formatMoney;

  constructor(
    route: ActivatedRoute,
    private readonly catalogService: CatalogService,
    private readonly cart: CartService,
    private readonly router: Router,
  ) {
    const id = route.snapshot.paramMap.get('id')!;
    this.catalogService.get(id).subscribe({
      next: (p) => {
        this.product.set(p);
        this.activeImg.set(p.imageUrl || null);
      },
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar o produto.'),
    });
  }

  get specs(): Array<[keyof ProductDto, string]> {
    const p = this.product();
    return p ? SPEC_FIELDS.filter(([k]) => p[k]) : [];
  }

  get idents(): Array<[keyof ProductDto, string]> {
    const p = this.product();
    return p ? IDENT_FIELDS.filter(([k]) => p[k]) : [];
  }

  valor(campo: keyof ProductDto): string {
    const v = this.product()?.[campo];
    return v == null ? '' : String(v);
  }

  get hasPromo(): boolean {
    const p = this.product();
    return p?.promoPrice != null && Number(p.promoPrice) > 0;
  }

  handleAdd(): void {
    const p = this.product();
    if (!p) return;
    this.cart.addItem(p, this.quantity());
    this.added.set(true);
  }

  setQuantity(v: string): void {
    this.quantity.set(Math.max(1, Number(v)));
    this.added.set(false);
  }

  voltar(): void {
    this.router.navigateByUrl('/comprador/catalogo');
  }
}
