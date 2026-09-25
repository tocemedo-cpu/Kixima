// Porta de frontend/src/pages/comprador/Services.jsx. Marketplace de
// Serviços (kind=SERVICO fixo) — pesquisa em tempo real (debounce),
// filtros do backend, paginação, favoritos, avaliações e "Solicitar Cotação".
import { Component, computed, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { MarketplaceService } from './marketplace.service';
import { QuotesService } from '../quotes/quotes.service';
import { ProductDto, MarketplaceSearchResult, MarketplaceFacets, MarketplaceSearchParams } from '../../core/models/product.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatNumber, joinNonEmpty } from '../../shared/domain';
import { IconComponent } from '../../shared/components/icon.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';
import { StarsComponent } from '../../shared/components/stars.component';

const SORTS: [string, string][] = [
  ['relevantes', 'Mais Relevantes'],
  ['recentes', 'Mais recentes'],
  ['avaliacao', 'Melhor avaliação'],
  ['preco_asc', 'Menor preço'],
  ['preco_desc', 'Maior preço'],
  ['solicitados', 'Mais solicitados'],
  ['vendidos', 'Mais vendidos'],
];
const CERTS = ['ISO 9001', 'ISO 45001', 'ISO 14001', 'API Q1 / Q2'];
const COUNTRIES = ['Angola', 'Brasil', 'África do Sul', 'Emirados Árabes'];

// Cache simples em memória por query-string, tal como o React.
// Exportado só para o spec poder limpá-la entre testes (é um singleton a
// nível de módulo, tal como no React — sem isso, testes sucessivos com os
// mesmos filtros por omissão reaproveitavam silenciosamente o resultado
// em cache do teste anterior).
export const cache = new Map<string, MarketplaceSearchResult>();

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [IconComponent, LoadingComponent, ProductCoverComponent, StarsComponent],
  templateUrl: './services.component.html',
})
export class ServicesComponent {
  readonly SORTS = SORTS;
  readonly CERTS = CERTS;
  readonly COUNTRIES = COUNTRIES;

  readonly q = signal('');
  readonly qDebounced = signal('');
  readonly category = signal('');
  readonly certs = signal<string[]>([]);
  readonly verified = signal(false);
  readonly country = signal('');
  readonly sort = signal('relevantes');
  readonly page = signal(1);

  readonly data = signal<MarketplaceSearchResult | null>(null);
  readonly facets = signal<Pick<MarketplaceFacets, 'categories'>>({ categories: [] });
  readonly loading = signal(true);
  readonly error = signal('');
  readonly toast = signal('');

  private readonly qInput$ = new Subject<string>();

  readonly total = computed(() => this.data()?.total || 0);
  readonly pages = computed(() => this.data()?.pages || 1);
  readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * 16 + 1));
  readonly to = computed(() => Math.min(this.page() * 16, this.total()));
  readonly pageNumbers = computed(() => paginacao(this.page(), this.pages()));

  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly quotesService: QuotesService,
    private readonly router: Router,
    route: ActivatedRoute,
  ) {
    const qInicial = route.snapshot.queryParamMap.get('q') || '';
    this.q.set(qInicial);
    this.qDebounced.set(qInicial);

    this.qInput$.pipe(debounceTime(350)).subscribe((valor) => {
      this.qDebounced.set(valor);
      this.page.set(1);
      this.load();
      this.loadFacets();
    });

    this.load();
    this.loadFacets();
  }

  private buildParams(): MarketplaceSearchParams {
    const p: MarketplaceSearchParams = { kind: 'SERVICO', sort: this.sort(), page: this.page(), limit: 16 };
    if (this.qDebounced()) p.q = this.qDebounced();
    if (this.category()) p.category = this.category();
    if (this.certs().length) p.certifications = this.certs().join(',');
    if (this.verified()) p.verified = 'true';
    if (this.country()) p.country = this.country();
    return p;
  }

  private load(): void {
    const params = this.buildParams();
    const key = JSON.stringify(params);
    this.error.set('');
    const cacheado = cache.get(key);
    if (cacheado) {
      this.data.set(cacheado);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.marketplaceService.search(params).subscribe({
      next: (res) => {
        cache.set(key, res);
        this.data.set(res);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Falha ao carregar serviços.');
        this.loading.set(false);
      },
    });
  }

  private loadFacets(): void {
    const p: Omit<MarketplaceSearchParams, 'sort' | 'page' | 'limit'> = { kind: 'SERVICO' };
    if (this.qDebounced()) p.q = this.qDebounced();
    if (this.verified()) p.verified = 'true';
    if (this.country()) p.country = this.country();
    this.marketplaceService.facets(p).subscribe({ next: (f) => this.facets.set(f), error: () => {} });
  }

  onQ(valor: string): void {
    this.q.set(valor);
    this.qInput$.next(valor);
  }

  setCategory(cat: string): void {
    this.category.set(this.category() === cat ? '' : cat);
    this.page.set(1);
    this.load();
  }

  toggleCert(c: string): void {
    this.certs.update((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
    this.page.set(1);
    this.load();
  }

  setVerified(v: boolean): void {
    this.verified.set(v);
    this.page.set(1);
    this.load();
    this.loadFacets();
  }

  setCountry(c: string): void {
    this.country.set(c);
    this.page.set(1);
    this.load();
    this.loadFacets();
  }

  setSort(v: string): void {
    this.sort.set(v);
    this.page.set(1);
    this.load();
  }

  setPage(p: number): void {
    this.page.set(p);
    this.load();
  }

  clearFilters(): void {
    this.category.set('');
    this.certs.set([]);
    this.verified.set(false);
    this.country.set('');
    this.q.set('');
    this.qDebounced.set('');
    this.page.set(1);
    this.load();
    this.loadFacets();
  }

  toggleFav(p: ProductDto): void {
    const acao = p.isFavorite ? this.marketplaceService.removeFavorite(p.id) : this.marketplaceService.addFavorite(p.id);
    acao.subscribe({
      next: () => {
        cache.clear();
        this.data.update((d) => (d ? { ...d, items: d.items.map((it) => (it.id === p.id ? { ...it, isFavorite: !it.isFavorite } : it)) } : d));
      },
      error: (e) => this.toast.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  solicitarCotacao(p: ProductDto): void {
    this.quotesService.create({ supplierCompanyId: p.supplier?.id || '', items: [{ productId: p.id, quantity: 1 }] }).subscribe({
      next: () => {
        this.toast.set(`Pedido de cotação enviado a ${p.supplier?.name || 'fornecedor'}.`);
        setTimeout(() => this.toast.set(''), 4000);
      },
      error: (e) => {
        this.toast.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        setTimeout(() => this.toast.set(''), 4000);
      },
    });
  }

  abrir(p: ProductDto): void {
    this.router.navigate(['/comprador/servicos', p.slug || p.id]);
  }

  availClass(p: ProductDto): string {
    const avail = p.availability || 'Disponível';
    return /sob/i.test(avail) ? 'sobconsulta' : 'disponivel';
  }

  formatNumber = formatNumber;
  joinNonEmpty = joinNonEmpty;
}

function paginacao(cur: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | string)[] = [1];
  const s = Math.max(2, cur - 1);
  const e = Math.min(total - 1, cur + 1);
  if (s > 2) out.push('…');
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push('…');
  out.push(total);
  return out;
}
