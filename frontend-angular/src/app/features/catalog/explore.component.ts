// Porta de frontend/src/pages/comprador/Explore.jsx (rota
// /comprador/explorar). Pesquisa de produtos E serviços, com todo o estado de
// filtros sincronizado no endereço (query params) — não só `q` — para que um
// link com filtros aplicados possa ser partilhado ou recarregado sem perder
// o resultado, tal como o comentário original em Explore.jsx explica.
import { Component, computed, signal } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { MarketplaceService } from './marketplace.service';
import {
  ProductDto,
  MarketplaceSearchResult,
  MarketplaceFacets,
  MarketplaceSearchParams,
} from '../../core/models/product.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney, formatNumber, joinNonEmpty } from '../../shared/domain';
import { IconComponent } from '../../shared/components/icon.component';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';
import { StarsComponent } from '../../shared/components/stars.component';

const SORTS: [string, string][] = [
  ['relevantes', 'Mais relevantes'],
  ['recentes', 'Mais recentes'],
  ['avaliacao', 'Melhor avaliação'],
  ['preco_asc', 'Menor preço'],
  ['preco_desc', 'Maior preço'],
  ['solicitados', 'Mais solicitados'],
];
const KIND_LABEL: Record<string, string> = { SERVICO: 'Serviço', PRODUTO: 'Produto' };
const PAGE_SIZES = [12, 24, 48];

interface Chip {
  k: string;
  label: string;
  clear: () => void;
}

// Cache simples em memória por query-string, tal como o React.
// Exportado só para o spec poder limpá-la entre testes — ver o comentário
// equivalente em services.component.ts.
export const cache = new Map<string, MarketplaceSearchResult>();

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [IconComponent, ProductCoverComponent, StarsComponent],
  templateUrl: './explore.component.html',
})
export class ExploreComponent {
  readonly SORTS = SORTS;
  readonly PAGE_SIZES = PAGE_SIZES;
  readonly KIND_LABEL = KIND_LABEL;

  readonly q = signal('');
  readonly pendingQ = signal('');
  readonly category = signal('');
  readonly kind = signal('');
  readonly country = signal('');
  readonly certs = signal<string[]>([]);
  readonly sort = signal('relevantes');
  readonly page = signal(1);
  readonly limit = signal(12);

  readonly data = signal<MarketplaceSearchResult | null>(null);
  readonly facets = signal<MarketplaceFacets>({
    categories: [],
    kinds: [],
    countries: [],
    certifications: [],
    priceBounds: { min: 0, max: 0 },
  });
  readonly loading = signal(true);
  readonly error = signal('');
  readonly toast = signal('');

