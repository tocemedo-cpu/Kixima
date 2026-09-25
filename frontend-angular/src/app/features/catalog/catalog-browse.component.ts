// Porta de frontend/src/pages/comprador/Catalog.jsx. Mesma paginação no
// SERVIDOR (via /api/marketplace/search + /api/marketplace/facets), mesmos
// filtros reflectidos no endereço (para poderem ser partilhados), mesma
// comparação de produtos.
import { Component, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarketplaceService } from './marketplace.service';
import { CartService } from '../cart/cart.service';
import { ProductDto, MarketplaceFacets, MarketplaceSearchResult } from '../../core/models/product.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { IconComponent } from '../../shared/components/icon.component';
import { StarsComponent } from '../../shared/components/stars.component';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';

const PAGE_SIZES = [16, 24, 48];
const SORT_MAP: Record<string, string> = {
  rel: 'relevantes', price_asc: 'preco_asc', price_desc: 'preco_desc', rating: 'avaliacao', recent: 'recentes',
};

function availabilityOf(p: ProductDto): 'STOCK' | 'ENCOMENDA' {
  const a = (p.availability || '').toLowerCase();
  if (a.includes('encomenda') || a.includes('sob')) return 'ENCOMENDA';
  return 'STOCK';
}

@Component({
  selector: 'app-catalog-browse',
  standalone: true,
  imports: [RouterLink, CrumbsComponent, BuyerPageHeadComponent, IconComponent, StarsComponent, ProductCoverComponent, ErrorBannerComponent],
  templateUrl: './catalog-browse.component.html',
})
export class CatalogBrowseComponent {
  readonly PAGE_SIZES = PAGE_SIZES;
  readonly Math = Math;
  formatMoney = formatMoney;
  availabilityOf = availabilityOf;

  readonly error = signal('');
  // Inicializados a partir do endereço no construtor (não em inicializadores
  // de campo — evita depender da ordem entre estes e as propriedades de
  // parâmetro injectadas, que o TypeScript não garante de forma óbvia).
  readonly search = signal('');
  readonly category = signal('');
  readonly priceMin = signal('');
  readonly priceMax = signal('');
  readonly onlyVerified = signal(false);
  readonly minRating = signal(0);
  readonly tab = signal('TODOS');
  readonly sort = signal('rel');
  readonly view = signal<'grid' | 'list'>('grid');
  readonly page = signal(1);
  readonly pageSize = signal(16);

  readonly data = signal<MarketplaceSearchResult | null>(null);
  readonly facets = signal<MarketplaceFacets>({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } });

  readonly added = signal<string | null>(null);
  readonly compare = signal<ProductDto[]>([]);
  readonly showCompare = signal(false);

  readonly filterParams = computed(() => {
    const p: Record<string, string> = { kind: 'PRODUTO' };
    if (this.search().trim()) p['q'] = this.search().trim();
    if (this.category()) p['category'] = this.category();
    if (this.priceMin()) p['minPrice'] = this.priceMin();
    if (this.priceMax()) p['maxPrice'] = this.priceMax();
    if (this.onlyVerified()) p['verified'] = 'true';
    if (this.minRating()) p['minRating'] = String(this.minRating());
    if (this.tab() === 'PROMO') p['promo'] = 'true';
    return p;
  });

  private ultimoFiltroChave = '';

  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly cart: CartService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    const qp = this.route.snapshot.queryParamMap;
    this.search.set(qp.get('q') || '');
    this.category.set(qp.get('category') || '');
    this.priceMin.set(qp.get('minPrice') || '');
    this.priceMax.set(qp.get('maxPrice') || '');
    this.onlyVerified.set(qp.get('verified') === 'true');
    this.minRating.set(Number(qp.get('minRating')) || 0);
    this.tab.set(qp.get('tab') || 'TODOS');
    this.sort.set(qp.get('sort') || 'rel');
    this.page.set(Number(qp.get('page')) || 1);
    this.pageSize.set(Number(qp.get('limit')) || 16);

    // Ao mudar filtro/ordenação/tamanho, volta à 1ª página — depois carrega.
    effect(() => {
      const chave = JSON.stringify(this.filterParams()) + '::' + this.sort() + '::' + this.pageSize();
      const pagina = chave === this.ultimoFiltroChave ? this.page() : 1;
      this.ultimoFiltroChave = chave;
      if (pagina !== this.page()) {
        this.page.set(pagina);
        return;
      }
      this.carregarItens();
      this.sincronizarEndereco();
    });
    effect(() => {
      this.filterParams();
      this.carregarFacets();
    });
  }

  private carregarItens(): void {
    this.error.set('');
    this.marketplace
      .search({ ...this.filterParams(), sort: SORT_MAP[this.sort()], page: this.page(), limit: this.pageSize() })
      .subscribe({
        next: (d) => this.data.set(d),
        error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Não foi possível carregar o catálogo.'),
      });
  }

  private carregarFacets(): void {
    this.marketplace.facets(this.filterParams()).subscribe({ next: (f) => this.facets.set(f), error: () => {} });
  }

  private sincronizarEndereco(): void {
    const q: Record<string, string> = {};
    if (this.search().trim()) q['q'] = this.search().trim();
    if (this.category()) q['category'] = this.category();
    if (this.priceMin()) q['minPrice'] = this.priceMin();
    if (this.priceMax()) q['maxPrice'] = this.priceMax();
    if (this.onlyVerified()) q['verified'] = 'true';
    if (this.minRating()) q['minRating'] = String(this.minRating());
    if (this.tab() !== 'TODOS') q['tab'] = this.tab();
    if (this.sort() !== 'rel') q['sort'] = this.sort();
    if (this.page() > 1) q['page'] = String(this.page());
    if (this.pageSize() !== 16) q['limit'] = String(this.pageSize());
    this.router.navigate([], { relativeTo: this.route, queryParams: q, replaceUrl: true });
  }

  priceOf(p: ProductDto): number {
    return Number(p.promoPrice ?? p.unitPrice) || 0;
  }
  isVerified(p: ProductDto): boolean {
    return !!p.supplier?.verified || p.supplier?.status === 'APROVADA';
  }
  isDestaque(p: ProductDto): boolean {
    return Boolean(p.supplier?.destaque);
  }

  handleAdd(p: ProductDto): void {
    this.cart.addItem(p, 1);
    this.added.set(p.id);
    setTimeout(() => this.added.set(null), 1200);
  }

  toggleCompare(p: ProductDto): void {
    this.compare.update((c) => (c.some((x) => x.id === p.id) ? c.filter((x) => x.id !== p.id) : [...c, p]));
  }
  inCompare(id: string): boolean {
    return this.compare().some((x) => x.id === id);
  }

  clearFilters(): void {
    this.search.set('');
    this.category.set('');
    this.priceMin.set('');
    this.priceMax.set('');
    this.onlyVerified.set(false);
    this.minRating.set(0);
    this.tab.set('TODOS');
  }

  get total(): number {
    return this.data()?.total ?? 0;
  }
  get pages(): number {
    return this.data()?.pages ?? 1;
  }
  get current(): number {
    return this.data()?.page ?? 1;
  }
  get start(): number {
    return (this.current - 1) * this.pageSize();
  }
  get items(): ProductDto[] {
    return this.data()?.items || [];
  }
  get totalAll(): number {
    return this.facets().categories.reduce((s, c) => s + c.count, 0);
  }
  get bounds(): { min: number; max: number } {
    return this.facets().priceBounds || { min: 0, max: 0 };
  }
}