  readonly total = computed(() => this.data()?.total || 0);
  readonly pages = computed(() => this.data()?.pages || 1);
  readonly from = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.limit() + 1));
  readonly to = computed(() => Math.min(this.page() * this.limit(), this.total()));
  readonly pageNumbers = computed(() => paginacao(this.page(), this.pages()));

  readonly chips = computed<Chip[]>(() => {
    const out: Chip[] = [];
    if (this.kind()) out.push({ k: 'kind', label: KIND_LABEL[this.kind()] || this.kind(), clear: () => this.setKind('') });
    if (this.q()) out.push({ k: 'q', label: this.q(), clear: () => this.clearQ() });
    if (this.category()) out.push({ k: 'cat', label: this.category(), clear: () => this.setCategory('') });
    if (this.country()) out.push({ k: 'country', label: this.country(), clear: () => this.setCountry('') });
    for (const c of this.certs()) out.push({ k: `cert-${c}`, label: c, clear: () => this.toggleCert(c) });
    return out;
  });

  private syncingFromUrl = false;

  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {
    this.applyFromUrl(route.snapshot.queryParams);
    // Alguém chegou aqui com um `q` diferente (a pesquisa da barra de topo).
    // O React sincroniza sp->estado num efeito próprio; aqui a subscrição ao
    // ActivatedRoute cobre o mesmo caso (voltar atrás no browser, ou um link
    // colado com filtros diferentes dos actuais).
    route.queryParams.subscribe((params) => this.applyFromUrl(params));

    this.load();
    this.loadFacets();
  }

  private applyFromUrl(params: Params): void {
    this.syncingFromUrl = true;
    const urlQ = params['q'] || '';
    this.q.set(urlQ);
    this.pendingQ.set(urlQ);
    this.category.set(params['category'] || '');
    this.kind.set(params['kind'] || '');
    this.country.set(params['country'] || '');
    this.certs.set(params['certs'] ? String(params['certs']).split(',').filter(Boolean) : []);
    this.sort.set(params['sort'] || 'relevantes');
    this.page.set(Number(params['page']) > 0 ? Number(params['page']) : 1);
    this.limit.set(PAGE_SIZES.includes(Number(params['limit'])) ? Number(params['limit']) : 12);
    this.syncingFromUrl = false;
  }

  // Estado -> endereço, com replaceUrl (não empilha histórico a cada clique
  // num filtro), tal como o React faz com { replace: true }.
  private syncToUrl(): void {
    if (this.syncingFromUrl) return;
    const next: Params = {};
    if (this.q()) next['q'] = this.q();
    if (this.category()) next['category'] = this.category();
    if (this.kind()) next['kind'] = this.kind();
    if (this.country()) next['country'] = this.country();
    if (this.certs().length) next['certs'] = this.certs().join(',');
    if (this.sort() !== 'relevantes') next['sort'] = this.sort();
    if (this.page() > 1) next['page'] = String(this.page());
    if (this.limit() !== 12) next['limit'] = String(this.limit());
    this.router.navigate([], { relativeTo: this.route, queryParams: next, replaceUrl: true });
  }

  private buildParams(): MarketplaceSearchParams {
    const p: MarketplaceSearchParams = { sort: this.sort(), page: this.page(), limit: this.limit() };
    if (this.q()) p.q = this.q();
    if (this.category()) p.category = this.category();
    if (this.kind()) p.kind = this.kind() as 'PRODUTO' | 'SERVICO';
    if (this.country()) p.country = this.country();
    if (this.certs().length) p.certifications = this.certs().join(',');
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
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.loading.set(false);
      },
    });
  }

  reload(): void {
    this.load();
  }

  private loadFacets(): void {
    const p: Omit<MarketplaceSearchParams, 'sort' | 'page' | 'limit'> = {};
    if (this.q()) p.q = this.q();
    this.marketplaceService.facets(p).subscribe({ next: (f) => this.facets.set(f), error: () => {} });
  }

  private reloadAll(): void {
    this.syncToUrl();
    this.load();
    this.loadFacets();
  }

  onPendingQ(valor: string): void {
    this.pendingQ.set(valor);
  }

  doSearch(): void {
    this.q.set(this.pendingQ());
    this.page.set(1);
    this.reloadAll();
  }

  private clearQ(): void {
    this.q.set('');
    this.pendingQ.set('');
  }

  setCategory(c: string): void {
    this.category.set(this.category() === c ? '' : c);
    this.page.set(1);
    this.reloadAll();
  }

  setKind(k: string): void {
    this.kind.set(this.kind() === k ? '' : k);
    this.page.set(1);
    this.reloadAll();
  }

  setCountry(c: string): void {
    this.country.set(this.country() === c ? '' : c);
    this.page.set(1);
    this.reloadAll();
  }

  toggleCert(c: string): void {
    this.certs.update((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
    this.page.set(1);
    this.reloadAll();
  }

  setSort(v: string): void {
    this.sort.set(v);
    this.page.set(1);
    this.reloadAll();
  }

  setPage(p: number): void {
    this.page.set(p);
    this.reloadAll();
  }

  setLimit(v: string): void {
    this.limit.set(Number(v));
    this.page.set(1);
    this.reloadAll();
  }

  clearAll(): void {
    this.q.set('');
    this.pendingQ.set('');
    this.category.set('');
    this.kind.set('');
    this.country.set('');
    this.certs.set([]);
    this.page.set(1);
    this.reloadAll();
  }

  clearChip(chip: Chip): void {
    chip.clear();
    this.page.set(1);
    this.reloadAll();
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

  saveSearch(): void {
    const params = this.buildParams();
    const qs = new URLSearchParams(params as unknown as Record<string, string>).toString();
    const label = this.q() ? `"${this.q()}"` : 'Pesquisa';
    this.marketplaceService.saveSearch({ label, query: qs }).subscribe({
      next: () => {
        this.toast.set('Pesquisa guardada.');
        setTimeout(() => this.toast.set(''), 3500);
      },
      error: (e) => {
        this.toast.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        setTimeout(() => this.toast.set(''), 3500);
      },
    });
  }

  abrir(p: ProductDto): void {
    this.router.navigate(['/comprador/servicos', p.slug || p.id]);
  }

  initials(name = ''): string {
    return (
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || '')
        .join('')
        .toUpperCase() || '?'
    );
  }

  formatMoney = formatMoney;
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
